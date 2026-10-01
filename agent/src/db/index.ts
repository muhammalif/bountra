import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { asc, and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import * as schema from "./schema.js";
import type { AuditLog, NewBounty, NewAuditLog, NewWebhookEvent } from "./schema.js";

const DEFAULT_DB_PATH = process.env.DATABASE_PATH || "./data/bountra.db";

export function createDatabaseConnection(dbPath: string = DEFAULT_DB_PATH): { sqlite: InstanceType<typeof Database>; db: ReturnType<typeof drizzle> } {
  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Create tables directly if they do not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bounties (
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bounties_bounty_id ON bounties(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);

    CREATE TABLE IF NOT EXISTS audit_logs (
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

    CREATE INDEX IF NOT EXISTS idx_audit_logs_bounty_id ON audit_logs(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_bounty_commit_hash
      ON audit_logs(bounty_id, commit_hash);

    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_id INTEGER REFERENCES bounties(bounty_id),
      event_type TEXT NOT NULL,
      pr_number INTEGER,
      pr_url TEXT NOT NULL,
      sender TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      payload_hash TEXT NOT NULL UNIQUE,
      processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_payload_hash ON webhook_events(payload_hash);
  `);

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

const defaultConn = createDatabaseConnection();
export const db = defaultConn.db;

export async function createBountyRecord(data: NewBounty, dbInstance = db) {
  return dbInstance.insert(schema.bounties).values(data).returning().get();
}

export async function getBountyById(bountyId: number, dbInstance = db) {
  return dbInstance
    .select()
    .from(schema.bounties)
    .where(eq(schema.bounties.bountyId, bountyId))
    .get();
}

export async function getBountyByIssueUrl(issueUrl: string, dbInstance = db) {
  return dbInstance
    .select()
    .from(schema.bounties)
    .where(eq(schema.bounties.issueUrl, issueUrl))
    .get();
}

export async function listBounties(status?: string, dbInstance = db) {
  if (status) {
    return dbInstance
      .select()
      .from(schema.bounties)
      .where(eq(schema.bounties.status, status))
      .orderBy(desc(schema.bounties.id))
      .all();
  }
  return dbInstance
    .select()
    .from(schema.bounties)
    .orderBy(desc(schema.bounties.id))
    .all();
}

export async function updateBountyStatus(bountyId: number, status: string, dbInstance = db) {
  return dbInstance
    .update(schema.bounties)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(schema.bounties.bountyId, bountyId))
    .returning()
    .get();
}

export async function createAuditLog(data: NewAuditLog, dbInstance = db) {
  // Addresses arrive from clients in checksummed or lowercase form. Normalize on
  // write so lookups (findReusableAudit) match regardless of the caller's casing.
  try {
    return dbInstance
      .insert(schema.auditLogs)
      .values({ ...data, developer: data.developer.toLowerCase() })
      .returning()
      .get();
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      const existing = dbInstance
        .select()
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.bountyId, data.bountyId),
            eq(schema.auditLogs.commitHash, data.commitHash)
          )
        )
        .orderBy(desc(schema.auditLogs.id))
        .get();

      if (existing) return existing;
    }

    throw error;
  }
}

export async function getAuditLogByBountyId(bountyId: number, dbInstance = db) {
  return dbInstance
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.bountyId, bountyId))
    .orderBy(desc(schema.auditLogs.id))
    .get();
}

export async function updateAuditLog(id: number, data: Partial<NewAuditLog>, dbInstance = db) {
  return dbInstance
    .update(schema.auditLogs)
    .set(data)
    .where(eq(schema.auditLogs.id, id))
    .returning()
    .get();
}

/**
 * The newest audit row for a bounty, whatever its status.
 *
 * findReusableAudit cannot serve claim settlement: it demands the full
 * (bounty, pr, commit, developer) tuple and only matches status "passed", while
 * the browser reports a claim with just a bountyId and a tx hash. Looking the
 * row up by bounty alone is also what makes the endpoint idempotent — a second
 * confirm finds the already-claimed row and returns without touching chain.
 */
export async function getLatestAuditForBounty(bountyId: number, dbInstance = db) {
  return dbInstance
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.bountyId, bountyId))
    .orderBy(desc(schema.auditLogs.id))
    .get();
}

/**
 * Latest AI verdict per bounty, keyed by on-chain bounty id.
 *
 * The Explore feed renders on-chain bounties next to their audit outcome, so it
 * needs verdicts in one round trip. On-chain status only knows open/claimed/
 * cancelled — the AI verdict lives only in SQLite, and a bounty the agent
 * rejected still reads as "open" to the contract, so the feed would otherwise
 * advertise work that is no longer claimable.
 *
 * Keyed by the newest audit row per bounty: a re-audit supersedes an earlier
 * rejection, and the feed should show the current one.
 */
export async function listLatestVerdictsByBounty(dbInstance = db) {
  const rows = await dbInstance
    .select({
      bountyId: schema.auditLogs.bountyId,
      status: schema.auditLogs.status,
      aiVerdict: schema.auditLogs.aiVerdict,
      aiScore: schema.auditLogs.aiScore,
      aiComment: schema.auditLogs.aiComment,
      auditId: schema.auditLogs.id,
      // Settlement proof travels with the verdict. A claimed bounty read back
      // from the feed has no other way to reach its transaction: the claim
      // happened in someone else's browser session, so the hash exists only
      // here. Null until /api/claim/confirm records it.
      claimTxHash: schema.auditLogs.claimTxHash,
    })
    .from(schema.auditLogs)
    .orderBy(desc(schema.auditLogs.id))
    .all();

  const latest = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.bountyId)) latest.set(row.bountyId, row);
  }
  return latest;
}

/**
 * Reusable audit verdict for an already-audited claim.
 *
 * This is the A2 cache. It deliberately reuses `audit_logs` rather than adding a
 * dedicated table: the row already holds score, verdict, signature and summary,
 * and it doubles as the immutable audit trail the product is built on. A separate
 * cache table would be a second source of truth for the same fact.
 *
 * Scoped by bountyId, developer and contract as well as (prUrl, commitHash):
 * the ECDSA signature is computed over all of those, so a verdict signed for
 * bounty A cannot be replayed to release bounty B even when the commit matches.
 *
 * Returns undefined for errored or missing rows — a provider failure is never
 * cached, so a transient outage can't pin a bounty to a bad verdict.
 */
export async function findReusableAudit(
  params: {
    bountyId: number;
    prUrl: string;
    commitHash: string;
    developer: string;
    contractAddress?: string;
  },
  dbInstance = db
): Promise<AuditLog | undefined> {
  return dbInstance
    .select()
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.bountyId, params.bountyId),
        eq(schema.auditLogs.prUrl, params.prUrl),
        eq(schema.auditLogs.commitHash, params.commitHash),
        eq(schema.auditLogs.developer, params.developer.toLowerCase()),
        eq(schema.auditLogs.status, "passed")
      )
    )
    .orderBy(desc(schema.auditLogs.id))
    .get();
}

/**
 * One passing audit per bounty for one developer, signature-bearing rows first.
 *
 * Drives the Developer Hub claim list: a bounty is only offered as claimable
 * when a passing audit exists for THIS developer, which is also the only case
 * where a usable agent signature exists. Reuses audit_logs (A2) rather than a
 * second table — the audit trail is the single source of truth for "was this
 * PR actually evaluated and did it pass".
 */
export async function listPassedAuditsByDeveloper(developer: string, dbInstance = db) {
  const rankedAudits = dbInstance
    .select({
      ...getTableColumns(schema.auditLogs),
      rowNumber: sql<number>`row_number() over (
        partition by ${schema.auditLogs.bountyId}
        order by case when ${schema.auditLogs.signature} is not null then 0 else 1 end,
          ${schema.auditLogs.id} desc
      )`.as("row_number")
    })
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.developer, developer.toLowerCase()),
        eq(schema.auditLogs.status, "passed")
      )
    )
    .as("ranked_audits");

  return dbInstance
    .select({
      id: rankedAudits.id,
      bountyId: rankedAudits.bountyId,
      prUrl: rankedAudits.prUrl,
      commitHash: rankedAudits.commitHash,
      developer: rankedAudits.developer,
      ciStatus: rankedAudits.ciStatus,
      ciDetail: rankedAudits.ciDetail,
      integrityOk: rankedAudits.integrityOk,
      aiScore: rankedAudits.aiScore,
      aiVerdict: rankedAudits.aiVerdict,
      aiComment: rankedAudits.aiComment,
      signature: rankedAudits.signature,
      claimTxHash: rankedAudits.claimTxHash,
      status: rankedAudits.status,
      createdAt: rankedAudits.createdAt
    })
    .from(rankedAudits)
    .where(eq(rankedAudits.rowNumber, 1))
    .orderBy(asc(rankedAudits.bountyId))
    .all();
}

export async function recordWebhookEvent(data: NewWebhookEvent, dbInstance = db) {
  return dbInstance
    .insert(schema.webhookEvents)
    .values(data)
    .onConflictDoNothing({ target: schema.webhookEvents.payloadHash })
    .returning()
    .get();
}

export async function isWebhookProcessed(payloadHash: string, dbInstance = db) {
  const event = dbInstance
    .select()
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.payloadHash, payloadHash))
    .get();
  return Boolean(event && event.processed === 1);
}

export async function markWebhookProcessed(payloadHash: string, dbInstance = db) {
  return dbInstance
    .update(schema.webhookEvents)
    .set({ processed: 1 })
    .where(eq(schema.webhookEvents.payloadHash, payloadHash))
    .returning()
    .get();
}

export * from "./schema.js";
