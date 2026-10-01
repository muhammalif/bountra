import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createAuditLog,
  createBountyRecord,
  createDatabaseConnection,
  listPassedAuditsByDeveloper
} from "../src/db/index.js";
import type { NewAuditLog } from "../src/db/schema.js";

const DEVELOPER = "0xb8b97f88c083C7ba58a3a7d8d276acf98fc3f1bb";
const PR_URL = "https://github.com/bountra/demo/pull/42";
const COMMIT_HASH = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

async function seedBounty(db: Parameters<typeof createAuditLog>[1], bountyId: number) {
  await createBountyRecord(
    {
      bountyId,
      issueUrl: `https://github.com/bountra/demo/issues/${bountyId}`,
      repoOwner: "bountra",
      repoName: "demo",
      issueNum: bountyId,
      creator: "0x1111111111111111111111111111111111111111",
      token: "0x2222222222222222222222222222222222222222",
      amount: "50000000000000000000",
      deadline: 1_900_000_000,
      status: "open"
    },
    db
  );
}

async function seedAudit(db: Parameters<typeof createAuditLog>[1], data: Partial<NewAuditLog>) {
  return createAuditLog(
    {
      bountyId: 1,
      prUrl: PR_URL,
      commitHash: COMMIT_HASH,
      developer: DEVELOPER,
      ciStatus: "passed",
      integrityOk: 1,
      aiScore: 95,
      aiVerdict: "passed",
      aiComment: "All acceptance criteria pass.",
      signature: null,
      status: "passed",
      ...data
    },
    db
  );
}

describe("Developer claim eligibility", () => {
  it("returns exactly one passed audit for multiple rows sharing a bounty", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db, 101);
      await seedAudit(db, {
        bountyId: 101,
        commitHash: "b".repeat(40),
        signature: "0xolder-signature"
      });
      await seedAudit(db, {
        bountyId: 101,
        commitHash: "c".repeat(40),
        signature: "0xnewer-signature"
      });

      const rows = await listPassedAuditsByDeveloper(DEVELOPER, db);

      assert.equal(rows.length, 1);
      assert.equal(rows[0].bountyId, 101);
    } finally {
      sqlite.close();
    }
  });

  it("returns one row per bounty and orders results by bounty id", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db, 202);
      await seedBounty(db, 101);
      await seedAudit(db, {
        bountyId: 202,
        commitHash: "d".repeat(40),
        signature: "0x202-a"
      });
      await seedAudit(db, {
        bountyId: 202,
        commitHash: "e".repeat(40),
        signature: "0x202-b"
      });
      await seedAudit(db, { bountyId: 101, signature: "0x101" });

      const rows = await listPassedAuditsByDeveloper(DEVELOPER, db);

      assert.equal(rows.length, 2);
      assert.deepEqual(rows.map((row) => row.bountyId), [101, 202]);
    } finally {
      sqlite.close();
    }
  });

  it("prefers the signature-bearing row over a newer unsigned row", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db, 303);
      const signed = await seedAudit(db, {
        bountyId: 303,
        commitHash: "f".repeat(40),
        signature: "0xusable-signature"
      });
      await seedAudit(db, { bountyId: 303, commitHash: "0".repeat(40), signature: null });

      const rows = await listPassedAuditsByDeveloper(DEVELOPER, db);

      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, signed.id);
      assert.equal(rows[0].signature, "0xusable-signature");
    } finally {
      sqlite.close();
    }
  });

  it("excludes failed and error rows for a bounty", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db, 404);
      await seedAudit(db, {
        bountyId: 404,
        commitHash: "1".repeat(40),
        signature: "0xpassed"
      });
      await seedAudit(db, {
        bountyId: 404,
        commitHash: "2".repeat(40),
        status: "failed",
        signature: "0xfailed"
      });
      await seedAudit(db, {
        bountyId: 404,
        commitHash: "3".repeat(40),
        status: "error",
        signature: "0xerror"
      });

      const rows = await listPassedAuditsByDeveloper(DEVELOPER, db);

      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "passed");
      assert.equal(rows[0].signature, "0xpassed");
    } finally {
      sqlite.close();
    }
  });
});
