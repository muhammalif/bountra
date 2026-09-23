import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  computeRawClaimHash,
  computeClaimDigest,
  signBountyClaim,
  verifyClaimSignature
} from "../src/signer/index.js";

describe("Cryptographic Signer (Viem ECDSA)", () => {
  const testPrivateKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(testPrivateKey);

  const sampleParams = {
    bountyId: 42,
    devWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const,
    commitHash: "e5a4b3c2d1e5a4b3c2d1e5a4b3c2d1e5a4b3c2d1",
    prUrl: "https://github.com/bountra/demo/pull/12",
    contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const,
    chainId: 97 // BSC Testnet
  };

  it("should compute deterministic raw and digest hashes", () => {
    const rawHash1 = computeRawClaimHash(sampleParams);
    const rawHash2 = computeRawClaimHash(sampleParams);
    assert.equal(rawHash1, rawHash2);
    assert.ok(rawHash1.startsWith("0x"));
    assert.equal(rawHash1.length, 66); // 32 bytes hex

    const digest1 = computeClaimDigest(sampleParams);
    const digest2 = computeClaimDigest(sampleParams);
    assert.equal(digest1, digest2);
    assert.ok(digest1.startsWith("0x"));
  });

  it("should produce a valid ECDSA signature verifiable by the agent address", async () => {
    const { signature, agentAddress, rawHash, digest } = await signBountyClaim(
      sampleParams,
      testPrivateKey
    );

    assert.equal(agentAddress.toLowerCase(), agentAccount.address.toLowerCase());
    assert.ok(signature.startsWith("0x"));
    assert.ok(digest.startsWith("0x"));
    assert.ok(rawHash.startsWith("0x"));

    // Recover address using verifyClaimSignature helper
    const recoveredAddress = await verifyClaimSignature(sampleParams, signature);
    assert.equal(recoveredAddress.toLowerCase(), agentAccount.address.toLowerCase());
  });

  it("should fail verification if any parameter is tampered", async () => {
    const { signature } = await signBountyClaim(sampleParams, testPrivateKey);

    // Tamper commitHash
    const tamperedParams = {
      ...sampleParams,
      commitHash: "ffffffffffffffffffffffffffffffffffffffff"
    };

    const recoveredFromTampered = await verifyClaimSignature(tamperedParams, signature);
    assert.notEqual(
      recoveredFromTampered.toLowerCase(),
      agentAccount.address.toLowerCase()
    );
  });
});
