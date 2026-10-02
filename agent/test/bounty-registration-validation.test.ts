import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { zeroAddress, type Address } from "viem";
import { buildServer } from "../src/index.js";
import { getBountyById } from "../src/db/index.js";
import type { BountyReader, OnChainBounty } from "../src/chain/readBounty.js";
import { createPassingGithubClient } from "./github-mock.js";

const CREATOR = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01" as Address;
const TOKEN = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const AMOUNT = 1_000_000_000_000_000_000n;
const scope = Date.now();
const ABSENT_ID = 2_000_000_000 + (scope % 100_000);
const MISMATCH_ID = ABSENT_ID + 1;
const MATCHING_ID = ABSENT_ID + 2;

const matchingBounty: OnChainBounty = {
  creator: CREATOR,
  claimed: false,
  cancelled: false,
  token: TOKEN,
  amount: AMOUNT,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
  issueUrl: "https://github.com/bountra/demo/issues/1"
};

const reader: BountyReader = async (bountyId) => ({
  ok: true,
  bounty:
    bountyId === MISMATCH_ID || bountyId === MATCHING_ID
      ? matchingBounty
      : {
          creator: zeroAddress,
          claimed: false,
          cancelled: false,
          token: zeroAddress,
          amount: 0n,
          deadline: 0n,
          issueUrl: ""
        }
});

const app = buildServer({ githubClient: createPassingGithubClient(), bountyReader: reader });

function payload(bountyId: number, creator: string) {
  return {
    bountyId,
    issueUrl: `https://github.com/bountra/demo/issues/${bountyId}`,
    repoOwner: "bountra",
    repoName: "demo",
    creator,
    token: TOKEN.toLowerCase(),
    amount: AMOUNT.toString(),
    deadline: Math.floor(Date.now() / 1000) + 86400
  };
}

describe("POST /api/bounties on-chain validation", () => {
  it("rejects an absent on-chain bounty before writing a row", async () => {
    const response = await app.inject({ method: "POST", url: "/api/bounties", payload: payload(ABSENT_ID, CREATOR) });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /does not exist on-chain/);
    assert.equal(await getBountyById(ABSENT_ID), undefined);
  });

  it("rejects a creator mismatch before writing a row", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/bounties",
      payload: payload(MISMATCH_ID, "0x1111111111111111111111111111111111111111")
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /creator does not match/);
    assert.equal(await getBountyById(MISMATCH_ID), undefined);
  });

  it("accepts matching chain data and writes the row", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/bounties",
      payload: payload(MATCHING_ID, CREATOR.toLowerCase())
    });

    assert.equal(response.statusCode, 201);
    const row = await getBountyById(MATCHING_ID);
    assert.ok(row);
    assert.equal(row.bountyId, MATCHING_ID);
    assert.equal(row.creator, CREATOR.toLowerCase());
    assert.equal(row.token, TOKEN.toLowerCase());
    assert.equal(row.amount, AMOUNT.toString());
  });
});
