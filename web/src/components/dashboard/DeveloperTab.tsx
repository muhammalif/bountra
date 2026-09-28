"use client";

import { BountyItem } from "@/types/bounty";
import { ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

interface DeveloperTabProps {
  claims: BountyItem[];
  onClaimBounty: (bounty: BountyItem) => void;
}

export function DeveloperTab({ claims, onClaimBounty }: DeveloperTabProps) {
  const totalEarned = claims
    .filter((c) => c.status === "claimed")
    .reduce((acc, curr) => acc + parseFloat(curr.amountFormatted), 0);

  const readyToClaimCount = claims.filter(
    (c) => c.status === "in_review" || c.status === "open"
  ).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Total Earned</span>
          <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-status-success">
            {totalEarned.toLocaleString()} USDT
          </div>
          <span className="text-[10px] font-mono text-content-secondary">Received in wallet</span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Completed Audits</span>
          <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-content-primary">
            {claims.filter((c) => c.status === "claimed").length} Audits
          </div>
          <span className="text-[10px] font-mono text-content-secondary">100% 5-Layer Passed</span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Available to Claim</span>
          <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-brand-primary">
            {readyToClaimCount} Bounties
          </div>
          <span className="text-[10px] font-mono text-content-secondary">Signed by Bountra Agent</span>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 sm:hidden">
        {claims.map((item) => (
          <div key={item.id} className="rounded-xl border border-surface-border bg-surface-secondary p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[10px] text-content-muted">#{item.id}</span>
                <div className="font-mono text-sm font-semibold text-content-primary truncate">
                  {item.title}
                </div>
                <span className="text-[10px] text-content-secondary">
                  {item.repo}#{item.issueNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ShieldCheck className="h-3.5 w-3.5 text-status-success" />
                <span className="font-mono text-[10px] font-semibold text-status-success">96/100</span>
              </div>
            </div>

            <div className="flex items-center justify-between font-mono">
              <span className="text-lg font-bold text-brand-primary">
                {item.amountFormatted} {item.tokenSymbol}
              </span>
              <span className="text-[10px] text-content-muted">ECDSA Verified</span>
            </div>

            <div className="pt-1 border-t border-surface-border/60">
              {item.status === "claimed" ? (
                <span className="flex items-center justify-center gap-1.5 text-xs text-status-success font-semibold py-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Paid Out On-Chain</span>
                </span>
              ) : (
                <button
                  onClick={() => onClaimBounty(item)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary text-black font-semibold text-xs px-3 py-2 hover:bg-brand-hover transition-all active:scale-[0.98] min-h-[44px]"
                >
                  <span>Claim Reward</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-xl border border-surface-border bg-surface-secondary overflow-hidden">
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
              {claims.map((item) => (
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
    </div>
  );
}
