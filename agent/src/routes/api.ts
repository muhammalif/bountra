import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listBounties,
  getBountyById,
  createBountyRecord,
  getAuditLogByBountyId,
  createAuditLog,
  updateBountyStatus,
  updateAuditLog,
  getLatestAuditForBounty,
  findReusableAudit,
  listPassedAuditsByDeveloper,
  listLatestVerdictsByBounty
} from "../db/index.js";
import {
  requireAgentSigningKey,
  signBountyClaim,
  computeRawClaimHash,
  computeClaimDigest
} from "../signer/index.js";
import { evaluatePrWithGemini, mockEvaluatePr, EvaluatorUnavailableError } from "../evaluator/gemini.js";
import { checkTestTampering } from "../evaluator/security.js";
import { createBountyReader, type BountyReader } from "../chain/readBounty.js";
import { verifyClaimOnChain } from "../chain/verifyClaim.js";
import { GithubAuditClient, parseGithubIssueOrPrUrl, type CiData } from "../github/client.js";
import { zeroAddress, type Address, type Hex } from "viem";

export interface ApiRouteOptions {
  githubClient?: GithubAuditClient;
  bountyReader?: BountyReader;
}

export async function apiRoutes(app: FastifyInstance, options: ApiRouteOptions = {}) {
  const githubClient = options.githubClient || new GithubAuditClient();
  const bountyReader =
    options.bountyReader ||
    createBountyReader({
      escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS,
      rpcUrl: process.env.BSC_TESTNET_RPC_URL
    });

  // Health check
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "bountra-agent",
      timestamp: new Date().toISOString()
    };
  });

  // List bounties
  app.get("/api/bounties", async (request: FastifyRequest<{ Querystring: { status?: string } }>) => {
    const { status } = request.query;
    const bounties = await listBounties(status);
    return { data: bounties };
  });

  /**
   * Latest audit verdict per bounty id, for the Explore feed.
   *
   * Registered before `/api/bounties/:id` on purpose: Fastify's router would
   * otherwise read "statuses" as a bounty id and answer 400.
   */
  app.get("/api/bounties/statuses", async () => {
    const latest = await listLatestVerdictsByBounty();
    return {
      data: Object.fromEntries(
        [...latest.entries()].map(([bountyId, row]) => [
          bountyId,
          {
            status: row.status,
            verdict: row.aiVerdict,
            score: row.aiScore,
            comment: row.aiComment,
            auditId: row.auditId,
            claimTxHash: row.claimTxHash
          }
        ])
      )
    };
  });

  // Get single bounty with latest audit log
  app.get("/api/bounties/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const bountyId = parseInt(request.params.id, 10);
    if (isNaN(bountyId)) {
      return reply.code(400).send({ error: "Invalid bounty ID" });
    }

    const bounty = await getBountyById(bountyId);
    if (!bounty) {
      return reply.code(404).send({ error: "Bounty not found" });
    }

    const auditLog = await getAuditLogByBountyId(bountyId);
    return { data: { ...bounty, auditLog } };
  });

  // Register / index a newly created bounty
  app.post(
    "/api/bounties",
    async (
      request: FastifyRequest<{
        Body: {
          bountyId: number;
          issueUrl: string;
          repoOwner: string;
          repoName: string;
          issueNum?: number;
          creator: string;
          token: string;
          amount: string;
          deadline: number;
          status?: string;
          txHash?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const body = request.body;
      if (
        !body ||
        !Number.isSafeInteger(body.bountyId) ||
        body.bountyId < 0 ||
        typeof body.issueUrl !== "string" ||
        !body.issueUrl ||
        typeof body.creator !== "string" ||
        !body.creator ||
        typeof body.token !== "string" ||
        !body.token ||
        typeof body.amount !== "string" ||
        !/^\d+$/.test(body.amount)
      ) {
        return reply.code(400).send({ error: "Missing required fields" });
      }

      let onChain;
      try {
        onChain = await bountyReader(body.bountyId);
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        return reply.code(502).send({ error: `Unable to verify bounty on-chain: ${reason}` });
      }

      if (!onChain.ok) {
        return reply.code(onChain.statusCode ?? 502).send({ error: onChain.reason });
      }

      if (onChain.bounty.creator.toLowerCase() === zeroAddress) {
        return reply.code(400).send({ error: `Bounty ${body.bountyId} does not exist on-chain` });
      }

      if (body.creator.toLowerCase() !== onChain.bounty.creator.toLowerCase()) {
        return reply.code(400).send({ error: "Bounty creator does not match the on-chain creator" });
      }

      if (body.token.toLowerCase() !== onChain.bounty.token.toLowerCase()) {
        return reply.code(400).send({ error: "Bounty token does not match the on-chain token" });
      }

      if (BigInt(body.amount) !== onChain.bounty.amount) {
        return reply.code(400).send({ error: "Bounty amount does not match the on-chain amount" });
      }

      try {
        const created = await createBountyRecord({
          bountyId: body.bountyId,
          issueUrl: body.issueUrl,
          repoOwner: body.repoOwner || "unknown",
          repoName: body.repoName || "unknown",
          issueNum: body.issueNum || null,
          creator: body.creator,
          token: body.token,
          amount: body.amount,
          deadline: body.deadline || Math.floor(Date.now() / 1000) + 86400,
          status: body.status || "open",
          txHash: body.txHash || null
        });
        return reply.code(201).send({ data: created });
      } catch (err: unknown) {
        return reply.code(409).send({ error: (err as Error).message || "Bounty already exists" });
      }
    }
  );

  // Manual / Demo PR evaluation endpoint
  app.post(
    "/api/audit/evaluate",
    async (
      request: FastifyRequest<{
        Body: {
          bountyId: number;
          prUrl: string;
          commitHash: string;
          devWallet: string;
          issueTitle?: string;
          issueBody?: string;
          prTitle?: string;
          prBody?: string;
          diff?: string;
          changedFiles?: Array<{ filename: string; status: string }>;
          contractAddress?: string;
          chainId?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const {
        bountyId,
        prUrl,
        commitHash,
        devWallet,
        issueTitle = "Fix critical issue",
        issueBody = "Implement fix according to acceptance criteria",
        prTitle = "fix: resolve bounty issue",
        prBody = "Resolves issue",
        diff = "+ function fixed() { return true; }",
        changedFiles = [{ filename: "src/index.ts", status: "modified" }],
        contractAddress = (process.env.ESCROW_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000001") as Address,
        chainId = Number(process.env.CHAIN_ID || 97)
      } = request.body;

      if (bountyId === undefined || !prUrl || !commitHash || !devWallet) {
        return reply.code(400).send({ error: "Missing required audit parameters" });
      }

      const parsedPr = parseGithubIssueOrPrUrl(prUrl);
      if (!parsedPr) {
        return reply.code(400).send({ error: "PR URL is not parseable" });
      }

      let ciData: CiData;
      try {
        ciData = await githubClient.fetchCiStatus(parsedPr.owner, parsedPr.repo, commitHash);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        app.log.error({ prUrl, commitHash, error }, "failed to fetch CI status from GitHub");
        ciData = {
          ciPassed: false,
          ciDetails: { evidence: "unavailable", errors: { client: error } }
        };
      }

      const ciEvidence = ciData.ciDetails.evidence;
      const ciStatus = ciData.ciPassed ? "passed" : ciEvidence === "unavailable" ? "unknown" : "failed";
      const ciDetail = JSON.stringify(ciData.ciDetails);

      if (!ciData.ciPassed) {
        const unavailable = ciStatus === "unknown";
        const message = unavailable
          ? "Hard Gate unavailable: CI evidence could not be fetched"
          : "Hard Gate failed: CI checks are not green";
        const audit = await createAuditLog({
          bountyId,
          prUrl,
          commitHash,
          developer: devWallet,
          ciStatus,
          ciDetail,
          integrityOk: null,
          aiScore: 0,
          aiVerdict: unavailable ? "error" : "failed",
          aiComment: message,
          status: unavailable ? "error" : "failed"
        });

        return reply.code(unavailable ? 503 : 200).send({
          success: false,
          verdict: unavailable ? "error" : "failed",
          reason: message,
          signature: null,
          auditLog: audit
        });
      }

      const tamperingCheck = checkTestTampering(changedFiles);
      if (!tamperingCheck.ok) {
        const audit = await createAuditLog({
          bountyId,
          prUrl,
          commitHash,
          developer: devWallet,
          ciStatus,
          ciDetail,
          integrityOk: 0,
          aiScore: 0,
          aiVerdict: "failed",
          aiComment: `Security Gate Failed: ${tamperingCheck.reason}`,
          status: "failed"
        });
        return reply.code(200).send({
          success: false,
          verdict: "failed",
          reason: tamperingCheck.reason,
          auditLog: audit
        });
      }

      // Re-auditing the same (pr, commit) is deterministic by construction, so a
      // previously passed verdict is reusable. This keeps a re-triggered webhook
      // or a repeated demo call instant and offline-safe, and avoids spending
      // provider quota on a question already answered in the audit trail.
      //
      // The digests are recomputed rather than stored: they are pure functions of
      // the same params the signature was produced from, and recomputing removes
      // any chance of a cache hit disagreeing with on-chain bytes.
      const cached = await findReusableAudit({ bountyId, prUrl, commitHash, developer: devWallet });
      if (cached) {
        app.log.info({ prUrl, commitHash }, "reusing existing audit verdict");

        const claimParams = {
          bountyId,
          devWallet: devWallet as Address,
          commitHash,
          prUrl,
          contractAddress: contractAddress as Address,
          chainId
        };

        return reply.code(200).send({
          success: true,
          verdict: cached.aiVerdict,
          score: cached.aiScore,
          summary: cached.aiComment,
          signature: cached.signature as Hex | null,
          rawHash: computeRawClaimHash(claimParams),
          digest: computeClaimDigest(claimParams),
          cached: true,
          auditLog: cached
        });
      }

      let aiResult;
      try {
        aiResult = process.env.GEMINI_API_KEY
          ? await evaluatePrWithGemini({ issueTitle, issueBody, prTitle, prBody, diff })
          : mockEvaluatePr({ issueTitle, issueBody, prTitle, prBody, diff });
      } catch (err) {
        // docs/RULES.md §7 — log, mark audit as "error", skip. Never surface a
        // provider status code (404/503) as if it were a Bountra 404, and never
        // let a failed audit silently look like a passing one.
        if (err instanceof EvaluatorUnavailableError) {
          app.log.error({ err: err.message, providerStatus: err.providerStatus }, "semantic audit unavailable");

          await createAuditLog({
            bountyId,
            prUrl,
            commitHash,
            developer: devWallet,
            ciStatus,
            ciDetail,
            integrityOk: 1,
            aiScore: 0,
            aiVerdict: "error",
            aiComment: `Semantic audit unavailable: ${err.message}`,
            status: "error"
          });

          return reply.code(503).send({
            success: false,
            verdict: "error",
            reason: "Semantic audit provider unavailable. No signature was produced.",
            auditLogId: bountyId
          });
        }
        throw err;
      }

      let signature: Hex | null = null;
      let rawHash: Hex | null = null;
      let digest: Hex | null = null;

      if (aiResult.verdict === "passed" && !aiResult.tamperingDetected) {
        const privateKey = requireAgentSigningKey();

        const signResult = await signBountyClaim(
          {
            bountyId,
            devWallet: devWallet as Address,
            commitHash,
            prUrl,
            contractAddress: contractAddress as Address,
            chainId
          },
          privateKey
        );
        signature = signResult.signature;
        rawHash = signResult.rawHash;
        digest = signResult.digest;
      }

      const audit = await createAuditLog({
        bountyId,
        prUrl,
        commitHash,
        developer: devWallet,
        ciStatus,
        ciDetail,
        integrityOk: 1,
        aiScore: aiResult.score,
        aiVerdict: aiResult.verdict,
        aiComment: aiResult.summary,
        signature: signature || null,
        status: aiResult.verdict === "passed" ? "passed" : "failed"
      });

      return reply.code(200).send({
        success: aiResult.verdict === "passed",
        verdict: aiResult.verdict,
        score: aiResult.score,
        summary: aiResult.summary,
        signature,
        rawHash,
        digest,
        auditLog: audit
      });
    }
  );

  // ─── Claimable list for the Developer Hub ───
  // Read-only: reports which bounties this developer has a passing audit for.
  // It grants nothing — the signature is still required at claim time — it just
  // tells the UI which rows can be claimed instead of guessing from mock status.
  app.get("/api/claim/eligible", async (request: FastifyRequest<{ Querystring: { developer: string } }>, reply: FastifyReply) => {
    const developer = request.query.developer;
    if (!developer) {
      return reply.code(400).send({ error: "developer query parameter is required" });
    }

    const audits = await listPassedAuditsByDeveloper(developer);
    return reply.code(200).send({
      data: audits.map((a) => ({
        bountyId: a.bountyId,
        prUrl: a.prUrl,
        commitHash: a.commitHash,
        verdict: a.aiVerdict,
        score: a.aiScore,
        summary: a.aiComment,
        hasSignature: Boolean(a.signature),
        auditLogId: a.id
      }))
    });
  });

  // ─── Claim authorization ───
  // Returns the agent signature for a claim, but ONLY from an audit that
  // actually passed for this exact claim scope. Signature issuance is a read of
  // the audit trail, never a way to mint one: there is deliberately no
  // "skip the audit" parameter, because that would make the signature a
  // rubber stamp rather than proof of an evaluated PR.
  //
  // Deterministic by design — no evaluator call. The semantic verdict already
  // lives in audit_logs (A2 cache); recomputing it here would burn provider
  // quota and could flip a passing verdict on a 503, which would revoke an
  // authorization the developer is already holding.
  app.post(
    "/api/claim/authorize",
    async (
      request: FastifyRequest<{
        Body: {
          bountyId: number;
          prUrl: string;
          commitHash: string;
          devWallet: string;
          contractAddress?: string;
          chainId?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const {
        bountyId,
        prUrl,
        commitHash,
        devWallet,
        contractAddress = (process.env.ESCROW_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000001") as Address,
        chainId = Number(process.env.CHAIN_ID || 97)
      } = request.body;

      if (bountyId === undefined || !prUrl || !commitHash || !devWallet) {
        return reply.code(400).send({ error: "Missing required claim parameters" });
      }

      const audit = await findReusableAudit({ bountyId, prUrl, commitHash, developer: devWallet });

      if (!audit || !audit.signature) {
        return reply.code(409).send({
          authorized: false,
          error: "No passing audit exists for this bounty, PR, commit and developer. Run the audit before claiming."
        });
      }

      // Recompute rather than trust the stored digest: it is a pure function of
      // the same parameters the signature was produced from, and recomputing
      // means the digest handed to the client can never disagree with the bytes
      // the contract will verify.
      const claimParams = {
        bountyId,
        devWallet: devWallet as Address,
        commitHash,
        prUrl,
        contractAddress: contractAddress as Address,
        chainId
      };

      return reply.code(200).send({
        authorized: true,
        signature: audit.signature as Hex,
        rawHash: computeRawClaimHash(claimParams),
        digest: computeClaimDigest(claimParams),
        verdict: audit.aiVerdict,
        score: audit.aiScore,
        auditLogId: audit.id
      });
    }
  );

  // ─── Claim settlement ───
  // Called by the browser once claimBounty() has a receipt. The agent does not
  // take the client's word for it: the tx is read back from BSC testnet and must
  // have emitted BountyClaimed for this bountyId and this developer. Only then
  // is the audit marked claimed, because that status is what keeps an already
  // paid bounty from being listed as claimable again.
  app.post(
    "/api/claim/confirm",
    async (
      request: FastifyRequest<{
        Body: { bountyId: number; txHash: string; devWallet?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { bountyId, txHash, devWallet } = request.body;

      if (bountyId === undefined || !txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return reply.code(400).send({ error: "bountyId and a 32-byte txHash are required" });
      }

      const rpcUrl = process.env.BSC_TESTNET_RPC_URL;
      if (!rpcUrl) {
        return reply.code(500).send({ error: "BSC_TESTNET_RPC_URL is not configured on the agent" });
      }

      const escrowAddress = (process.env.ESCROW_CONTRACT_ADDRESS || "0x") as Address;

      const audit = await getLatestAuditForBounty(bountyId);
      if (!audit) {
        return reply.code(404).send({ error: `No audit exists for bounty ${bountyId}` });
      }

      if (audit.status === "claimed" && audit.claimTxHash) {
        return reply.code(200).send({
          confirmed: true,
          alreadyConfirmed: true,
          txHash: audit.claimTxHash
        });
      }

      const verification = await verifyClaimOnChain({
        txHash: txHash as Hex,
        bountyId,
        // Default to the audited developer rather than trusting the caller: the
        // audit row already names who was paid, so an omitted or wrong devWallet
        // cannot let someone else's claim settle this bounty.
        expectedDeveloper: (devWallet as Address | undefined) ?? (audit.developer as Address),
        escrowAddress,
        rpcUrl
      });

      if (!verification.ok) {
        return reply.code(409).send({ confirmed: false, error: verification.reason });
      }

      // The event carries the scope the contract actually paid out. Prefer those
      // over the client-supplied pair so the stored audit row cannot disagree
      // with the signature the contract verified.
      const updated = await updateAuditLog(audit.id, {
        status: "claimed",
        claimTxHash: txHash,
        prUrl: verification.prUrl,
        commitHash: verification.commitHash
      });

      await updateBountyStatus(bountyId, "claimed");

      return reply.code(200).send({
        confirmed: true,
        alreadyConfirmed: false,
        txHash,
        blockNumber: verification.blockNumber.toString(),
        developer: verification.developer,
        auditLogId: updated?.id ?? audit.id
      });
    }
  );
}
