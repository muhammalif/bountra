import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createAuditLog,
  createBountyRecord,
  createDatabaseConnection
} from "../src/db/index.js";
import type { NewAuditLog } from "../src/db/schema.js";
import { auditLogs } from "../src/db/schema.js";

type Database = Parameters<typeof createAuditLog>[1];

const DEVELOPER = "0x3333333333333333333333333333333333333333";
const PR_URL = "https://github.com/bountra/demo/pull/15";

async function seedBounty(db: Database, bountyId: number) {
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

function auditData(bountyId: number, commitHash: string): NewAuditLog {
  return {
    bountyId,
    prUrl: PR_URL,
    commitHash,
    developer: DEVELOPER,
    ciStatus: "passed",
    integrityOk: 1,
    aiScore: 95,
    aiVerdict: "passed",
    aiComment: "All acceptance criteria pass.",
    signature: "0xsignature",
    status: "passed"
  };
}

describe("audit log identity constraint", () => {
  it("rejects a duplicate bounty and commit pair with a SQLite constraint error", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    const data = auditData(1, "a".repeat(40));

    try {
      await seedBounty(db, 1);
      await createAuditLog(data, db);

      await assert.rejects(
        async () => db.insert(auditLogs).values(data).returning().get(),
        (error: unknown) => {
          assert.equal((error as { code?: string }).code, "SQLITE_CONSTRAINT_UNIQUE");
          assert.match(
            String((error as { message?: string }).message),
            /UNIQUE constraint failed: audit_logs\.bounty_id, audit_logs\.commit_hash/
          );
          return true;
        }
      );
    } finally {
      sqlite.close();
    }
  });

  it("allows the same commit hash for different bounties", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    const commitHash = "b".repeat(40);

    try {
      await seedBounty(db, 1);
      await seedBounty(db, 2);
      const first = await createAuditLog(auditData(1, commitHash), db);
      const second = await createAuditLog(auditData(2, commitHash), db);

      assert.notEqual(first.id, second.id);
    } finally {
      sqlite.close();
    }
  });

  it("allows different commit hashes for the same bounty", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");

    try {
      await seedBounty(db, 3);
      const first = await createAuditLog(auditData(3, "c".repeat(40)), db);
      const second = await createAuditLog(auditData(3, "d".repeat(40)), db);

      assert.notEqual(first.id, second.id);
    } finally {
      sqlite.close();
    }
  });

  it("returns the stored row when a concurrent duplicate loses the insert race", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    const data = auditData(4, "e".repeat(40));

    try {
      await seedBounty(db, 4);
      const first = await createAuditLog(data, db);
      const duplicate = await createAuditLog(
        { ...data, aiComment: "A second evaluation should not replace the first." },
        db
      );

      assert.equal(duplicate.id, first.id);
      assert.equal(db.select().from(auditLogs).all().length, 1);
    } finally {
      sqlite.close();
    }
  });
});
