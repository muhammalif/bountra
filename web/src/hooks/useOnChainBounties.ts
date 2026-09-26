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
