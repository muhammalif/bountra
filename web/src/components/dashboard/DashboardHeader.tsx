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
    <div className="flex flex-col gap-4 sm:gap-6 border-b border-surface-border pb-6 sm:pb-8 mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-brand-primary mb-1 block">
            Bountra Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            User Dashboard
          </h1>
          <p className="mt-1 text-xs text-content-secondary max-w-xl leading-relaxed">
            Manage your escrow deposits, claim refunds for expired tasks, and view your payout history.
          </p>
        </div>

        {address && (
          <div className="flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface-secondary/80 px-3.5 sm:px-4 py-2 sm:py-2.5 backdrop-blur-sm self-start sm:self-auto">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-surface-tertiary flex items-center justify-center text-brand-primary shrink-0">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div>
              <span className="block text-[9px] sm:text-[10px] font-mono text-content-muted uppercase">Connected Wallet</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-content-primary">
                  {formatAddress(address)}
                </span>
                <button
                  onClick={copyAddress}
                  title="Copy address"
                  className="text-content-muted hover:text-brand-primary transition-colors p-0.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-surface-border/60 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          onClick={() => onTabChange("sponsor")}
          className={cn(
            "flex items-center gap-2 px-3 sm:px-4 py-2.5 font-mono text-xs font-medium border-b-2 transition-colors -mb-px shrink-0 min-h-[40px]",
            activeTab === "sponsor"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-content-secondary hover:text-content-primary"
          )}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Sponsor Escrows ({sponsorCount})</span>
        </button>

        <button
          onClick={() => onTabChange("developer")}
          className={cn(
            "flex items-center gap-2 px-3 sm:px-4 py-2.5 font-mono text-xs font-medium border-b-2 transition-colors -mb-px shrink-0 min-h-[40px]",
            activeTab === "developer"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-content-secondary hover:text-content-primary"
          )}
        >
          <Code className="h-4 w-4 shrink-0" />
          <span>Developer Claims ({devCount})</span>
        </button>
      </div>
    </div>
  );
}
