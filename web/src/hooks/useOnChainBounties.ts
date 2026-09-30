"use client";

import { useEffect, useState, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI } from "@/config/contracts";
import { BountyItem } from "@/types/bounty";
import { formatUnits, createPublicClient, http } from "viem";
import { bscTestnet } from "viem/chains";

// Dedicated standalone fallback client in case Wagmi publicClient is unmounted or in transition
const standaloneClient = createPublicClient({
  chain: bscTestnet,
  transport: http("https://data-seed-prebsc-1-s1.bnbchain.org:8545"),
});

/**
 * Verdict overlay from the Bountra Agent.
 *
 * On-chain status is authoritative for money: claimed and cancelled come from
 * the contract and are never overridden here. The AI verdict only decides how
 * an unclaimed bounty is *presented* — a rejected audit means the work is no
 * longer claimable, but the escrow is untouched, so the bounty stays listed.
 */
export interface AgentVerdict {
  status: string;
  verdict: string | null;
  score: number | null;
  comment: string | null;
  auditId: number;
  /**
   * Settlement proof, when the bounty has been claimed AND the agent recorded
   * the transaction. Stays null for an unclaimed bounty and for a claimed one
   * whose confirmation never landed.
   */
  claimTxHash: string | null;
}

function overlayVerdict(
  chainStatus: BountyItem["status"],
  audit?: AgentVerdict
): BountyItem["status"] {
  // Money state already settled or cancelled on-chain: nothing to overlay.
  if (chainStatus === "claimed" || chainStatus === "cancelled") return chainStatus;
  if (!audit) return chainStatus;

  switch (audit.status) {
    case "failed":
      return "rejected";
    case "claimed":
      return "claimed";
    case "passed":
      return "ready_to_claim";
    default:
      return chainStatus;
  }
}

/**
 * Reads all bounties from the BountraEscrow smart contract on BSC Testnet.
 * Returns them as BountyItem[] so they can be merged with mock data.
 * Also exposes a `refetch` function so UI can refresh after createBounty/cancelBounty.
 */
export function useOnChainBounties() {
  const wagmiPublicClient = usePublicClient();
  const [onChainBounties, setOnChainBounties] = useState<BountyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBounties = useCallback(async () => {
    const client = wagmiPublicClient || standaloneClient;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    try {
      const count = await client.readContract({
        address: BOUNTRA_ESCROW_ADDRESS,
        abi: BOUNTRA_ESCROW_ABI,
        functionName: "bountyCount",
      }) as bigint;

      const total = Number(count);
      if (total === 0) {
        if (!cancelled) {
          setOnChainBounties([]);
          setIsLoading(false);
        }
        return;
      }

      // Audit verdicts live only in the agent's SQLite, never on-chain, so they
      // are fetched separately and merged in below. A failure here must not
      // hide the bounties themselves — it only means the feed falls back to
      // showing the raw on-chain status.
      let verdicts: Record<string, AgentVerdict> = {};
      try {
        const res = await fetch("/api/agent/bounties/statuses", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { data?: Record<string, AgentVerdict> };
          verdicts = body.data ?? {};
        }
      } catch {
        // Agent offline: fall through with no overlay.
      }

      const results: BountyItem[] = [];

      for (let i = 0; i < total; i++) {
        try {
          const data = await client.readContract({
            address: BOUNTRA_ESCROW_ADDRESS,
            abi: BOUNTRA_ESCROW_ABI,
            functionName: "getBounty",
            args: [BigInt(i)],
          }) as {
            creator: string;
            claimed: boolean;
            cancelled: boolean;
            token: string;
            amount: bigint;
            deadline: bigint;
            issueUrl: string;
          };

          const amountFormatted = formatUnits(data.amount, 18);
          const amountNum = parseFloat(amountFormatted);

          let status: BountyItem["status"] = "open";
          if (data.claimed) status = "claimed";
          else if (data.cancelled) status = "cancelled";
          status = overlayVerdict(status, verdicts[i]);

          let repo = "bountra/core-contracts";
          let issueNumber = i + 1;
          const ghMatch = data.issueUrl.match(
            /github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/
          );
          if (ghMatch) {
            repo = ghMatch[1];
            issueNumber = parseInt(ghMatch[2], 10);
          }

          results.push({
            id: i,
            isMock: false,
            creator: data.creator,
            token: data.token,
            tokenSymbol: "USDT",
            amount: data.amount.toString(),
            amountFormatted: amountNum % 1 === 0 ? amountNum.toFixed(0) : amountNum.toFixed(2),
            issueUrl: data.issueUrl,
            repo,
            issueNumber,
            title: `Escrow Milestone Task #${i + 1}`,
            description: `On-chain bounty funded with ${amountNum.toFixed(0)} USDT. Automated code audit via Bountra Agent on BSC Testnet.`,
            tags: ["On-Chain", "Smart Contract", "BSC Testnet"],
            deadline: Number(data.deadline),
            claimed: data.claimed,
            cancelled: data.cancelled,
            status,
            claimTxHash: verdicts[i]?.claimTxHash ?? undefined,
            isOnChain: true,
          } as BountyItem);
        } catch (err: any) {
          console.error(`Error reading bounty #${i}:`, err);
        }
      }

      if (!cancelled) {
        setOnChainBounties(results);
      }
    } catch (err: any) {
      if (!cancelled) {
        setError(err.message || "Failed to read on-chain bounties");
      }
    } finally {
      if (!cancelled) {
        setIsLoading(false);
      }
    }
  }, [wagmiPublicClient]);

  useEffect(() => {
    fetchBounties();
    const interval = setInterval(fetchBounties, 15_000);
    return () => clearInterval(interval);
  }, [fetchBounties]);

  return { onChainBounties, isLoading, error, refetch: fetchBounties };
}
