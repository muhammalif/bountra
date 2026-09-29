"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/hero/HeroSection";
import { AuditTerminal } from "@/components/terminal/AuditTerminal";
import { BountyCard } from "@/components/explorer/BountyCard";
import { ClaimBountyDrawer } from "@/components/modals/ClaimBountyDrawer";
import { INITIAL_BOUNTIES } from "@/lib/mock-bounties";
import { BountyItem } from "@/types/bounty";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI } from "@/config/contracts";
import { ArrowRight, Compass } from "lucide-react";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [selectedBountyForClaim, setSelectedBountyForClaim] = useState<BountyItem | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: bountyCount } = useReadContract({
    address: BOUNTRA_ESCROW_ADDRESS,
    abi: BOUNTRA_ESCROW_ABI,
    functionName: "bountyCount",
    query: {
      enabled: mounted
    }
  });

  const featuredBounties = INITIAL_BOUNTIES.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface-primary selection:bg-brand-primary selection:text-black">
      <Header />
      <main className="flex-1 flex flex-col justify-center">
        <HeroSection
          bountyCount={typeof bountyCount === "bigint" ? Number(bountyCount) : 0}
        />

        <AuditTerminal />

        <section className="w-full max-w-5xl mx-auto px-4 py-12 border-t border-surface-border">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-brand-primary mb-1">
                <Compass className="h-4 w-4" />
                <span className="font-mono text-xs uppercase tracking-wider font-semibold">Active Bounties</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-content-primary">
                Featured Bounty Escrows
              </h2>
              <p className="mt-1 text-xs text-content-secondary max-w-lg">
                Explore real code bounties currently funded on BSC Testnet. Solve the issue, submit a PR, and claim your reward.
              </p>
            </div>

            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 min-h-[44px] font-mono text-xs font-semibold text-brand-primary hover:text-brand-hover hover:underline active:text-brand-hover active:scale-[0.98]"
            >
              <span>View All Bounties</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredBounties.map((bounty) => (
              <BountyCard
                key={bounty.id}
                bounty={bounty}
                onSelect={(selected) => setSelectedBountyForClaim(selected)}
              />
            ))}
          </div>
        </section>
      </main>

      <ClaimBountyDrawer
        bounty={selectedBountyForClaim}
        isOpen={Boolean(selectedBountyForClaim)}
        onClose={() => setSelectedBountyForClaim(null)}
      />

      <Footer />
    </div>
  );
}
