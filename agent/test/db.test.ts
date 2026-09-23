import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createDatabaseConnection,
  createBountyRecord,
  getBountyById,
  getBountyByIssueUrl,
  listBounties,
  updateBountyStatus,
  createAuditLog,
  getAuditLogByBountyId,
  updateAuditLog,
  recordWebhookEvent,
  isWebhookProcessed,
  markWebhookProcessed
} from "../src/db/index.js";

describe("Database Storage Layer (Drizzle + SQLite)", () => {
  const { sqlite, db } = createDatabaseConnection(":memory:");

  it("should insert and retrieve a bounty record", async () => {
    const bountyData = {
      bountyId: 1,
      issueUrl: "https://github.com/org/repo/issues/10",
      repoOwner: "org",
      repoName: "repo",
      issueNum: 10,
      creator: "0x1111111111111111111111111111111111111111",
      token: "0x2222222222222222222222222222222222222222",
      amount: "150000000000000000000",
      deadline: Math.floor(Date.now() / 1000) + 86400,
      status: "open",
      txHash: "0xabc123"
    };

    const inserted = await createBountyRecord(bountyData, db);
    assert.equal(inserted.bountyId, 1);
    assert.equal(inserted.issueUrl, bountyData.issueUrl);

    const fetched = await getBountyById(1, db);
    assert.ok(fetched);
    assert.equal(fetched.bountyId, 1);
    assert.equal(fetched.status, "open");

    const fetchedByUrl = await getBountyByIssueUrl(bountyData.issueUrl, db);
    assert.ok(fetchedByUrl);
    assert.equal(fetchedByUrl.bountyId, 1);
  });

  it("should update bounty status and list bounties", async () => {
    const updated = await updateBountyStatus(1, "claimed", db);
    assert.equal(updated.status, "claimed");

    const all = await listBounties(undefined, db);
    assert.equal(all.length, 1);

    const claimed = await listBounties("claimed", db);
    assert.equal(claimed.length, 1);

    const open = await listBounties("open", db);
    assert.equal(open.length, 0);
  });

  it("should create and retrieve audit logs", async () => {
    const auditData = {
      bountyId: 1,
      prUrl: "https://github.com/org/repo/pull/15",
      commitHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      developer: "0x3333333333333333333333333333333333333333",
      ciStatus: "passed",
      ciDetail: JSON.stringify({ passed: 12, failed: 0 }),
      integrityOk: 1,
      aiScore: 95,
      aiVerdict: "passed",
      aiComment: "PR passes all test cases and fulfills issue requirements.",
      signature: "0xsignaturehex",
      status: "passed"
    };

    const audit = await createAuditLog(auditData, db);
    assert.ok(audit.id);
    assert.equal(audit.aiScore, 95);

    const fetchedAudit = await getAuditLogByBountyId(1, db);
    assert.ok(fetchedAudit);
    assert.equal(fetchedAudit.commitHash, auditData.commitHash);

    const updatedAudit = await updateAuditLog(
      audit.id,
      { claimTxHash: "0xclaimhash", status: "claimed" },
      db
    );
    assert.equal(updatedAudit.status, "claimed");
    assert.equal(updatedAudit.claimTxHash, "0xclaimhash");
  });

  it("should record and check webhook events for deduplication", async () => {
    const webhookData = {
      bountyId: 1,
      eventType: "pull_request.opened",
      prNumber: 15,
      prUrl: "https://github.com/org/repo/pull/15",
      sender: "dev-alice",
      commitHash: "a1b2c3d4e5f6",
      payloadHash: "hash_payload_12345",
      processed: 0
    };

    await recordWebhookEvent(webhookData, db);

    const isProcessedBefore = await isWebhookProcessed("hash_payload_12345", db);
    assert.equal(isProcessedBefore, false);

    await markWebhookProcessed("hash_payload_12345", db);

    const isProcessedAfter = await isWebhookProcessed("hash_payload_12345", db);
    assert.equal(isProcessedAfter, true);
  });
});
