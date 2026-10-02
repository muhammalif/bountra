import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
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
import { formatVerdictComment } from "../github/prComment.js";
import { buildWebhookDedupKey } from "./webhook-dedup-key.js";
import type { Address, Hex } from "viem";

// The only pull_request actions that can change a verdict (docs/PRD.md FR-2).
// `opened` is the first submission; `synchronize` fires on every new push, which
// is the only thing that invalidates a previous audit. Everything else — closed,
// reopened, edited, labeled, review_requested — describes the PR's metadata, not
// its code, so re-auditing on it would spend LLM quota to reach the same verdict.
const AUDITABLE_PULL_REQUEST_ACTIONS = new Set(["opened", "synchronize"]);

export interface WebhookRouteOptions {
  githubClient?: GithubAuditClient;
}

export async function webhookRoutes(app: FastifyInstance, options: WebhookRouteOptions = {}) {
  const githubClient = options.githubClient || new GithubAuditClient();

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

    const payloadHash = buildWebhookDedupKey(event, body);

    const alreadyProcessed = await isWebhookProcessed(payloadHash);
    if (alreadyProcessed) {
      return reply.code(200).send({ status: "ignored", message: "Duplicate webhook payload" });
    }

    if (event !== "pull_request" && event !== "check_run") {
      return reply.code(200).send({ status: "ignored", message: `Event ${event} not handled` });
    }

    // Only the two actions FR-2 names can start an audit. Every other
    // pull_request action (closed, reopened, edited, labeled, review_requested…)
    // would otherwise reach the bounty lookup and the LLM, re-auditing work that
    // was already judged. Filtered before any DB write or API call, so an
    // irrelevant action costs nothing.
    //
    // A re-audit is still reachable without `synchronize`: a new commit always
    // emits it, and that is the only signal that invalidates a previous verdict.
    if (event === "pull_request" && !AUDITABLE_PULL_REQUEST_ACTIONS.has(body.action as string)) {
      app.log.debug(
        { action: body.action },
        "ignoring pull_request action that cannot change a verdict"
      );
      return reply.code(200).send({
        status: "ignored",
        message: `pull_request action ${String(body.action)} not audited`
      });
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

    const contractAddress = process.env.ESCROW_CONTRACT_ADDRESS as Address | undefined;
    const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined;
    if (!contractAddress || chainId === undefined || !Number.isSafeInteger(chainId) || chainId < 1) {
      return reply.code(503).send({ status: "error", message: "Audit contract provenance is not configured" });
    }
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

    // Gate rejections are also developer-facing: a PR that never receives a
    // comment looks like the agent is broken, not like the gate worked. Uses the
    // same best-effort contract as the verdict comment.
    const postGateComment = async (message: string, commitHash: string, violations?: string[]) => {
      try {
        await githubClient.postPrComment(
          parsed.owner,
          parsed.repo,
          parsed.issueOrPrNumber,
          formatVerdictComment({
            verdict: "failed",
            score: 0,
            summary: message,
            weaknesses: violations?.length ? violations : [message],
            bountyId: bounty.bountyId,
            amount: bounty.amount,
            commitHash
          })
        );
      } catch (err) {
        app.log.error({ prUrl, err: (err as Error).message }, "failed to post gate comment");
      }
    };
    try {
      [prFromApi, issue] = await Promise.all([
        githubClient.fetchPullRequest(parsed.owner, parsed.repo, parsed.issueOrPrNumber),
        issueRef
          ? githubClient.fetchIssue(issueRef.owner, issueRef.repo, issueRef.issueOrPrNumber)
          : Promise.resolve(null)
      ]);
    } catch (err) {
      app.log.error({ prUrl, err: (err as Error).message }, "failed to fetch PR from GitHub");
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

    if (!prFromApi.diffAvailable) {
      const message = "Hard Gate failed: PR diff could not be fetched";
      const evidence = prFromApi.ciDetails.evidence;
      const ciStatus = evidence === "unavailable" ? "unknown" : prFromApi.ciPassed ? "passed" : "failed";
      await createAuditLog({
        bountyId: bounty.bountyId,
        prUrl,
        commitHash: prFromApi.headCommitHash,
        developer: devWallet,
        contractAddress,
        chainId,
        ciStatus,
        ciDetail: JSON.stringify({ ...prFromApi.ciDetails, diffAvailable: false }),
        integrityOk: null,
        aiScore: 0,
        aiVerdict: "failed",
        aiComment: message,
        status: "failed"
      });
      await postGateComment(message, prFromApi.headCommitHash);
      await markWebhookProcessed(payloadHash);
      return reply.code(200).send({
        status: "rejected_diff",
        message,
        signature: null
      });
    }

    // Hard Gate: CI must actually be green. Reject before spending any LLM quota.
    if (!prFromApi.ciPassed) {
      const message = "Hard Gate failed: CI checks are not green";
      await createAuditLog({
        bountyId: bounty.bountyId,
        prUrl,
        commitHash: prFromApi.headCommitHash,
        developer: devWallet,
        contractAddress,
        chainId,
        ciStatus: "failed",
        ciDetail: JSON.stringify(prFromApi.ciDetails),
        integrityOk: 1,
        aiScore: 0,
        aiVerdict: "failed",
        aiComment: message,
        status: "failed"
      });
      await postGateComment(message, prFromApi.headCommitHash);
      await markWebhookProcessed(payloadHash);
      return reply.code(200).send({
        status: "rejected_ci",
        message,
        ciDetails: prFromApi.ciDetails
      });
    }

    // Layer 2: test/CI tampering. Runs before the LLM, same as the manual route.
    const tamperingCheck = checkTestTampering(prFromApi.changedFiles);
    if (!tamperingCheck.ok) {
      const message = `Security Gate Failed: ${tamperingCheck.reason}`;
      await createAuditLog({
        bountyId: bounty.bountyId,
        prUrl,
        commitHash: prFromApi.headCommitHash,
        developer: devWallet,
        contractAddress,
        chainId,
        ciStatus: "passed",
        ciDetail: JSON.stringify(prFromApi.ciDetails),
        integrityOk: 0,
        aiScore: 0,
        aiVerdict: "failed",
        aiComment: message,
        status: "failed"
      });
      await postGateComment(message, prFromApi.headCommitHash, tamperingCheck.violations);
      await markWebhookProcessed(payloadHash);
      return reply.code(200).send({
        status: "rejected_tampering",
        message,
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
      contractAddress,
      chainId,
      ciStatus: "passed",
      ciDetail: JSON.stringify(prFromApi.ciDetails),
      integrityOk: 1,
      aiScore: aiResult.score,
      aiVerdict: aiResult.verdict,
      aiComment: aiResult.summary,
      signature: signature || null,
      status: aiResult.verdict === "passed" ? "passed" : "failed"
    });

    // FR-7: post the verdict back to the PR. Commenting is best-effort — a
    // comment failure must not discard a completed audit or the signature, so
    // it is logged and the audit result is still returned.
    let commentPosted = false;
    try {
      await githubClient.postPrComment(
        parsed.owner,
        parsed.repo,
        parsed.issueOrPrNumber,
        formatVerdictComment({
          verdict: aiResult.verdict,
          score: aiResult.score,
          summary: aiResult.summary,
          strengths: aiResult.strengths,
          weaknesses: aiResult.weaknesses,
          bountyId: bounty.bountyId,
          amount: bounty.amount,
          commitHash: prFromApi.headCommitHash
        })
      );
      commentPosted = true;
    } catch (err) {
      app.log.error({ prUrl, err: (err as Error).message }, "failed to post verdict comment");
    }

    await markWebhookProcessed(payloadHash);

    return reply.code(200).send({
      status: "audited",
      verdict: aiResult.verdict,
      score: aiResult.score,
      signature,
      commentPosted
    });
  });
}
