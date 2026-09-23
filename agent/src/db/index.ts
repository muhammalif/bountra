import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import * as schema from "./schema.js";
import type { NewBounty, NewAuditLog, NewWebhookEvent } from "./schema.js";

const DEFAULT_DB_PATH = process.env.DATABASE_PATH || "./data/bountra.db";

export function createDatabaseConnection(dbPath: string = DEFAULT_DB_PATH) {
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

// Default instance for application runtime
export const { sqlite, db } = createDatabaseConnection();

// ==========================================
// DB Helper Functions
// ==========================================

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
  return dbInstance.insert(schema.auditLogs).values(data).returning().get();
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

export async function recordWebhookEvent(data: NewWebhookEvent, dbInstance = db) {
  return dbInstance.insert(schema.webhookEvents).values(data).returning().get();
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
