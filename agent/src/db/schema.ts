import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const bounties = sqliteTable(
  "bounties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bountyId: integer("bounty_id").notNull().unique(),
    issueUrl: text("issue_url").notNull(),
    repoOwner: text("repo_owner").notNull(),
    repoName: text("repo_name").notNull(),
    issueNum: integer("issue_num"),
    creator: text("creator").notNull(),
    token: text("token").notNull(),
    amount: text("amount").notNull(),
    deadline: integer("deadline").notNull(),
    status: text("status").notNull(), // 'open' | 'claimed' | 'cancelled'
    txHash: text("tx_hash"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    uniqueIndex("idx_bounties_bounty_id").on(table.bountyId),
    index("idx_bounties_status").on(table.status)
  ]
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bountyId: integer("bounty_id").notNull().references(() => bounties.bountyId),
    prUrl: text("pr_url").notNull(),
    commitHash: text("commit_hash").notNull(),
    developer: text("developer").notNull(),
    ciStatus: text("ci_status"), // 'passed' | 'failed'
    ciDetail: text("ci_detail"), // JSON string
    integrityOk: integer("integrity_ok"), // 0 | 1
    aiScore: integer("ai_score"), // 0-100
    aiVerdict: text("ai_verdict"), // 'passed' | 'failed'
    aiComment: text("ai_comment"),
    signature: text("signature"), // ECDSA hex
    claimTxHash: text("claim_tx_hash"),
    status: text("status").notNull(), // 'pending' | 'passed' | 'failed' | 'claimed'
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index("idx_audit_logs_bounty_id").on(table.bountyId),
    index("idx_audit_logs_status").on(table.status),
    uniqueIndex("idx_audit_logs_bounty_commit_hash").on(table.bountyId, table.commitHash)
  ]
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bountyId: integer("bounty_id").references(() => bounties.bountyId),
    eventType: text("event_type").notNull(), // 'pull_request.opened' | 'pull_request.synchronize'
    prNumber: integer("pr_number"),
    prUrl: text("pr_url").notNull(),
    sender: text("sender").notNull(),
    commitHash: text("commit_hash").notNull(),
    payloadHash: text("payload_hash").notNull().unique(),
    processed: integer("processed").default(0),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    uniqueIndex("idx_webhook_payload_hash").on(table.payloadHash)
  ]
);

export type Bounty = InferSelectModel<typeof bounties>;
export type NewBounty = InferInsertModel<typeof bounties>;

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

export type WebhookEvent = InferSelectModel<typeof webhookEvents>;
export type NewWebhookEvent = InferInsertModel<typeof webhookEvents>;
