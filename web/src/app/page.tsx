"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useReadContract } from "wagmi";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI } from "../config/contracts";
import { formatAddress, formatBscScanUrl } from "../lib/utils";
import { ShieldCheck, Sparkles, ExternalLink, LogIn, LogOut, Terminal, GitPullRequest, Award } from "lucide-react";

export default function HomePage() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { isConnected, address } = useAccount();

  const { data: bountyCount } = useReadContract({
    address: BOUNTRA_ESCROW_ADDRESS,
    abi: BOUNTRA_ESCROW_ABI,
    functionName: "bountyCount"
  });

  const { data: agentSigner } = useReadContract({
    address: BOUNTRA_ESCROW_ADDRESS,
    abi: BOUNTRA_ESCROW_ABI,
    functionName: "agentSigner"
  });

  const activeWallet = user?.wallet?.address || address;

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-surface-border bg-surface-secondary/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-primary flex items-center justify-center font-bold text-black text-lg">
              B
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-content-primary">BOUNTRA</span>
              <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-surface-tertiary border border-surface-border text-brand-primary font-mono">
                BSC Testnet
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {ready && authenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs text-content-secondary font-mono">
                    {user?.github?.username ? `@${user.github.username}` : "Connected"}
                  </span>
                  <span className="text-xs font-mono text-content-primary">
                    {formatAddress(activeWallet)}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface-tertiary text-content-secondary hover:text-content-primary hover:border-brand-primary/50 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="px-4 py-2 rounded-lg bg-brand-primary text-black font-semibold text-sm hover:bg-brand-hover flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                Connect / GitHub
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center">
        {/* Shimmer Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-secondary border border-surface-border text-xs text-brand-primary font-medium">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            BNB Chain AI Hackathon 2026
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-content-primary leading-tight mb-4">
            Autonomous GitHub PR Auditor & <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-yellow-300 to-amber-500">Escrow</span>
          </h1>
          <p className="text-base sm:text-lg text-content-secondary leading-relaxed">
            Commit your code, get reviewed and paid by AI in seconds on BNB Smart Chain. Zero human review delay.
          </p>
        </div>

        {/* Live Protocol Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto w-full mb-12">
          {/* Card 1: Escrow Contract */}
          <div className="p-5 rounded-xl bg-surface-secondary border border-surface-border hover:border-surface-border/80 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Escrow Contract</span>
              <ShieldCheck className="w-4 h-4 text-status-success" />
            </div>
            <div className="font-mono text-sm text-content-primary truncate mb-2">
              {BOUNTRA_ESCROW_ADDRESS}
            </div>
            <a
              href={formatBscScanUrl("address", BOUNTRA_ESCROW_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline font-mono"
            >
              View on BscScan <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Card 2: AI Agent Signer */}
          <div className="p-5 rounded-xl bg-surface-secondary border border-surface-border hover:border-surface-border/80 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Agent Signer</span>
              <Terminal className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="font-mono text-sm text-content-primary truncate mb-2">
              {agentSigner ? String(agentSigner) : "0x2e10...6848"}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-status-success font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
              ECDSA Active
            </span>
          </div>

          {/* Card 3: Total Bounties */}
          <div className="p-5 rounded-xl bg-surface-secondary border border-surface-border hover:border-surface-border/80 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Total Bounties</span>
              <Award className="w-4 h-4 text-status-info" />
            </div>
            <div className="text-2xl font-bold text-content-primary mb-1">
              {bountyCount !== undefined ? String(bountyCount) : "0"}
            </div>
            <span className="text-xs text-content-secondary">
              On-Chain Escrows indexed
            </span>
          </div>
        </div>

        {/* Feature Pipeline Flow Preview */}
        <div className="max-w-2xl mx-auto w-full p-6 rounded-2xl bg-surface-secondary/50 border border-surface-border text-center">
          <h2 className="text-sm font-semibold text-content-primary mb-4 flex items-center justify-center gap-2">
            <GitPullRequest className="w-4 h-4 text-brand-primary" />
            Autonomous 3-Step Verification Pipeline
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-content-secondary">
            <div className="p-3 rounded-lg bg-surface-tertiary border border-surface-border">
              <div className="font-semibold text-content-primary mb-1">1. Submit PR</div>
              Developer opens PR with issue reference.
            </div>
            <div className="p-3 rounded-lg bg-surface-tertiary border border-surface-border">
              <div className="font-semibold text-content-primary mb-1">2. AI Evaluates</div>
              Gemini 2.0 audits diff + checks test integrity.
            </div>
            <div className="p-3 rounded-lg bg-surface-tertiary border border-surface-border">
              <div className="font-semibold text-content-primary mb-1">3. Instant Payout</div>
              ECDSA signature unlocks escrow funds in seconds.
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-6 bg-surface-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-content-muted">
          <span>Bountra © 2026 — Built for BNB Chain Hackathon.</span>
          <div className="flex items-center gap-4">
            <span className="text-brand-primary font-mono">Next.js 14 + Privy + Viem</span>
            <span>•</span>
            <span className="text-status-success font-mono">Solidity 0.8.28</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
