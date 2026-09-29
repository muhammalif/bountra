import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "node:crypto";
import {
  recordWebhookEvent,
  isWebhookProcessed,
  markWebhookProcessed,
  getBountyByIssueUrl,
  createAuditLog
} from "../db/index.js";
import { checkTestTampering } from "../evaluator/security.js";
import { verifyGithubSignature } from "../security/webhookSignature.js";
import { evaluatePrWithGemini, mockEvaluatePr } from "../evaluator/gemini.js";
import { requireAgentSigningKey, signBountyClaim } from "../signer/index.js";
import { GithubAuditClient, parseGithubIssueOrPrUrl } from "../github/client.js";
import type { Address, Hex } from "viem";

export async function webhookRoutes(app: FastifyInstance) {
  const githubClient = new GithubAuditClient();

  app.post("/webhook/github", async (request: FastifyRequest, reply: FastifyReply) => {
    const event = request.headers["x-github-event"] as string;
    const body = request.body as Record<string, unknown>;

    // Authenticate the delivery BEFORE anything else: before the dedup lookup,
    // before the DB write, before the GitHub API call, before any LLM spend.
    // An unsigned request to this endpoint is what turns the agent's signing key
    // into an open service. docs/RULES.md §1 mandates this HMAC check and the
    // previous implementation had no verification at all.
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const deliverySignature = request.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = (request as { rawBody?: Buffer }).rawBody;

    // Nothing configured means nobody can authenticate, so refuse rather than
    // accept: a testnet deployment that forgot the secret must not silently
    // become an unsigned endpoint.
    if (!secret) {
      app.log.error("GITHUB_WEBHOOK_SECRET is not set; refusing webhook delivery");
      return reply.code(503).send({
        status: "error",
        message: "Webhook is not configured (GITHUB_WEBHOOK_SECRET missing)"
      });
    }

    const verified = verifyGithubSignature({ signature: deliverySignature, rawBody, secret });
    if (!verified.ok) {
      app.log.warn({ reason: verified.reason }, "rejected webhook delivery with invalid signature");
      return reply.code(401).send({ status: "error", message: `Invalid signature: ${verified.reason}` });
    }

    // Deduplication via SHA-256 payload hash
    const payloadString = JSON.stringify(body);
    const payloadHash = crypto.createHash("sha256").update(payloadString).digest("hex");

    const alreadyProcessed = await isWebhookProcessed(payloadHash);
    if (alreadyProcessed) {
      return reply.code(200).send({ status: "ignored", message: "Duplicate webhook payload" });
    }

    if (event !== "pull_request" && event !== "check_run") {
      return reply.code(200).send({ status: "ignored", message: `Event ${event} not handled` });
    }

    const pr = (body.pull_request as Record<string, unknown>) || {};
    const prUrl = (pr.html_url as string) || "";
    const prBody = (pr.body as string) || "";
    const prTitle = (pr.title as string) || "";
    const sender = ((body.sender as Record<string, unknown>)?.login as string) || "unknown";
    const headSha = ((pr.head as Record<string, unknown>)?.sha as string) || "";

    // Extract issue reference from PR body (e.g. "Closes https://github.com/owner/repo/issues/10" or "Fixes #10")
    const issueMatch = prBody.match(/(?:closes|fixes|resolves)\s+(https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+)/i);
    const issueUrl = issueMatch ? issueMatch[1] : null;

    let bounty = null;
    if (issueUrl) {
      bounty = await getBountyByIssueUrl(issueUrl);
    }

    // Record webhook event in DB
    await recordWebhookEvent({
      bountyId: bounty ? bounty.bountyId : null,
      eventType: `github.${event}.${body.action || "unknown"}`,
      prNumber: (pr.number as number) || null,
      prUrl,
      sender,
      commitHash: headSha || "unknown",
      payloadHash,
      processed: 0
    });

    if (!bounty) {
      await markWebhookProcessed(payloadHash);
      return reply.code(200).send({
        status: "skipped",
        message: "No active bounty found associated with this PR"
      });
    }

    // Parse developer payout address from PR body (e.g. "Wallet: 0x...")
    const walletMatch = prBody.match(/(?:wallet|payout|payout-address|address):\s*(0x[a-fA-F0-9]{40})/i);
    const devWallet = walletMatch ? (walletMatch[1] as Address) : null;

    if (!devWallet) {
      await markWebhookProcessed(payloadHash);
      return reply.code(200).send({
        status: "pending_wallet",
        message: "PR does not specify developer payout address (format: 'Wallet: 0x...')"
      });
    }

    const contractAddress = (process.env.ESCROW_CONTRACT_ADDRESS ||
      "0x0000000000000000000000000000000000000001") as Address;
    const chainId = Number(process.env.CHAIN_ID || 97);
    const privateKey = requireAgentSigningKey();

    // Fetch the real PR. Previously this route trusted the webhook payload alone
    // and fed Gemini the string "+ // Automated webhook diff analysis" while
    // hardcoding ciStatus to "passed" — so the audit scored nothing real and the
    // Hard Gate never ran. docs/RULES.md §2 requires CI status to come from the
    // GitHub API, never from the caller.
    const parsed = parseGithubIssueOrPrUrl(prUrl);
    if (!parsed) {
      await markWebhookProcessed(payloadHash);
      return reply.code(400).send({ status: "error", message: "PR URL is not parseable" });
    }

    let prFromApi;
    let issue;
    const issueRef = bounty.issueUrl ? parseGithubIssueOrPrUrl(bounty.issueUrl) : null;
    try {
      [prFromApi, issue] = await Promise.all([
        githubClient.fetchPullRequest(parsed.owner, parsed.repo, parsed.issueOrPrNumber),
        issueRef
          ? githubClient.fetchIssue(issueRef.owner, issueRef.repo, issueRef.issueOrPrNumber)
          : Promise.resolve(null)
      ]);
    } catch (err) {
      app.log.error({ prUrl, err: (err as Error).message }, "failed to fetch PR from GitHub");
      await markWebhookProcessed(payloadHash);
      return reply.code(502).send({ status: "error", message: "GitHub API unavailable" });
    }

    // The head SHA is what the contract binds, so the signature must be made from
    // the SHA the API reports — not from whatever the payload claimed.
    if (prFromApi.headCommitHash !== headSha) {
      app.log.warn(
        { payloadSha: headSha, apiSha: prFromApi.headCommitHash },
        "head SHA mismatch between payload and GitHub API; using API value"
      );
    }

    // Hard Gate: CI must actually be green. Reject before spending any LLM quota.
    if (!prFromApi.ciPassed) {
      await createAuditLog({
        bountyId: bounty.bountyId,
        prUrl,
        commitHash: prFromApi.headCommitHash,
        developer: devWallet,
        ciStatus: "failed",
        ciDetail: JSON.stringify(prFromApi.ciDetails),
        integrityOk: 1,
        aiScore: 0,
        aiVerdict: "failed",
        aiComment: "Hard Gate failed: CI checks are not green",
        status: "failed"
      });
      await markWebhookProcessed(payloadHash);
      return reply.code(200).send({
        status: "rejected_ci",
        message: "Hard Gate failed: CI checks are not green",
        ciDetails: prFromApi.ciDetails
      });
    }

    // Layer 2: test/CI tampering. Runs before the LLM, same as the manual route.
    const tamperingCheck = checkTestTampering(prFromApi.changedFiles);
    if (!tamperingCheck.ok) {
      await createAuditLog({
        bountyId: bounty.bountyId,
        prUrl,
        commitHash: prFromApi.headCommitHash,
        developer: devWallet,
        ciStatus: "passed",
        ciDetail: JSON.stringify(prFromApi.ciDetails),
        integrityOk: 0,
        aiScore: 0,
        aiVerdict: "failed",
        aiComment: `Security Gate Failed: ${tamperingCheck.reason}`,
        status: "failed"
      });
      await markWebhookProcessed(payloadHash);
      return reply.code(200).send({
        status: "rejected_tampering",
        message: tamperingCheck.reason,
        violations: tamperingCheck.violations
      });
    }

    const prompt = {
      issueTitle: issue?.title || `Bounty #${bounty.bountyId}`,
      issueBody: issue?.body || bounty.issueUrl,
      prTitle: prFromApi.prTitle || prTitle,
      prBody: prFromApi.prBody || prBody,
      diff: prFromApi.diff
    };

    // AI Evaluation
    const aiResult = process.env.GEMINI_API_KEY
      ? await evaluatePrWithGemini(prompt)
      : mockEvaluatePr(prompt);

    let signature: Hex | null = null;
    if (aiResult.verdict === "passed" && !aiResult.tamperingDetected) {
      const signResult = await signBountyClaim(
        {
          bountyId: bounty.bountyId,
          devWallet,
          commitHash: prFromApi.headCommitHash,
          prUrl,
          contractAddress,
          chainId
        },
        privateKey
      );
      signature = signResult.signature;
    }

    // Persist audit log
    await createAuditLog({
      bountyId: bounty.bountyId,
      prUrl,
      commitHash: prFromApi.headCommitHash,
      developer: devWallet,
      ciStatus: "passed",
      ciDetail: JSON.stringify(prFromApi.ciDetails),
      integrityOk: 1,
      aiScore: aiResult.score,
      aiVerdict: aiResult.verdict,
      aiComment: aiResult.summary,
      signature: signature || null,
      status: aiResult.verdict === "passed" ? "passed" : "failed"
    });

    await markWebhookProcessed(payloadHash);

    return reply.code(200).send({
      status: "audited",
      verdict: aiResult.verdict,
      score: aiResult.score,
      signature
    });
  });
}
