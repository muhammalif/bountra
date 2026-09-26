"use client";

import { ExternalLink, Clock, ShieldCheck, ArrowRight, User } from "lucide-react";
import { BountyItem } from "@/types/bounty";
import { formatAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface BountyCardProps {
  bounty: BountyItem;
  onSelect: (bounty: BountyItem) => void;
}

export function BountyCard({ bounty, onSelect }: BountyCardProps) {
  const getStatusBadge = (status: BountyItem["status"]) => {
    switch (status) {
      case "open":
        return {
          label: "Open for PR",
          className: "border-status-success/30 bg-status-success/10 text-status-success"
        };
      case "in_review":
        return {
          label: "Audit in Review",
          className: "border-status-warning/30 bg-status-warning/10 text-status-warning"
        };
      case "ready_to_claim":
        return {
          label: "Audit Passed",
          className: "border-brand-primary/40 bg-brand-primary/10 text-brand-primary font-semibold"
        };
      case "claimed":
        return {
          label: "Claimed & Paid",
          className: "border-surface-border bg-surface-tertiary text-content-muted"
        };
      case "rejected":
        return {
          label: "Audit Rejected",
          className: "border-status-danger/30 bg-red-950/40 text-status-danger"
        };
      case "cancelled":
        return {
          label: "Cancelled",
          className: "border-status-danger/30 bg-status-danger/10 text-status-danger"
        };
    }
  };

  const badge = getStatusBadge(bounty.status);
  const daysRemaining = Math.max(0, Math.ceil((bounty.deadline - Date.now() / 1000) / 86400));

  return (
    <div className="flex flex-col justify-between rounded-xl border border-surface-border bg-surface-secondary/70 p-5 backdrop-blur-sm transition-all hover:border-brand-primary/40 hover:bg-surface-secondary">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-mono text-xs font-semibold text-content-secondary truncate max-w-[200px]">
            {bounty.repo}#{bounty.issueNumber}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-medium border shrink-0", badge.className)}>
            {badge.label}
          </span>
        </div>

        <h3 className="text-base font-semibold text-content-primary line-clamp-2 mb-2 leading-snug">
          {bounty.title}
        </h3>

        <p className="text-xs text-content-secondary line-clamp-2 mb-4 leading-relaxed">
          {bounty.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {bounty.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-surface-tertiary px-2 py-0.5 font-mono text-[10px] text-content-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-surface-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-mono text-content-muted uppercase">Reward</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-brand-primary">
                {bounty.amountFormatted}
              </span>
              <span className="text-xs font-mono font-medium text-content-secondary">
                {bounty.tokenSymbol}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-[10px] font-mono text-content-muted uppercase">Deadline</span>
            <div className="flex items-center gap-1 text-xs font-mono text-content-secondary">
              <Clock className="w-3 h-3 text-content-muted" />
              <span>{bounty.claimed ? "Completed" : `${daysRemaining}d left`}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onSelect(bounty)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-surface-tertiary hover:bg-brand-primary hover:text-black text-content-primary px-3 py-2 text-xs font-semibold transition-colors"
          >
            <span>
              {bounty.status === "claimed"
                ? "View Audit Proof"
                : bounty.status === "ready_to_claim"
                ? "View Audit Verdict (Passed)"
                : bounty.status === "in_review"
                ? "View Audit Status"
                : bounty.status === "rejected"
                ? "View Rejection Report"
                : bounty.status === "cancelled"
                ? "View Details"
                : "View Issue & Instructions"}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <a
            href={bounty.issueUrl}
            target="_blank"
            rel="noreferrer"
            title="Open GitHub Issue"
            className="rounded-lg border border-surface-border bg-surface-primary hover:border-surface-border-hover p-2 text-content-muted hover:text-content-primary transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
