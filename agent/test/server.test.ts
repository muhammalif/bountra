import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/index.js";
import { createPassingGithubClient } from "./github-mock.js";

describe("Fastify Webhook Server & Audit Pipeline Integration", () => {
  const app = buildServer({ githubClient: createPassingGithubClient() });
  const testBountyId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 10000);

  it("should return healthy status on GET /health", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "ok");
    assert.equal(body.service, "bountra-agent");
  });

  it("should create, list and retrieve bounty via API", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/bounties",
      payload: {
        bountyId: testBountyId,
        issueUrl: `https://github.com/bountra/demo/issues/${testBountyId}`,
        repoOwner: "bountra",
        repoName: "demo",
        issueNum: testBountyId,
        creator: "0x1111111111111111111111111111111111111111",
        token: "0x2222222222222222222222222222222222222222",
        amount: "50000000000000000000",
        deadline: Math.floor(Date.now() / 1000) + 86400
      }
    });

    assert.equal(createRes.statusCode, 201);
    const createdData = JSON.parse(createRes.body).data;
    assert.equal(createdData.bountyId, testBountyId);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/bounties"
    });
    assert.equal(listRes.statusCode, 200);
    const listData = JSON.parse(listRes.body).data;
    assert.ok(listData.some((b: { bountyId: number }) => b.bountyId === testBountyId));

    const getRes = await app.inject({
      method: "GET",
      url: `/api/bounties/${testBountyId}`
    });
    assert.equal(getRes.statusCode, 200);
    const singleData = JSON.parse(getRes.body).data;
    assert.equal(singleData.bountyId, testBountyId);
  });

  it("should evaluate PR and produce valid signature on POST /api/audit/evaluate", async () => {
    const auditRes = await app.inject({
      method: "POST",
      url: "/api/audit/evaluate",
      payload: {
        bountyId: testBountyId,
        prUrl: "https://github.com/bountra/demo/pull/1",
        commitHash: "9876543210abcdef9876543210abcdef98765432",
        devWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        issueTitle: "Fix race condition in pool",
        issueBody: "Must acquire lock before state mutation",
        prTitle: "fix: acquire lock before mutation",
        prBody: `Resolves #${testBountyId}`,
        diff: "+ mutex.lock(); state.mutate(); mutex.unlock();",
        changedFiles: [{ filename: "src/pool.ts", status: "modified" }]
      }
    });

    assert.equal(auditRes.statusCode, 200);
    const body = JSON.parse(auditRes.body);
    assert.equal(body.success, true);
    assert.equal(body.verdict, "passed");
    assert.ok(body.signature);
    assert.ok(body.signature.startsWith("0x"));
    assert.ok(body.auditLog);
    assert.equal(body.auditLog.bountyId, testBountyId);
  });

  it("should reject tampered PR in audit evaluation", async () => {
    const tamperedRes = await app.inject({
      method: "POST",
      url: "/api/audit/evaluate",
      payload: {
        bountyId: testBountyId,
        prUrl: "https://github.com/bountra/demo/pull/2",
        commitHash: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        devWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        diff: "+ // test modification",
        changedFiles: [{ filename: "contracts/test/BountraEscrow.t.sol", status: "modified" }]
      }
    });

    assert.equal(tamperedRes.statusCode, 200);
    const body = JSON.parse(tamperedRes.body);
    assert.equal(body.success, false);
    assert.equal(body.verdict, "failed");
    assert.ok(body.reason.includes("test/CI modification"));
    assert.equal(body.signature, undefined);
  });
});
