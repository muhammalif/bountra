"use client";

import { ShieldCheck, Code } from "lucide-react";
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
