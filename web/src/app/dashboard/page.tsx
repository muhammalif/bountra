"use client";

import { useState } from "react";
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
import { BountyItem } from "@/types/bounty";
import { LogIn, ShieldAlert, ArrowRight, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { authenticated, login } = usePrivy();
  const [activeTab, setActiveTab] = useState<"sponsor" | "developer">("sponsor");
  const [bounties, setBounties] = useState<BountyItem[]>(INITIAL_BOUNTIES);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBountyForClaim, setSelectedBountyForClaim] = useState<BountyItem | null>(null);

  const sponsorBounties = bounties.filter(
    (b) => b.creator.toLowerCase() === "0x1a8f9b123c52a9d490b8b0f2849ef3e5dcb76a12".toLowerCase()
  );

  const devClaims = bounties.slice(0, 3);

  const isUserLoggedIn = isConnected || authenticated;

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
              onClick={login}
              className="px-6 py-3 rounded-lg bg-brand-primary text-black font-semibold text-xs sm:text-sm hover:bg-brand-hover transition-colors flex items-center gap-2 shadow-sm"
            >
              <span>Connect Wallet / Sign In with GitHub</span>
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
                onRefresh={() => {}}
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
        onSuccess={() => setIsCreateModalOpen(false)}
      />

      <ClaimBountyDrawer
        bounty={selectedBountyForClaim}
        isOpen={Boolean(selectedBountyForClaim)}
        onClose={() => setSelectedBountyForClaim(null)}
        onSuccess={() => setSelectedBountyForClaim(null)}
      />

      <Footer />
    </div>
  );
}
