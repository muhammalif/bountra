"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import { PlusCircle, ShieldCheck, Coins, Zap } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BountyCard } from "@/components/explorer/BountyCard";
import { BountyFilter } from "@/components/explorer/BountyFilter";
import { CreateBountyModal } from "@/components/modals/CreateBountyModal";
import { ClaimBountyDrawer } from "@/components/modals/ClaimBountyDrawer";
import { INITIAL_BOUNTIES } from "@/lib/mock-bounties";
import { useOnChainBounties } from "@/hooks/useOnChainBounties";
import { BountyItem } from "@/types/bounty";

export default function ExplorePage() {
  const { isConnected } = useAccount();
  const { onChainBounties, refetch: refetchOnChain } = useOnChainBounties();
  const [bounties, setBounties] = useState<BountyItem[]>(INITIAL_BOUNTIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("reward_desc");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBountyForClaim, setSelectedBountyForClaim] = useState<BountyItem | null>(null);

  // Merge on-chain bounties with mock data (avoid duplicate IDs)
  useEffect(() => {
    if (onChainBounties.length === 0) return;
    const mockIds = new Set(INITIAL_BOUNTIES.map((b) => b.id));
    // Offset on-chain IDs to avoid collision with mock IDs
    const merged = [
      ...INITIAL_BOUNTIES,
      ...onChainBounties
        .filter((b) => !mockIds.has(b.id))
        .map((b) => ({ ...b, id: b.id + 1000 })),
    ];
    setBounties(merged);
  }, [onChainBounties]);

  const filteredBounties = useMemo(() => {
    return bounties
      .filter((b) => {
        if (selectedStatus !== "all" && b.status !== selectedStatus) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = b.title.toLowerCase().includes(q);
          const matchRepo = b.repo.toLowerCase().includes(q);
          const matchTags = b.tags.some((t) => t.toLowerCase().includes(q));
          return matchTitle || matchRepo || matchTags;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "reward_desc") {
          return parseFloat(b.amountFormatted) - parseFloat(a.amountFormatted);
        }
        if (sortBy === "newest") {
          return b.id - a.id;
        }
        if (sortBy === "deadline_asc") {
          return a.deadline - b.deadline;
        }
        return 0;
      });
  }, [bounties, searchQuery, selectedStatus, sortBy]);

  const totalTvl = useMemo(() => {
    return bounties.reduce((acc, curr) => acc + parseFloat(curr.amountFormatted), 0);
  }, [bounties]);

  return (
    <div className="min-h-screen bg-surface-primary text-content-primary flex flex-col font-sans selection:bg-brand-primary/20 selection:text-brand-primary">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-surface-border pb-8 mb-8">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-brand-primary mb-2 block">
              Decentralized Code Escrow Directory
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-content-primary">
              Explore Active Bounties
            </h1>
            <p className="mt-2 text-sm text-content-secondary max-w-2xl leading-relaxed">
              Find open GitHub issues with funds locked on BNB Chain. Submit high-quality PRs, pass 5-layer Bountra Agent automated security review, and claim rewards instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-brand-primary text-black font-semibold text-xs hover:bg-brand-hover transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Bounty Escrow</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-surface-border bg-surface-secondary/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase text-content-muted">Total Escrow Value</span>
              <Coins className="h-4 w-4 text-brand-primary" />
            </div>
            <div className="font-mono text-xl font-bold text-content-primary">
              {totalTvl.toLocaleString()} USDT
            </div>
            <span className="text-[10px] font-mono text-content-secondary">
              Locked on BSC Testnet Vault
            </span>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface-secondary/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase text-content-muted">Total Bounties</span>
              <ShieldCheck className="h-4 w-4 text-status-success" />
            </div>
            <div className="font-mono text-xl font-bold text-content-primary">
              {bounties.length} Escrows
            </div>
            <span className="text-[10px] font-mono text-content-secondary">
              {bounties.filter((b) => b.status === "open").length} open for PR
            </span>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface-secondary/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase text-content-muted">Autonomous Settlement</span>
              <Zap className="h-4 w-4 text-status-warning" />
            </div>
            <div className="font-mono text-xl font-bold text-content-primary">
              &lt; 15s Latency
            </div>
            <span className="text-[10px] font-mono text-content-secondary">
              ECDSA verification on-chain
            </span>
          </div>
        </div>

        <div className="mb-8">
          <BountyFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            sortBy={sortBy}
            onSortChange={setSortBy}
            totalCount={filteredBounties.length}
          />
        </div>

        {filteredBounties.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-surface-border rounded-2xl bg-surface-secondary/30">
            <p className="font-mono text-sm text-content-secondary mb-2">
              No bounties match your search or filter criteria.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
              }}
              className="font-mono text-xs text-brand-primary hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBounties.map((bounty) => (
              <BountyCard
                key={bounty.id}
                bounty={bounty}
                onSelect={(selected) => setSelectedBountyForClaim(selected)}
              />
            ))}
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
        onClose={() => setSelectedBountyForClaim(null)}
        onSuccess={() => {
          setSelectedBountyForClaim(null);
        }}
      />

      <Footer />
    </div>
  );
}
