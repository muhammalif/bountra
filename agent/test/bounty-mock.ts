import type { Address } from "viem";
import type { BountyReader } from "../src/chain/readBounty.js";

const CREATOR = "0x1111111111111111111111111111111111111111" as Address;
const TOKEN = "0x2222222222222222222222222222222222222222" as Address;

export function createPassingBountyReader(amount = 100_000_000_000_000_000_000n): BountyReader {
  return async () => ({
    ok: true,
    bounty: {
      creator: CREATOR,
      claimed: false,
      cancelled: false,
      token: TOKEN,
      amount,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
      issueUrl: "https://github.com/bountra/demo/issues/1"
    }
  });
}
