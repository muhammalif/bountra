import { createPublicClient, decodeEventLog, http, parseAbiItem, getAddress, type Address, type Hex } from "viem";
import { bscTestnet } from "viem/chains";

/**
 * On-chain verification of a claimBounty() transaction.
 *
 * The browser reports the claim; this module decides whether it happened. That
 * split matters because `audit_logs.status` and `claim_tx_hash` are the only
 * record that keeps a paid bounty from being offered for claim a second time.
 * If the agent stored whatever hash the client sent, that record would be a
 * claim rather than a fact, and the UI would happily re-list a drained bounty
 * until the second claim reverted on-chain.
 *
 * Three things must hold before the agent marks a claim settled:
 *   1. the receipt exists and status is 1
 *   2. the tx targets the escrow contract
 *   3. the escrow emitted BountyClaimed for this bountyId and this developer
 *
 * (2) and (3) are what stop a client from pointing the agent at some unrelated
 * successful transaction. (1) alone proves nothing happened.
 */

const ESCROW_ABI = [
  parseAbiItem("event BountyClaimed(uint256 indexed bountyId, address indexed developer, string prUrl, string commitHash)")
] as const;

export const BOUNTY_CLAIMED_TOPIC =
  "0x7eb57c5fcce2250bfe8c97cecc6ffddf14f67205b30416c57a937322608cb74b";

export type ClaimVerification =
  | { ok: true; blockNumber: bigint; developer: Address; prUrl: string; commitHash: string }
  | { ok: false; reason: string };

export interface VerifyClaimParams {
  txHash: Hex;
  bountyId: number;
  expectedDeveloper?: Address;
  escrowAddress: Address;
  rpcUrl: string;
}

export async function verifyClaimOnChain(params: VerifyClaimParams): Promise<ClaimVerification> {
  const client = createPublicClient({ chain: bscTestnet, transport: http(params.rpcUrl) });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: params.txHash });
  } catch (err) {
    return { ok: false, reason: `Transaction not found on BSC testnet: ${(err as Error).message}` };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: "Transaction reverted on-chain." };
  }

  if (getAddress(receipt.to ?? "0x") !== getAddress(params.escrowAddress)) {
    return { ok: false, reason: "Transaction did not target the Bountra escrow contract." };
  }

  const claim = receipt.logs
    .filter((log) => log.topics[0] === BOUNTY_CLAIMED_TOPIC)
    .map((log) => {
      const event = decodeEventLog({
        abi: ESCROW_ABI,
        data: log.data,
        topics: log.topics as never
      });
      return event.args as { bountyId: bigint; developer: Address; prUrl: string; commitHash: string };
    })
    .find((args) => args.bountyId === BigInt(params.bountyId));

  if (!claim) {
    return { ok: false, reason: `No BountyClaimed event for bounty ${params.bountyId} in this transaction.` };
  }

  if (params.expectedDeveloper && getAddress(claim.developer) !== getAddress(params.expectedDeveloper)) {
    return {
      ok: false,
      reason: `Claim was made by ${claim.developer}, not ${params.expectedDeveloper}.`
    };
  }

  return {
    ok: true,
    blockNumber: receipt.blockNumber,
    developer: claim.developer,
    prUrl: claim.prUrl,
    commitHash: claim.commitHash
  };
}
