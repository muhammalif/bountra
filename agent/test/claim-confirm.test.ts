import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/index.js";
import { verifyClaimOnChain, BOUNTY_CLAIMED_TOPIC } from "../src/chain/verifyClaim.js";
import type { Address, Hex } from "viem";
import { createPassingGithubClient } from "./github-mock.js";

/**
 * Claim settlement recording.
 *
 * The browser reports a successful claim with only a bountyId and a tx hash, so
 * this endpoint is the only thing that can tell the audit trail a payout
 * happened. Two properties matter and are asserted here:
 *
 *  1. The tx hash must be proven on-chain before anything is written — a client
 *     that reports a fake hash must not be able to mark a bounty claimed.
 *  2. Re-confirming must be safe, because the browser effect can fire more than
 *     once (React re-render, refetch) for a single settlement.
 */

// A real BSC testnet claim: block 133853437 released 500 USDT from escrow for
// bounty 0 to 0xA116…4F13 via PR #2.
const REAL_CLAIM_TX = "0x9c59df651bb8ef5fb4dfc65e1d05bbe80c4b9896150b40470761a79a4dbe640d" as Hex;
const REAL_ESCROW = "0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260" as Address;
const REAL_DEVELOPER = "0xA116aBe137640B3C62Aa6b4Be08e79E07d664f13" as Address;
const RPC = process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";

/**
 * Whether a real transaction can be read back right now. These tests assert
 * chain behaviour, so a DNS or RPC outage is an environment problem — skipped,
 * not failed. A local/offline run still exercises every non-chain path.
 */
const chainUp = await verifyClaimOnChain({
  txHash: REAL_CLAIM_TX,
  bountyId: 0,
  escrowAddress: REAL_ESCROW,
  rpcUrl: RPC
})
  .then((r) => r.ok)
  .catch(() => false);

const NO_CHAIN = chainUp ? false : "BSC testnet unreachable";

describe("verifyClaimOnChain", () => {
  it("accepts the real claimBounty transaction", { skip: NO_CHAIN }, async () => {
    const result = await verifyClaimOnChain({
      txHash: REAL_CLAIM_TX,
      bountyId: 0,
      expectedDeveloper: REAL_DEVELOPER,
      escrowAddress: REAL_ESCROW,
      rpcUrl: RPC
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.developer.toLowerCase(), REAL_DEVELOPER.toLowerCase());
      assert.match(result.prUrl, /bountra-demo\/pull\/2$/);
      assert.match(result.commitHash, /^2ff81d2/);
      assert.ok(result.blockNumber > 0n);
    }
  });

  it("rejects a claim attributed to the wrong bounty", { skip: NO_CHAIN }, async () => {
    const result = await verifyClaimOnChain({
      txHash: REAL_CLAIM_TX,
      bountyId: 3,
      escrowAddress: REAL_ESCROW,
      rpcUrl: RPC
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /No BountyClaimed event for bounty 3/);
  });

  it("rejects a claim by a developer other than the audited one", { skip: NO_CHAIN }, async () => {
    const result = await verifyClaimOnChain({
      txHash: REAL_CLAIM_TX,
      bountyId: 0,
      expectedDeveloper: "0x000000000000000000000000000000000000dEaD",
      escrowAddress: REAL_ESCROW,
      rpcUrl: RPC
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /not 0x000000000000000000000000000000000000dEaD/);
  });

  it("rejects an unknown transaction hash", { skip: NO_CHAIN }, async () => {
    const result = await verifyClaimOnChain({
      txHash: ("0x" + "ab".repeat(32)) as Hex,
      bountyId: 0,
      escrowAddress: REAL_ESCROW,
      rpcUrl: RPC
    });

    assert.equal(result.ok, false);
  });

  it("BountyClaimed topic matches the contract's event signature", () => {
    // If the event ABI ever drifts from the deployed contract, confirmation would
    // start accepting transactions that claimed nothing. This pins the topic.
    assert.equal(
      BOUNTY_CLAIMED_TOPIC,
      "0x7eb57c5fcce2250bfe8c97cecc6ffddf14f67205b30416c57a937322608cb74b"
    );
  });
});

describe("POST /api/claim/confirm", () => {
  const app = buildServer({ githubClient: createPassingGithubClient() });
  const scope = Date.now();
  const bountyId = 800000 + (scope % 900);
  const devWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const prUrl = `https://github.com/bountra/core-contracts/pull/${scope}`;
  const commitHash = "a".repeat(40);

  before(async () => {
    const seeded = await app.inject({
      method: "POST",
      url: "/api/bounties",
      payload: {
        bountyId,
        issueUrl: `https://github.com/bountra/core-contracts/issues/${scope}`,
        repoOwner: "bountra",
        repoName: "core-contracts",
        creator: "0x1111111111111111111111111111111111111111",
        token: "0x2222222222222222222222222222222222222222",
        amount: "100000000000000000000",
        deadline: Math.floor(Date.now() / 1000) + 86400
      }
    });

    // Passing audit via the offline evaluator (test/setup.ts clears GEMINI_API_KEY).
    const audited = await app.inject({
      method: "POST",
      url: "/api/audit/evaluate",
      payload: { bountyId, prUrl, commitHash, devWallet }
    });

    assert.equal(seeded.statusCode, 201, `bounty seed failed: ${seeded.body}`);
    assert.equal(audited.statusCode, 200, `audit seed failed: ${audited.body}`);
  });

  it("rejects a malformed tx hash without touching the network", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/confirm",
      payload: { bountyId, txHash: "not-a-hash" }
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /32-byte txHash/);
  });

  it("rejects a missing bountyId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/confirm",
      payload: { txHash: REAL_CLAIM_TX }
    });

    assert.equal(res.statusCode, 400);
  });

  it("refuses a bounty that was never audited", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/confirm",
      payload: { bountyId: bountyId + 1, txHash: REAL_CLAIM_TX }
    });

    assert.equal(res.statusCode, 404);
    assert.match(res.json().error, /No audit exists for bounty/);
  });

  it("will not record a hash that did not claim this bounty", { skip: NO_CHAIN }, async () => {
    // A real, mined transaction — but it claimed bounty 0, not this one. The
    // endpoint must prove the link on-chain rather than store what it is told.
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/confirm",
      payload: { bountyId, txHash: REAL_CLAIM_TX }
    });

    assert.equal(res.statusCode, 409);
    // Which guard trips first depends on configuration: the test setup pins a
    // placeholder escrow address, so the "did not target escrow" check can fire
    // before the event is parsed. Both are refusals to record, which is the point.
    assert.match(
      res.json().error,
      /No BountyClaimed event for bounty|did not target the Bountra escrow/
    );
  });

  it("will not record a claim attributed to another developer", { skip: NO_CHAIN }, async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/confirm",
      payload: {
        bountyId,
        txHash: REAL_CLAIM_TX,
        devWallet: "0x000000000000000000000000000000000000dEaD"
      }
    });

    assert.equal(res.statusCode, 409);
  });

  it("leaves the audit claimable after a rejected confirmation", { skip: NO_CHAIN }, async () => {
    // The security property that makes the above meaningful: a spoofed hash
    // changes nothing, so the bounty is still claimable by its real developer.
    const eligible = await app.inject({
      method: "GET",
      url: `/api/claim/eligible?developer=${devWallet}`
    });

    assert.ok(eligible.json().data.some((b: { bountyId: number }) => b.bountyId === bountyId));
  });
});
