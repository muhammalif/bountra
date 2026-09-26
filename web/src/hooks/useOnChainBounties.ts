"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI } from "@/config/contracts";
import { BountyItem } from "@/types/bounty";
import { formatUnits } from "viem";

/**
 * Reads all bounties from the BountraEscrow smart contract on BSC Testnet.
 * Returns them as BountyItem[] so they can be merged with mock data.
 */
export function useOnChainBounties() {
  const publicClient = usePublicClient();
  const [onChainBounties, setOnChainBounties] = useState<BountyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicClient) return;

    let cancelled = false;

    async function fetchBounties() {
      setIsLoading(true);
      setError(null);

      try {
        const count = await publicClient!.readContract({
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
            const data = await publicClient!.readContract({
              address: BOUNTRA_ESCROW_ADDRESS,
              abi: BOUNTRA_ESCROW_ABI,
              functionName: "getBounty",
              args: [BigInt(i)],
            }) as {
              creator: string;
              token: string;
              amount: bigint;
              issueUrl: string;
              deadline: bigint;
              claimed: boolean;
              cancelled: boolean;
            };

            const amountFormatted = formatUnits(data.amount, 18);
            const amountNum = parseFloat(amountFormatted);

            // Derive status from on-chain flags
            let status: BountyItem["status"] = "open";
            if (data.claimed) status = "claimed";
            else if (data.cancelled) status = "cancelled";

            // Extract repo + issue number from issueUrl
            let repo = "unknown/repo";
            let issueNumber = i;
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
              title: `On-Chain Bounty #${i}`,
              description: `Bounty funded with ${amountNum.toFixed(0)} USDT — locked in BountraEscrow smart contract on BSC Testnet.`,
              tags: ["On-Chain", "BSC Testnet"],
              deadline: Number(data.deadline),
              claimed: data.claimed,
              cancelled: data.cancelled,
              status,
              isOnChain: true,
            } as BountyItem);
          } catch {
            // skip individual bounty read error
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
    }

    fetchBounties();
    return () => { cancelled = true; };
  }, [publicClient]);

  return { onChainBounties, isLoading, error };
}
