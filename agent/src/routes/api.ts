import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listBounties,
  getBountyById,
  createBountyRecord,
  getAuditLogByBountyId,
  createAuditLog,
  updateBountyStatus,
  findReusableAudit,
  listPassedAuditsByDeveloper
} from "../db/index.js";
import {
  requireAgentSigningKey,
  signBountyClaim,
  computeRawClaimHash,
  computeClaimDigest
} from "../signer/index.js";
import { evaluatePrWithGemini, mockEvaluatePr, EvaluatorUnavailableError } from "../evaluator/gemini.js";
import { checkTestTampering } from "../evaluator/security.js";
import type { Address, Hex } from "viem";

export async function apiRoutes(app: FastifyInstance) {
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
      if (body.bountyId === undefined || !body.issueUrl || !body.creator || !body.token || !body.amount) {
        return reply.code(400).send({ error: "Missing required fields" });
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

      const tamperingCheck = checkTestTampering(changedFiles);
      if (!tamperingCheck.ok) {
        const audit = await createAuditLog({
          bountyId,
          prUrl,
          commitHash,
          developer: devWallet,
          ciStatus: "passed",
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
            ciStatus: "passed",
            ciDetail: JSON.stringify({ automated: true }),
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
        ciStatus: "passed",
        ciDetail: JSON.stringify({ automated: true }),
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
}
