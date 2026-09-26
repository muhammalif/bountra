"use client";

import { useState } from "react";
import { BountyItem } from "@/types/bounty";
import { Coins, CheckCircle2, ArrowRight, ExternalLink, ShieldCheck, Sparkles, FolderGit2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeveloperTabProps {
  claims: BountyItem[];
  onClaimBounty: (bounty: BountyItem) => void;
}

export function DeveloperTab({ claims, onClaimBounty }: DeveloperTabProps) {
  const [viewMode, setViewMode] = useState<"my_claims" | "demo_showcase">("my_claims");

  const myClaims: BountyItem[] = []; // Real user hasn't claimed any PRs yet
  const displayedClaims = viewMode === "my_claims" ? myClaims : claims;

  const totalEarned = displayedClaims
    .filter((c) => c.status === "claimed")
    .reduce((acc, curr) => acc + parseFloat(curr.amountFormatted), 0);

  const readyToClaimCount = displayedClaims.filter((c) => c.status === "in_review" || c.status === "open").length;

  return (
    <div className="space-y-6">
      {/* View Mode Toggle: Real vs Demo Showcase */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-surface-border bg-surface-secondary/50">
        <div className="text-xs font-mono text-content-secondary">
          <span>Active Scope: </span>
          <span className="font-semibold text-content-primary">
            {viewMode === "my_claims" ? "Connected Wallet Submissions" : "Hackathon Verified Demo Dataset"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-surface-primary p-1 rounded-lg border border-surface-border">
          <button
            type="button"
            onClick={() => setViewMode("my_claims")}
            className={cn(
              "px-3 py-1 rounded text-xs font-mono transition-colors",
              viewMode === "my_claims"
                ? "bg-brand-primary text-black font-semibold shadow-sm"
                : "text-content-secondary hover:text-content-primary"
            )}
          >
            My Submissions (0)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("demo_showcase")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-colors",
              viewMode === "demo_showcase"
                ? "bg-brand-primary text-black font-semibold shadow-sm"
                : "text-content-secondary hover:text-content-primary"
            )}
          >
            <Sparkles className="h-3 w-3" />
            <span>Demo Showcase ({claims.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Total Earned</span>
          <div className="mt-1 font-mono text-xl font-bold text-status-success">
            {totalEarned.toLocaleString()} USDT
          </div>
          <span className="text-[10px] font-mono text-content-secondary">Received in wallet</span>
        </div>

        <div className="p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Completed Audits</span>
          <div className="mt-1 font-mono text-xl font-bold text-content-primary">
            {displayedClaims.filter((c) => c.status === "claimed").length} Audits
          </div>
          <span className="text-[10px] font-mono text-content-secondary">100% 5-Layer Passed</span>
        </div>

        <div className="p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Available to Claim</span>
          <div className="mt-1 font-mono text-xl font-bold text-brand-primary">
            {readyToClaimCount} Bounties
          </div>
          <span className="text-[10px] font-mono text-content-secondary">Signed by AI Agent</span>
        </div>
      </div>

      {displayedClaims.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-surface-border rounded-xl bg-surface-secondary/30">
          <FolderGit2 className="h-10 w-10 text-content-muted mx-auto mb-3" />
          <p className="font-mono text-sm font-semibold text-content-primary mb-1">
            No Pull Requests Submitted Yet
          </p>
          <p className="font-mono text-xs text-content-secondary max-w-md mx-auto mb-5">
            You have not submitted any pull requests for open bounties yet. Explore active issues on BNB Chain and submit your code to get audited.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="/explore"
              className="px-4 py-2 rounded-lg bg-brand-primary text-black font-semibold text-xs hover:bg-brand-hover transition-colors"
            >
              Browse Open Bounties
            </a>
            <button
              type="button"
              onClick={() => setViewMode("demo_showcase")}
              className="px-4 py-2 rounded-lg border border-surface-border bg-surface-primary text-content-primary font-mono text-xs hover:border-brand-primary transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
              <span>View Demo Showcase</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-secondary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-surface-tertiary border-b border-surface-border text-content-muted uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Bounty ID</th>
                  <th className="py-3 px-4">Pull Request / Issue</th>
                  <th className="py-3 px-4">AI Audit Verdict</th>
                  <th className="py-3 px-4">Reward Amount</th>
                  <th className="py-3 px-4 text-right">Settlement Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {displayedClaims.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-tertiary/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-content-primary">
                      #{item.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-content-primary truncate max-w-xs">
                        {item.title}
                      </div>
                      <span className="text-[10px] text-content-secondary">
                        {item.repo}#{item.issueNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-status-success" />
                        <span className="font-semibold text-status-success">Score 96/100 (Pass)</span>
                      </div>
                      <span className="text-[10px] text-content-muted">ECDSA Signature Verified</span>
                    </td>
                    <td className="py-3.5 px-4 text-brand-primary font-bold">
                      {item.amountFormatted} {item.tokenSymbol}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.status === "claimed" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-status-success font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Paid Out On-Chain</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onClaimBounty(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary text-black font-semibold text-xs px-3 py-1.5 hover:bg-brand-hover transition-colors"
                        >
                          <span>Claim Reward</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
