"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SponsorTab } from "@/components/dashboard/SponsorTab";
import { DeveloperTab } from "@/components/dashboard/DeveloperTab";
import { CreateBountyModal } from "@/components/modals/CreateBountyModal";
import { ClaimBountyDrawer } from "@/components/modals/ClaimBountyDrawer";
import { INITIAL_BOUNTIES } from "@/lib/mock-bounties";
import { useOnChainBounties } from "@/hooks/useOnChainBounties";
import { BountyItem } from "@/types/bounty";
import { LogIn, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { isConnected, address: wagmiAddress } = useAccount();
  const { ready, authenticated, login, user } = usePrivy();
  const address = wagmiAddress || (user?.wallet?.address as `0x${string}` | undefined);
  const { onChainBounties, refetch: refetchOnChain } = useOnChainBounties();
  const [activeTab, setActiveTab] = useState<"sponsor" | "developer">("sponsor");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBountyForClaim, setSelectedBountyForClaim] = useState<BountyItem | null>(null);

  // Sponsor Hub: show all bounties created by connected wallet
  // If no wallet connected, show empty; if connected, show on-chain + mock (if match)
  const sponsorBounties = useMemo(() => {
    if (!address) return [];
    const addr = address.toLowerCase();

    // 1. On-chain bounties owned by this user
    const onChain = onChainBounties.filter(
      (b) => b.creator.toLowerCase() === addr
    );

    // 2. If on-chain list is loaded and has items, prioritize them
    if (onChain.length > 0) {
      return onChain;
    }

    // 3. Fallback: If onChain is empty or user is testing with mock address
    const mock = INITIAL_BOUNTIES.filter(
      (b) => b.creator.toLowerCase() === addr
    );
    return mock;
  }, [address, onChainBounties]);

  // Developer Hub claims for demo: show bounties that are claimed and ready_to_claim
  const devClaims = useMemo(() => {
    return INITIAL_BOUNTIES.filter(
      (b) => b.status === "claimed" || b.status === "ready_to_claim"
    );
  }, []);

  const isUserLoggedIn = Boolean((ready && authenticated) || (isConnected && Boolean(address)));

  return (
    <div className="min-h-screen bg-surface-primary text-content-primary flex flex-col font-sans selection:bg-brand-primary/20 selection:text-brand-primary">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!isUserLoggedIn ? (
          <div className="py-20 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="h-16 w-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary mb-6">
              <LogIn className="h-8 w-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary mb-2">
              Connect to Access Workspace
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary leading-relaxed mb-6">
              Sign in with your GitHub account or Web3 wallet to manage escrow deposits, review verified code PRs, and process on-chain developer payouts.
            </p>
            <button
              type="button"
              onClick={() => login()}
              disabled={!ready}
              className="px-6 py-3 rounded-lg bg-brand-primary text-black font-semibold text-xs sm:text-sm hover:bg-brand-hover transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span>{ready ? "Connect Wallet / Sign In with GitHub" : "Connecting..."}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <DashboardHeader
              activeTab={activeTab}
              onTabChange={setActiveTab}
              sponsorCount={sponsorBounties.length}
              devCount={devClaims.length}
            />

            {activeTab === "sponsor" && (
              <SponsorTab
                bounties={sponsorBounties}
                onCreateBounty={() => setIsCreateModalOpen(true)}
                onRefresh={refetchOnChain}
              />
            )}

            {activeTab === "developer" && (
              <DeveloperTab
                claims={devClaims}
                onClaimBounty={(bounty) => setSelectedBountyForClaim(bounty)}
              />
            )}
          </div>
        )}
      </main>

      <CreateBountyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          refetchOnChain();
        }}
      />

      <ClaimBountyDrawer
        bounty={selectedBountyForClaim}
        isOpen={Boolean(selectedBountyForClaim)}
        mode="claim"
        onClose={() => setSelectedBountyForClaim(null)}
        onSuccess={() => setSelectedBountyForClaim(null)}
      />

      <Footer />
    </div>
  );
}
