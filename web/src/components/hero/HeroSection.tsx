"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowDownRight, PlusCircle, ShieldCheck, Zap, Lock } from "lucide-react";
import { AnimatedShinyText } from "../magicui/animated-shiny-text";
import { PipelineVisualizer } from "./PipelineVisualizer";
import { BOUNTRA_ESCROW_ADDRESS } from "@/config/contracts";
import { formatAddress, formatBscScanUrl } from "@/lib/utils";

interface HeroSectionProps {
  onExploreClick?: () => void;
  onCreateBountyClick?: () => void;
  bountyCount?: number | bigint;
}

export function HeroSection({
  onExploreClick,
  onCreateBountyClick,
  bountyCount = 0
}: HeroSectionProps) {
  const { authenticated, login } = usePrivy();

  return (
    <section className="relative flex flex-col items-center justify-center pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-6 inline-flex items-center rounded-full border border-surface-border bg-surface-secondary/80 px-4 py-1.5 backdrop-blur-md">
        <AnimatedShinyText className="text-xs font-medium font-mono text-brand-primary">
          BNB Chain Hackathon 2026 • AI Agents Track
        </AnimatedShinyText>
      </div>

      <div className="text-center max-w-4xl mx-auto mb-8">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-content-primary leading-[1.1] mb-6">
          Autonomous GitHub PR Auditor &{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-yellow-200 to-amber-500">
            Milestone Escrow
          </span>
        </h1>
        <p className="text-base sm:text-lg text-content-secondary max-w-2xl mx-auto leading-relaxed">
          Lock bounty rewards on BNB Chain. When developers submit PRs, Gemini 2.0 Flash audits diffs, verifies CI checks, and signs ECDSA payouts in seconds. Zero human review delay.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        <Link
          href="/explore"
          className="px-5 py-2.5 rounded-lg bg-brand-primary text-black font-semibold text-sm hover:bg-brand-hover transition-all flex items-center gap-2 shadow-sm active:scale-95"
        >
          Explore Active Bounties
          <ArrowDownRight className="w-4 h-4" />
        </Link>

        {authenticated ? (
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg border border-surface-border bg-surface-secondary text-content-primary font-semibold text-sm hover:border-brand-primary/50 transition-all flex items-center gap-2 active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-brand-primary" />
            Create Bounty
          </Link>
        ) : (
          <button
            onClick={login}
            className="px-5 py-2.5 rounded-lg border border-surface-border bg-surface-secondary text-content-primary font-semibold text-sm hover:border-brand-primary/50 transition-all flex items-center gap-2 active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-brand-primary" />
            Sign In with GitHub to Create
          </button>
        )}
      </div>

      <div className="w-full flex justify-center mb-16">
        <PipelineVisualizer />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        <div className="p-5 rounded-xl border border-surface-border bg-surface-secondary/70 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-content-secondary uppercase">Escrow Vault</span>
            <Lock className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="font-mono text-sm font-semibold text-content-primary truncate mb-1">
            {formatAddress(BOUNTRA_ESCROW_ADDRESS)}
          </div>
          <a
            href={formatBscScanUrl("address", BOUNTRA_ESCROW_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-primary hover:underline font-mono"
          >
            BSC Testnet (Chain 97) ↗
          </a>
        </div>

        <div className="p-5 rounded-xl border border-surface-border bg-surface-secondary/70 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-content-secondary uppercase">Audit Latency</span>
            <Zap className="w-4 h-4 text-status-warning" />
          </div>
          <div className="text-xl font-bold font-mono text-content-primary mb-1">
            &lt; 15s Avg
          </div>
          <span className="text-xs text-content-secondary">
            Gemini 2.0 Flash Fast Review
          </span>
        </div>

        <div className="p-5 rounded-xl border border-surface-border bg-surface-secondary/70 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-content-secondary uppercase">Active Escrows</span>
            <ShieldCheck className="w-4 h-4 text-status-success" />
          </div>
          <div className="text-xl font-bold font-mono text-content-primary mb-1">
            {bountyCount !== undefined ? String(bountyCount) : "0"} Escrows
          </div>
          <span className="text-xs text-status-success font-mono">
            5-Layer Security Protected
          </span>
        </div>
      </div>
    </section>
  );
}
