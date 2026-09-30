import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/index.js";
import { createPassingGithubClient } from "./github-mock.js";
// Unique per run: bounty_id is UNIQUE and the suite shares one on-disk database.
const RUN = Date.now() % 1_000_000;

const DEV = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const DEV_UPPER = DEV.toUpperCase().replace("0X", "0x");
const COMMIT = "9876543210abcdef9876543210abcdef98765432";
const PR = "https://github.com/bountra/demo/pull/1";

function makeApp() {
  return buildServer({ githubClient: createPassingGithubClient() });
}

async function seedBounty(app: any, bountyId: number) {
  const res = await app.inject({
    method: "POST",
    url: "/api/bounties",
    payload: {
      bountyId,
      issueUrl: `https://github.com/bountra/demo/issues/${bountyId}`,
      repoOwner: "bountra",
      repoName: "demo",
      issueNum: bountyId,
      creator: "0x1111111111111111111111111111111111111111",
      token: "0x2222222222222222222222222222222222222222",
      amount: "50000000000000000000",
      deadline: Math.floor(Date.now() / 1000) + 86400
    }
  });
  assert.equal(res.statusCode, 201);
}

async function audit(app: any, bountyId: number, dev = DEV) {
  return app.inject({
    method: "POST",
    url: "/api/audit/evaluate",
    payload: {
      bountyId,
      prUrl: PR,
      commitHash: COMMIT,
      devWallet: dev,
      issueTitle: "Fix race condition",
      issueBody: "Acquire the lock before mutating state",
      prTitle: "fix: lock",
      prBody: "Resolves",
      diff: "+ this.mutex.lock();\n+ try { mutate(); } finally { this.mutex.unlock(); }",
      changedFiles: [{ filename: "src/pool.ts", status: "modified" }]
    }
  });
}

describe("A2 verdict reuse", () => {
  it("serves a second identical audit from cache without calling the provider", async () => {
    const app = makeApp();
    const bountyId = 900001 + RUN;

    await seedBounty(app, bountyId);

    const first = await audit(app, bountyId);
    assert.equal(first.statusCode, 200);
    const firstBody = JSON.parse(first.body);
    assert.equal(firstBody.cached, undefined, "first call must not be cached");
    assert.equal(firstBody.verdict, "passed");
    assert.ok(firstBody.signature, "first call signs");

    const second = await audit(app, bountyId);
    assert.equal(second.statusCode, 200);
    const secondBody = JSON.parse(second.body);

    assert.equal(secondBody.cached, true, "second call served from cache");
    assert.equal(secondBody.verdict, firstBody.verdict);
    assert.equal(secondBody.score, firstBody.score);
    assert.equal(secondBody.signature, firstBody.signature, "signature reused verbatim");
    assert.equal(secondBody.digest, firstBody.digest, "digest must match on first call");
    assert.equal(secondBody.rawHash, firstBody.rawHash, "rawHash must match on first call");
  });

  it("does not reuse a verdict across different bounties sharing one commit", async () => {
    const app = makeApp();
    const bountyA = 900002 + RUN;
    const bountyB = 900003 + RUN;

    await seedBounty(app, bountyA);
    await seedBounty(app, bountyB);

    const a = await audit(app, bountyA);
    assert.equal(a.statusCode, 200);
    const aBody = JSON.parse(a.body);
    assert.equal(aBody.verdict, "passed");

    // Same PR + same commit, different bounty: must NOT hit the cache, and must
    // produce a different digest (the signature is bound to bountyId).
    const b = await audit(app, bountyB);
    assert.equal(b.statusCode, 200);
    const bBody = JSON.parse(b.body);
    assert.notEqual(bBody.digest, aBody.digest, "digest must be bound to bountyId");
  });

  it("matches the developer case-insensitively", async () => {
    const app = makeApp();
    const bountyId = 900004 + RUN;
    await seedBounty(app, bountyId);

    const first = await audit(app, bountyId, DEV);
    assert.equal(JSON.parse(first.body).cached, undefined);

    const second = await audit(app, bountyId, DEV_UPPER);
    const body = JSON.parse(second.body);
    assert.equal(body.cached, true, "wallet casing must not defeat reuse");
  });

  it("never reuses a failed or errored audit", async () => {
    const app = makeApp();
    const bountyId = 900005 + RUN;
    await seedBounty(app, bountyId);

    // No diff => mock evaluator returns failed.
    const res = await app.inject({
      method: "POST",
      url: "/api/audit/evaluate",
      payload: {
        bountyId,
        prUrl: PR,
        commitHash: COMMIT,
        devWallet: DEV,
        issueTitle: "t",
        issueBody: "b",
        prTitle: "p",
        prBody: "b",
        diff: "   ",
        changedFiles: [{ filename: "src/pool.ts", status: "modified" }]
      }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).verdict, "failed");

    const again = await audit(app, bountyId);
    assert.equal(
      JSON.parse(again.body).cached,
      undefined,
      "a failed verdict must be re-evaluated, not replayed"
    );
  });
});
