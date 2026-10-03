import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import type { Address } from "viem";
import { reconcileBounties, formatReconcileReport } from "../src/chain/reconcile.js";
import type { BountyReader, BountyCountReader, OnChainBounty } from "../src/chain/readBounty.js";
import { getBountyById, listBounties, createBountyRecord } from "../src/db/index.js";

/**
 * Chain → DB reconciliation.
 *
 * The escrow contract is the only authority on money, and the agent's SQLite
 * row drifts from it in two ways that both break the product:
 *
 *  - **Missing rows.** A funded on-chain bounty with no row is invisible to the
 *    webhook, which resolves a bounty by matching the PR's `Closes <url>`
 *    against `bounties.issue_url`. A PR against it gets "No active bounty found".
 *  - **Stale status.** A bounty claimed from a browser stays `open` in the DB
 *    until something writes the status back, so the feed advertises an
 *    already-paid bounty as claimable.
 *
 * These assertions pin both, plus the properties that make the repair safe: it
 * never invents a row the contract does not have, never deletes one
 * (audit_logs holds a foreign key onto bounties.bounty_id), and refuses to run
 * at all when the chain cannot be enumerated.
 */

const SPONSOR = "0xA116aBe137640B3C62Aa6b4Be08e79E07d664f13" as Address;
const TOKEN = "0x189C7cA448e89DaF1C2A1C9a4DB4D9Ec475441c1" as Address;
const AMOUNT = 100_000_000_000_000_000_000n;
const REPO = "https://github.com/muhammalif/bountra-demo/issues";

function bounty(issueUrl: string, over: Partial<OnChainBounty> = {}): OnChainBounty {
  return {
    creator: SPONSOR,
    claimed: false,
    cancelled: false,
    token: TOKEN,
    amount: AMOUNT,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 86_400),
    issueUrl,
    ...over
  };
}

/**
 * Low, monotonically increasing ids.
 *
 * Reconciliation walks `0..bountyCount` and inserts a row per on-chain id, so a
 * high id would mean a high `bountyCount` and tens of thousands of inserts into
 * the shared test database. `freshId` hands out each id exactly once per process,
 * which is what the `bounties.bounty_id` unique index needs.
 */
let nextId = 1;
function freshId(): number {
  return nextId++;
}

/**
 * A chain whose bounties are defined by id, with every id in `0..high` present.
 *
 * Reconciliation enumerates that whole range, so the mock answers for the gaps
 * rather than the test allocating an array of `high` entries.
 */
function chain(spec: Record<number, OnChainBounty>): { reader: BountyReader; count: BountyCountReader } {
  const high = Math.max(0, ...Object.keys(spec).map(Number));
  const reader: BountyReader = async (id) => ({
    ok: true,
    bounty: spec[id] ?? bounty(`${REPO}/${id}`)
  });
  const count: BountyCountReader = async () => BigInt(high + 1);
  return { reader, count };
}

describe("reconcileBounties — rows missing from the DB", () => {
  const id = freshId();
  const { reader, count } = chain({ [id]: bounty(`${REPO}/${id}`) });

  before(async () => {
    assert.equal(await getBountyById(id), undefined, "precondition: id must not already exist");
    await reconcileBounties(reader, count);
  });

  it("inserts a funded on-chain bounty the agent never heard about", async () => {
    const row = await getBountyById(id);
    assert.ok(row, "row was not inserted");
    assert.equal(row.creator, SPONSOR);
    assert.equal(row.token, TOKEN);
    assert.equal(row.status, "open");
  });

  it("stores the amount in wei, matching POST /api/bounties validation", async () => {
    // That route rejects anything where BigInt(amount) !== chain amount, so a row
    // written in human units could never be re-registered or audited.
    const row = await getBountyById(id);
    assert.equal(BigInt(row!.amount), AMOUNT);
  });

  it("derives repo and issue number from the on-chain issue URL", async () => {
    const row = await getBountyById(id);
    assert.equal(row!.repoOwner, "muhammalif");
    assert.equal(row!.repoName, "bountra-demo");
    assert.equal(row!.issueNum, id);
  });

  it("is idempotent — a second pass inserts nothing", async () => {
    const { report } = await reconcileBounties(reader, count);
    assert.deepEqual(report.inserted, []);
  });
});

describe("reconcileBounties — status drift", () => {
  it("writes a claimed bounty as claimed", async () => {
    const id = freshId();
    const { reader, count } = chain({ [id]: bounty(`${REPO}/${id}`, { claimed: true }) });

    const { claimed, report } = await reconcileBounties(reader, count);

    // Inserted directly in its final state, so there is nothing to correct.
    assert.equal((await getBountyById(id))!.status, "claimed");
    assert.ok(claimed.includes(id));
    assert.deepEqual(report.inserted, [id]);
    assert.deepEqual(report.statusCorrected, []);
  });

  it("lets cancelled win over claimed", async () => {
    // The contract permits both flags; a cancelled escrow is returned to the
    // sponsor, so presenting it as claimed would be the more misleading label.
    const id = freshId();
    const { reader, count } = chain({ [id]: bounty(`${REPO}/${id}`, { claimed: true, cancelled: true }) });

    await reconcileBounties(reader, count);
    assert.equal((await getBountyById(id))!.status, "cancelled");
  });

  it("corrects a row that was registered as open but has since been claimed", async () => {
    const id = freshId();
    await createBountyRecord({
      bountyId: id,
      issueUrl: `${REPO}/${id}`,
      repoOwner: "muhammalif",
      repoName: "bountra-demo",
      issueNum: id,
      creator: SPONSOR,
      token: TOKEN,
      amount: AMOUNT.toString(),
      deadline: Math.floor(Date.now() / 1000) + 86_400,
      status: "open"
    });

    const { reader, count } = chain({ [id]: bounty(`${REPO}/${id}`, { claimed: true }) });
    const { report } = await reconcileBounties(reader, count);

    assert.equal((await getBountyById(id))!.status, "claimed");
    const correction = report.statusCorrected.find((c) => c.bountyId === id);
    assert.ok(correction, "correction not reported");
    assert.equal(correction!.from, "open");
    assert.equal(correction!.to, "claimed");
  });

  it("leaves an already-correct row untouched", async () => {
    const id = freshId();
    const { reader, count } = chain({ [id]: bounty(`${REPO}/${id}`) });
    await reconcileBounties(reader, count);

    const { report } = await reconcileBounties(reader, count);
    assert.equal(report.statusCorrected.length, 0);
  });
});

describe("reconcileBounties — what it must not do", () => {
  it("never invents a row for an id the contract cannot confirm", async () => {
    const reader: BountyReader = async () => ({ ok: false, reason: "execution reverted", statusCode: 502 });
    const count: BountyCountReader = async () => 3n;

    const { report } = await reconcileBounties(reader, count);

    assert.deepEqual(report.inserted, []);
    assert.equal(report.onChainIds.length, 0);
    assert.equal(report.unreadable.length, 3);
  });

  it("reports a DB row the chain does not have instead of deleting it", async () => {
    const real = freshId();
    // Must sit ABOVE the chain's high-water mark, otherwise the reconciler
    // enumerates it and legitimately treats it as on-chain.
    const ghost = freshId();
    await createBountyRecord({
      bountyId: ghost,
      issueUrl: `${REPO}/${ghost}`,
      repoOwner: "muhammalif",
      repoName: "bountra-demo",
      issueNum: ghost,
      creator: SPONSOR,
      token: TOKEN,
      amount: AMOUNT.toString(),
      deadline: Math.floor(Date.now() / 1000) + 86_400,
      status: "open"
    });

    const { reader, count } = chain({ [real]: bounty(`${REPO}/${real}`) });
    const { report } = await reconcileBounties(reader, count);

    assert.ok(report.orphanedIds.includes(ghost), "orphan not reported");
    assert.ok(
      (await listBounties()).some((r) => r.bountyId === ghost),
      "reconcile deleted a row; audit_logs has a foreign key onto it"
    );
  });

  it("reports an issue URL that cannot be resolved, without fabricating a repo", async () => {
    const id = freshId();
    const { reader, count } = chain({ [id]: bounty("not-a-url", { claimed: false }) });

    const { report } = await reconcileBounties(reader, count);

    assert.equal(report.unresolvableIssueUrls.length, 1);
    assert.equal(report.unresolvableIssueUrls[0].bountyId, id);
    const row = await getBountyById(id);
    assert.equal(row!.repoOwner, "unknown", "an unparseable URL must not fabricate a repo");
    assert.equal(row!.issueNum, null);
  });

  it("does not flag a placeholder repo URL as unresolvable if it parses", async () => {
    // `github.com/user/repo/issues/1` is syntactically valid — it simply points
    // somewhere else. Reporting it as broken would be wrong.
    const id = freshId();
    const { reader, count } = chain({ [id]: bounty("https://github.com/user/repo/issues/1") });

    const { report } = await reconcileBounties(reader, count);
    assert.equal(report.unresolvableIssueUrls.length, 0);
  });

  it("refuses to reconcile at all when bountyCount is unreadable", async () => {
    // Silently treating an unreadable chain as "no bounties" would report the DB
    // as correct while the opposite is true.
    const count: BountyCountReader = async () => {
      throw new Error("rpc timeout");
    };
    await assert.rejects(() => reconcileBounties(async () => ({ ok: false, reason: "x" }), count), /bountyCount/);
  });
});

describe("formatReconcileReport", () => {
  it("summarises the run in one line", async () => {
    const id = freshId();
    const { reader, count } = chain({ [id]: bounty(`${REPO}/${id}`) });
    const line = formatReconcileReport(await reconcileBounties(reader, count));

    assert.match(line, /on-chain=/);
    assert.match(line, /inserted=/);
    assert.match(line, /orphaned=/);
    assert.equal(line.includes("\n"), false);
  });
});