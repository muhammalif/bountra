import { createPublicClient, getAddress, http, parseAbi, type Address } from "viem";
import { bscTestnet } from "viem/chains";

const BOUNTY_ABI = parseAbi([
  "function bounties(uint256) view returns (address creator, bool claimed, bool cancelled, address token, uint256 amount, uint256 deadline, string issueUrl)"
]);

export interface OnChainBounty {
  creator: Address;
  claimed: boolean;
  cancelled: boolean;
  token: Address;
  amount: bigint;
  deadline: bigint;
  issueUrl: string;
}

export type BountyReadResult =
  | { ok: true; bounty: OnChainBounty }
  | { ok: false; reason: string; statusCode?: 502 | 503 };

export type BountyReader = (bountyId: number) => Promise<BountyReadResult>;

export interface BountyReaderConfig {
  escrowAddress?: string;
  rpcUrl?: string;
}

export function createBountyReader(config: BountyReaderConfig): BountyReader {
  if (!config.escrowAddress) {
    return async () => ({
      ok: false,
      reason: "ESCROW_CONTRACT_ADDRESS is not configured on the agent.",
      statusCode: 503
    });
  }

  if (!config.rpcUrl) {
    return async () => ({
      ok: false,
      reason: "BSC_TESTNET_RPC_URL is not configured on the agent.",
      statusCode: 503
    });
  }

  let escrowAddress: Address;
  try {
    escrowAddress = getAddress(config.escrowAddress);
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    return async () => ({
      ok: false,
      reason: `ESCROW_CONTRACT_ADDRESS is invalid: ${reason}`,
      statusCode: 503
    });
  }

  const client = createPublicClient({
    chain: bscTestnet,
    transport: http(config.rpcUrl, { retryCount: 1, retryDelay: 2_000, timeout: 10_000 })
  });

  return async (bountyId: number): Promise<BountyReadResult> => {
    try {
      const [creator, claimed, cancelled, token, amount, deadline, issueUrl] = await client.readContract({
        address: escrowAddress,
        abi: BOUNTY_ABI,
        functionName: "bounties",
        args: [BigInt(bountyId)]
      });

      return {
        ok: true,
        bounty: { creator, claimed, cancelled, token, amount, deadline, issueUrl }
      };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: `Unable to read bounty ${bountyId} from BSC testnet RPC: ${reason}`,
        statusCode: 502
      };
    }
  };
}
