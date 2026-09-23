import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listBounties,
  getBountyById,
  createBountyRecord,
  getAuditLogByBountyId,
  createAuditLog,
  updateBountyStatus
} from "../db/index.js";
import { signBountyClaim } from "../signer/index.js";
import { evaluatePrWithGemini, mockEvaluatePr } from "../evaluator/gemini.js";
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
      if (!body.bountyId || !body.issueUrl || !body.creator || !body.token || !body.amount) {
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

      if (!bountyId || !prUrl || !commitHash || !devWallet) {
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

      const aiResult = process.env.GEMINI_API_KEY
        ? await evaluatePrWithGemini({ issueTitle, issueBody, prTitle, prBody, diff })
        : mockEvaluatePr({ issueTitle, issueBody, prTitle, prBody, diff });

      let signature: Hex | null = null;
      let rawHash: Hex | null = null;
      let digest: Hex | null = null;

      if (aiResult.verdict === "passed" && !aiResult.tamperingDetected) {
        const privateKey = (process.env.AGENT_PRIVATE_KEY ||
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Hex;

        const signResult = await signBountyClaim(
          {
            bountyId,
            devWallet: devWallet as Address,
            commitHash,
            prUrl,
            contractAddress,
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
}
