import Database from "better-sqlite3";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAuditLog,
  createBountyRecord,
  createDatabaseConnection,
  findReusableAudit
} from "../src/db/index.js";
import type { NewAuditLog } from "../src/db/schema.js";

type DatabaseConnection = Parameters<typeof createAuditLog>[1];

const DEVELOPER = "0x3333333333333333333333333333333333333333";
const PR_URL = "https://github.com/bountra/demo/pull/15";
const COMMIT_HASH = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const CONTRACT_A = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const CONTRACT_B = "0xbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbB";
const CHAIN_A = 97;
const CHAIN_B = 561;

async function seedBounty(db: DatabaseConnection) {
  await createBountyRecord(
    {
      bountyId: 1,
      issueUrl: "https://github.com/bountra/demo/issues/1",
      repoOwner: "bountra",
      repoName: "demo",
      issueNum: 1,
      creator: "0x1111111111111111111111111111111111111111",
      token: "0x2222222222222222222222222222222222222222",
      amount: "50000000000000000000",
      deadline: 1_900_000_000,
      status: "open"
    },
    db
  );
}

function auditData(overrides: Partial<NewAuditLog> = {}): NewAuditLog {
  return {
    bountyId: 1,
    prUrl: PR_URL,
    commitHash: COMMIT_HASH,
    developer: DEVELOPER,
    contractAddress: CONTRACT_A,
    chainId: CHAIN_A,
    ciStatus: "passed",
    integrityOk: 1,
    aiScore: 95,
    aiVerdict: "passed",
    aiComment: "All acceptance criteria pass.",
    signature: "0xsignature",
    status: "passed",
    ...overrides
  };
}

describe("audit provenance cache scope", () => {
  it("reuses a passed audit for the same contract and chain", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db);
      const audit = await createAuditLog(auditData(), db);

      const reusable = await findReusableAudit(
        {
          bountyId: 1,
          prUrl: PR_URL,
          commitHash: COMMIT_HASH,
          developer: DEVELOPER,
          contractAddress: CONTRACT_A.toLowerCase(),
          chainId: CHAIN_A
        },
        db
      );

      assert.ok(reusable);
      assert.equal(reusable.id, audit.id);
    } finally {
      sqlite.close();
    }
  });

  it("does not reuse a passed audit for a different contract", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db);
      await createAuditLog(auditData(), db);

      const reusable = await findReusableAudit(
        {
          bountyId: 1,
          prUrl: PR_URL,
          commitHash: COMMIT_HASH,
          developer: DEVELOPER,
          contractAddress: CONTRACT_B,
          chainId: CHAIN_A
        },
        db
      );

      assert.equal(reusable, undefined);
    } finally {
      sqlite.close();
    }
  });

  it("does not reuse a passed audit for a different chain", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db);
      await createAuditLog(auditData(), db);

      const reusable = await findReusableAudit(
        {
          bountyId: 1,
          prUrl: PR_URL,
          commitHash: COMMIT_HASH,
          developer: DEVELOPER,
          contractAddress: CONTRACT_A,
          chainId: CHAIN_B
        },
        db
      );

      assert.equal(reusable, undefined);
    } finally {
      sqlite.close();
    }
  });

  it("does not reuse a legacy row without provenance", async () => {
    const { db, sqlite } = createDatabaseConnection(":memory:");
    try {
      await seedBounty(db);
      await createAuditLog(auditData({ contractAddress: null, chainId: null }), db);

      const reusable = await findReusableAudit(
        {
          bountyId: 1,
          prUrl: PR_URL,
          commitHash: COMMIT_HASH,
          developer: DEVELOPER,
          contractAddress: CONTRACT_A,
          chainId: CHAIN_A
        },
        db
      );
      const omittedProvenance = await findReusableAudit(
        { bountyId: 1, prUrl: PR_URL, commitHash: COMMIT_HASH, developer: DEVELOPER },
        db
      );

      assert.equal(reusable, undefined);
      assert.equal(omittedProvenance, undefined);
    } finally {
      sqlite.close();
    }
  });
});

describe("audit provenance migration", () => {
  it("adds missing columns twice without changing rows", () => {
    const dbPath = path.join(os.tmpdir(), `bountra-audit-provenance-${process.pid}.db`);
    const legacySqlite = new Database(dbPath);
    legacySqlite.exec(`
      CREATE TABLE bounties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bounty_id INTEGER NOT NULL UNIQUE,
        issue_url TEXT NOT NULL,
        repo_owner TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        issue_num INTEGER,
        creator TEXT NOT NULL,
        token TEXT NOT NULL,
        amount TEXT NOT NULL,
        deadline INTEGER NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bounty_id INTEGER NOT NULL REFERENCES bounties(bounty_id),
        pr_url TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        developer TEXT NOT NULL,
        ci_status TEXT,
        ci_detail TEXT,
        integrity_ok INTEGER,
        ai_score INTEGER,
        ai_verdict TEXT,
        ai_comment TEXT,
        signature TEXT,
        claim_tx_hash TEXT,
        status TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO bounties (
        bounty_id, issue_url, repo_owner, repo_name, creator, token, amount, deadline, status
      ) VALUES (1, 'https://github.com/bountra/demo/issues/1', 'bountra', 'demo',
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222', '50', 1900000000, 'open');
      INSERT INTO audit_logs (
        bounty_id, pr_url, commit_hash, developer, status
      ) VALUES (1, 'https://github.com/bountra/demo/pull/15', '${COMMIT_HASH}',
        '${DEVELOPER.toLowerCase()}', 'passed');
    `);
    legacySqlite.close();

    try {
      const first = createDatabaseConnection(dbPath);
      const firstColumns = first.sqlite
        .prepare("PRAGMA table_info(audit_logs)")
        .all()
        .map((column) => (column as { name: string }).name);
      const firstRowCount = first.sqlite
        .prepare("SELECT COUNT(*) AS count FROM audit_logs")
        .get() as { count: number };
      first.sqlite.close();

      const second = createDatabaseConnection(dbPath);
      const secondColumns = second.sqlite
        .prepare("PRAGMA table_info(audit_logs)")
        .all()
        .map((column) => (column as { name: string }).name);
      const secondRowCount = second.sqlite
        .prepare("SELECT COUNT(*) AS count FROM audit_logs")
        .get() as { count: number };

      assert.deepEqual(firstColumns, secondColumns);
      assert.equal(firstRowCount.count, 1);
      assert.equal(secondRowCount.count, 1);
      assert.ok(firstColumns.includes("contract_address"));
      assert.ok(firstColumns.includes("chain_id"));
      second.sqlite.close();
    } finally {
      for (const suffix of ["", "-shm", "-wal"]) {
        rmSync(dbPath + suffix, { force: true });
      }
    }
  });
});
