/**
 * Chain → DB reconciliation.
 *
 * The escrow contract is the only authority on money. The agent's SQLite copy
 * of a bounty was written by whoever registered it, at that moment, from
 * whatever they typed — so it drifts. Two ways it drifts, both observed on
 * BSC testnet:
 *
 *  1. **Missing rows.** `bounties` 1..4 existed on-chain with the sponsor's
 *     funds locked, but no row in the agent DB. The webhook resolves a bounty
 *     by matching the PR's `Closes <issueUrl>` against `bounties.issue_url`
 *     (`routes/webhook.ts`), so a PR against one of those bounties was answered
 *     "No active bounty found associated with this PR" — the product's main
 *     flow dead-ended on real, funded bounties.
 *  2. **Stale status.** Bounty 0 read `status = 'open'` in the DB while the
 *     contract said `claimed = true`, because the claim was settled from a
 *     browser and nothing wrote the status back. Anything reading the DB row
 *     then advertised an unfunded-looking, already-paid bounty as claimable.
 *
 * Reconcile closes both by making the DB a projection of the chain: insert
 * every on-chain bounty that has no row, and overwrite `status` from the
 * contract's own `claimed` / `cancelled` flags. It never invents a row for an
 * id the contract does not have, and it never deletes — audit_logs carries a
 * foreign key onto bounties.bounty_id.
 *
 * Fields the chain cannot supply honestly are stored as they are on-chain, not
 * as what would be convenient: `issue_url` keeps whatever the sponsor passed at
 * creation time (which may be a placeholder that resolves to no real GitHub
 * issue). `repo_owner` / `repo_name` / `issue_num` are derived from that URL
 * because the column set is `notNull`, and an unparseable URL degrades to
 * `unknown` rather than to a fabricated repo.
 *
 * The amount is written in wei, matching the contract the agent's own
 * `POST /api/bounties` enforces (`BigInt(body.amount) === onChain.amount`,
 * `routes/api.ts`). Rows written before that validation existed may hold human
 * units; reconciliation normalises them.
 */
import { getBountyById, createBountyRecord, updateBountyStatus, listBounties } from "../db/index.js";
import { parseGithubIssueOrPrUrl } from "../github/client.js";
import type { BountyReader, BountyCountReader } from "./readBounty.js";

export interface ReconcileReport {
  /** On-chain bounty ids the contract currently exposes. */
  onChainIds: number[];
  /** Rows inserted because the DB had no record of the bounty. */
  inserted: number[];
  /** Rows whose status disagreed with `claimed` / `cancelled`. */
  statusCorrected: Array<{ bountyId: number; from: string; to: string }>;
  /**
   * On-chain bounties whose `issueUrl` is not a parseable GitHub URL. The row
   * is registered, but a PR can never match it through the webhook mapper, so
   * this is reported rather than hidden.
   */
  unresolvableIssueUrls: Array<{ bountyId: number; issueUrl: string }>;
  /** DB rows whose bounty id no longer exists on-chain. Reported, never deleted. */
  orphanedIds: number[];
  /** Bounty ids the RPC could not be read for. */
  unreadable: Array<{ bountyId: number; reason: string }>;
}

export interface ReconcileResult {
  report: ReconcileReport;
  /** Rows the contract reports as claimed or cancelled, by id. */
  claimed: number[];
  cancelled: number[];
}

/**
 * Chain flags → DB status.
 *
 * `cancelled` is checked first even though the contract makes the two flags
 * mutually exclusive (`claimBounty` requires `!cancelled`, `cancelBounty`
 * requires `!claimed`). If a read ever returned both, "cancelled" is the honest
 * label: it means the escrow was refunded to the sponsor, so calling the bounty
 * claimed would advertise money that was never paid out.
 */
function statusFromChain(bounty: { claimed: boolean; cancelled: boolean }): "claimed" | "cancelled" | "open" {
  if (bounty.cancelled) return "cancelled";
  if (bounty.claimed) return "claimed";
  return "open";
}

/**
 * Read every bounty the contract knows about and make the DB agree.
 *
 * Bounded by `bountyCount` from the contract itself, so a chain with many
 * bounties costs one `bountyCount` read plus one read per bounty.
 */
export async function reconcileBounties(
  bountyReader: BountyReader,
  bountyCountReader: BountyCountReader
): Promise<ReconcileResult> {
  const report: ReconcileReport = {
    onChainIds: [],
    inserted: [],
    statusCorrected: [],
    unresolvableIssueUrls: [],
    orphanedIds: [],
    unreadable: []
  };

  let total: bigint;
  try {
    total = await bountyCountReader();
  } catch (err: unknown) {
    throw new Error(`Unable to read bountyCount from BSC testnet RPC: ${err instanceof Error ? err.message : String(err)}`);
  }

  const ids = Array.from({ length: Number(total) }, (_, i) => i);
  const seen = new Set<number>();
  const claimed: number[] = [];
  const cancelled: number[] = [];

  for (const bountyId of ids) {
    const result = await bountyReader(bountyId);
    if (!result.ok) {
      report.unreadable.push({ bountyId, reason: result.reason });
      continue;
    }

    seen.add(bountyId);
    report.onChainIds.push(bountyId);

    const chainStatus = statusFromChain(result.bounty);
    if (chainStatus === "claimed") claimed.push(bountyId);
    if (chainStatus === "cancelled") cancelled.push(bountyId);

    const parsed = parseGithubIssueOrPrUrl(result.bounty.issueUrl);
    if (!parsed) {
      report.unresolvableIssueUrls.push({ bountyId, issueUrl: result.bounty.issueUrl });
    }

    const existing = await getBountyById(bountyId);

    if (!existing) {
      await createBountyRecord({
        bountyId,
        issueUrl: result.bounty.issueUrl,
        repoOwner: parsed?.owner ?? "unknown",
        repoName: parsed?.repo ?? "unknown",
        issueNum: parsed?.issueOrPrNumber ?? null,
        creator: result.bounty.creator,
        token: result.bounty.token,
        amount: result.bounty.amount.toString(),
        deadline: Number(result.bounty.deadline),
        status: chainStatus
      });
      report.inserted.push(bountyId);
      continue;
    }

    if (existing.status !== chainStatus) {
      await updateBountyStatus(bountyId, chainStatus);
      report.statusCorrected.push({ bountyId, from: existing.status, to: chainStatus });
    }
  }

  const dbRows = await listBounties();
  for (const row of dbRows) {
    if (!seen.has(row.bountyId)) {
      report.orphanedIds.push(row.bountyId);
    }
  }

  return { report, claimed, cancelled };
}

/** One-line summary suitable for a startup log. */
export function formatReconcileReport(result: ReconcileResult): string {
  const r = result.report;
  const parts = [
    `on-chain=${r.onChainIds.length}`,
    `inserted=${r.inserted.length}${r.inserted.length ? ` [${r.inserted.join(",")}]` : ""}`,
    `status-corrected=${r.statusCorrected.length}${
      r.statusCorrected.length ? ` [${r.statusCorrected.map((c) => `${c.bountyId}:${c.from}->${c.to}`).join(",")}]` : ""
    }`,
    `claimed=${result.claimed.length}`,
    `unreadable=${r.unreadable.length}`,
    `unresolvable-issue-url=${r.unresolvableIssueUrls.length}`,
    `orphaned=${r.orphanedIds.length}${r.orphanedIds.length ? ` [${r.orphanedIds.join(",")}]` : ""}`
  ];
  return parts.join(" ");
}