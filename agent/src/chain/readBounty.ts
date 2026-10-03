import { createPublicClient, getAddress, http, parseAbi, type Address } from "viem";
import { bscTestnet } from "viem/chains";

const BOUNTY_ABI = parseAbi([
  "function bounties(uint256) view returns (address creator, bool claimed, bool cancelled, address token, uint256 amount, uint256 deadline, string issueUrl)",
  "function bountyCount() view returns (uint256)"
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

/**
 * Reads the contract's high-water mark for bounty ids.
 *
 * Reconciliation needs the id range rather than an event log: the escrow emits
 * no `Bounties` enumeration and no indexer exists, so `bountyCount` is the only
 * way to enumerate. It throws on failure — a reconciler that silently treats an
 * unreadable chain as "no bounties" would report the DB as correct while the
 * opposite is true.
 */
export type BountyCountReader = () => Promise<bigint>;

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

/**
 * Standalone `bountyCount` reader over the same RPC configuration.
 *
 * Returned as its own factory rather than folded into `BountyReader` because
 * the read shape differs: a single `bigint` that throws, versus a per-id
 * result object that reports failure as a value. Callers that need both read
 * the chain through one public client, not two.
 */
export function createBountyCountReader(config: BountyReaderConfig): BountyCountReader {
  if (!config.escrowAddress || !config.rpcUrl) {
    return async () => {
      throw new Error("bountyCount reader requires ESCROW_CONTRACT_ADDRESS and BSC_TESTNET_RPC_URL");
    };
  }

  let escrowAddress: Address;
  try {
    escrowAddress = getAddress(config.escrowAddress);
  } catch {
    throw new Error(`ESCROW_CONTRACT_ADDRESS is invalid: ${config.escrowAddress}`);
  }

  const client = createPublicClient({
    chain: bscTestnet,
    transport: http(config.rpcUrl, { retryCount: 1, retryDelay: 2_000, timeout: 10_000 })
  });

  return async (): Promise<bigint> =>
    (await client.readContract({
      address: escrowAddress,
      abi: BOUNTY_ABI,
      functionName: "bountyCount"
    })) as bigint;
}
