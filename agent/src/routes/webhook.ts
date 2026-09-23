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
import { evaluatePrWithGemini, mockEvaluatePr } from "../evaluator/gemini.js";
import { signBountyClaim } from "../signer/index.js";
import { GithubAuditClient, parseGithubIssueOrPrUrl } from "../github/client.js";
import type { Address, Hex } from "viem";

export async function webhookRoutes(app: FastifyInstance) {
  const githubClient = new GithubAuditClient();

  app.post("/webhook/github", async (request: FastifyRequest, reply: FastifyReply) => {
    const event = request.headers["x-github-event"] as string;
    const body = request.body as Record<string, unknown>;

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

    // Run Full 5-Layer Audit Pipeline
    const contractAddress = (process.env.ESCROW_CONTRACT_ADDRESS ||
      "0x0000000000000000000000000000000000000001") as Address;
    const chainId = Number(process.env.CHAIN_ID || 97);
    const privateKey = (process.env.AGENT_PRIVATE_KEY ||
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Hex;

    // AI Evaluation
    const aiResult = process.env.GEMINI_API_KEY
      ? await evaluatePrWithGemini({
          issueTitle: `Bounty #${bounty.bountyId}`,
          issueBody: bounty.issueUrl,
          prTitle,
          prBody,
          diff: "+ // Automated webhook diff analysis"
        })
      : mockEvaluatePr({
          issueTitle: `Bounty #${bounty.bountyId}`,
          issueBody: bounty.issueUrl,
          prTitle,
          prBody,
          diff: "+ // Automated webhook diff analysis"
        });

    let signature: Hex | null = null;
    if (aiResult.verdict === "passed" && !aiResult.tamperingDetected) {
      const signResult = await signBountyClaim(
        {
          bountyId: bounty.bountyId,
          devWallet,
          commitHash: headSha,
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
      commitHash: headSha,
      developer: devWallet,
      ciStatus: "passed",
      ciDetail: JSON.stringify({ webhook: true }),
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
