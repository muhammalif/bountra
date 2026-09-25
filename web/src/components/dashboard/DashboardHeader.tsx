"use client";

import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/utils";
import { Copy, Check, ShieldCheck, User, Code, Wallet } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  activeTab: "sponsor" | "developer";
  onTabChange: (tab: "sponsor" | "developer") => void;
  sponsorCount: number;
  devCount: number;
}

export function DashboardHeader({
  activeTab,
  onTabChange,
  sponsorCount,
  devCount
}: DashboardHeaderProps) {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6 border-b border-surface-border pb-8 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-brand-primary mb-1 block">
            Bountra Account & Escrow Portal
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-content-primary">
            User Workspace
          </h1>
          <p className="mt-1 text-xs text-content-secondary max-w-xl leading-relaxed">
            Manage your deposited bounty escrows, claim refunds for expired tasks, and view your verified AI audit payout history.
          </p>
        </div>

        {address && (
          <div className="flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface-secondary/80 px-4 py-2.5 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-lg bg-surface-tertiary flex items-center justify-center text-brand-primary">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[10px] font-mono text-content-muted uppercase">Connected Wallet</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-content-primary">
                  {formatAddress(address)}
                </span>
                <button
                  onClick={copyAddress}
                  title="Copy address"
                  className="text-content-muted hover:text-brand-primary transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-surface-border/60">
        <button
          onClick={() => onTabChange("sponsor")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-medium border-b-2 transition-colors -mb-px",
            activeTab === "sponsor"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-content-secondary hover:text-content-primary"
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Sponsor Escrows ({sponsorCount})</span>
        </button>

        <button
          onClick={() => onTabChange("developer")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-medium border-b-2 transition-colors -mb-px",
            activeTab === "developer"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-content-secondary hover:text-content-primary"
          )}
        >
          <Code className="h-4 w-4" />
          <span>Developer Claims ({devCount})</span>
        </button>
      </div>
    </div>
  );
}
