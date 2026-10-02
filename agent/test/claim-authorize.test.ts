import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/index.js";
import { recoverMessageAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { computeClaimDigest } from "../src/signer/index.js";
import { createPassingBountyReader } from "./bounty-mock.js";
import { createPassingGithubClient } from "./github-mock.js";

/**
 * Claim authorization contract.
 *
 * The point of these tests is the security property, not the happy path: a
 * signature is an authorization to move escrowed funds, so it must be impossible
 * to obtain one without a passing audit behind it, and impossible to move one
 * between bounties, wallets, commits or PRs.
 */
describe("Claim authorization", () => {
  const app = buildServer({ githubClient: createPassingGithubClient(), bountyReader: createPassingBountyReader() });
  const scope = Date.now();
  const bountyId = 700000 + (scope % 900);
  const devWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const prUrl = `https://github.com/bountra/core-contracts/pull/${scope}`;
  const commitHash = "0xdeadbeef";

  before(async () => {
    await app.inject({
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

    // Produce a real passing audit (offline evaluator per test/setup.ts).
    await app.inject({
      method: "POST",
      url: "/api/audit/evaluate",
      payload: { bountyId, prUrl, commitHash, devWallet }
    });
  });

  it("refuses to authorize a scope with no passing audit", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/authorize",
      payload: {
        bountyId: bountyId + 1,
        prUrl,
        commitHash,
        devWallet
      }
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.authorized, false);
    assert.equal(body.signature, undefined);
  });

  it("treats bountyId 0 as a valid id, not a missing field", async () => {
    // Guards a falsy-zero bug: `if (!bountyId)` rejects bounty 0, which is a
    // real escrow index, before the audit lookup ever runs.
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/authorize",
      payload: { bountyId: 0, prUrl, commitHash, devWallet }
    });

    assert.equal(res.statusCode, 409, "bountyId 0 must reach the audit lookup, not be rejected as missing");
  });

  it("issues a signature that recovers to the agent signer for the exact scope", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/authorize",
      payload: { bountyId, prUrl, commitHash, devWallet }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.authorized, true);
    assert.ok(body.signature.startsWith("0x"));
    assert.equal(body.signature.length, 132, "65-byte signature plus 0x");

    // Recompute the digest independently and recover the signer. This mirrors
    // what BountraEscrow.claimBounty does, so a passing test means the contract
    // would accept these exact bytes.
    const digest = computeClaimDigest({
      bountyId,
      devWallet: devWallet as `0x${string}`,
      commitHash,
      prUrl,
      contractAddress: process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}`,
      chainId: Number(process.env.CHAIN_ID)
    });

    assert.equal(body.digest, digest, "returned digest must match an independent recomputation");

    // The contract calls ECDSA.recover(messageHash, signature) on the raw hash,
    // with no EIP-191 prefix. viem's signMessage skips that prefix for a 32-byte
    // raw message, so recovery must skip it too — prefixing here would make a
    // perfectly valid on-chain signature look forged.
    const recovered = await recoverMessageAddress({
      message: { raw: body.rawHash as Hex },
      signature: body.signature as Hex
    });

    // Derive the expected signer from the key the test pinned, so the assertion
    // tracks the key rather than a hardcoded address that could drift from it.
    const expectedSigner = privateKeyToAccount(
      process.env.AGENT_PRIVATE_KEY as `0x${string}`
    ).address;
    assert.equal(recovered.toLowerCase(), expectedSigner.toLowerCase());
  });

  it("never reissues a signature for a different developer", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/authorize",
      payload: {
        bountyId,
        prUrl,
        commitHash,
        devWallet: "0x000000000000000000000000000000000000dEaD"
      }
    });

    assert.equal(res.statusCode, 409, "a signature is bound to one developer and cannot be reissued");
  });

  it("never reissues a signature for a different commit", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/claim/authorize",
      payload: {
        bountyId,
        prUrl,
        commitHash: "0x0000000000000000000000000000000000000000",
        devWallet
      }
    });

    assert.equal(res.statusCode, 409);
  });

  it("lists only bounties with a passing audit for that developer", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/claim/eligible?developer=${devWallet}`
    });

    assert.equal(res.statusCode, 200);
    const rows = JSON.parse(res.body).data as Array<{ bountyId: number; hasSignature: boolean }>;
    const row = rows.find((r) => r.bountyId === bountyId);
    assert.ok(row, "the audited bounty must be listed");
    assert.equal(row.hasSignature, true);
    assert.ok(rows.every((r) => typeof r.hasSignature === "boolean"));
  });

  it("requires a developer on the eligibility endpoint", async () => {
    const res = await app.inject({ method: "GET", url: "/api/claim/eligible" });
    assert.equal(res.statusCode, 400);
  });
});
