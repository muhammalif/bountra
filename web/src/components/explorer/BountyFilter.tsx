"use client";

import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { BountyStatus } from "@/types/bounty";
import { cn } from "@/lib/utils";

interface BountyFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  totalCount: number;
}

export function BountyFilter({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  sortBy,
  onSortChange,
  totalCount
}: BountyFilterProps) {
  const tabs = [
    { id: "all", label: "All Bounties" },
    { id: "open", label: "Open for PR" },
    { id: "in_review", label: "In Review" },
    { id: "ready_to_claim", label: "Ready to Claim" },
    { id: "claimed", label: "Claimed" },
    { id: "rejected", label: "Rejected" }
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-muted" />
          <input
            type="text"
            placeholder="Search by repo, title, or keyword..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface-secondary pl-10 pr-4 py-2 text-xs font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-secondary px-3 py-2 text-xs font-mono text-content-secondary">
            <SlidersHorizontal className="h-3.5 w-3.5 text-content-muted" />
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-transparent text-content-primary font-semibold focus:outline-none cursor-pointer"
            >
              <option value="reward_desc" className="bg-surface-secondary text-content-primary">
                Highest Reward
              </option>
              <option value="newest" className="bg-surface-secondary text-content-primary">
                Newest First
              </option>
              <option value="deadline_asc" className="bg-surface-secondary text-content-primary">
                Ending Soonest
              </option>
            </select>
          </div>

          <span className="hidden sm:inline-block font-mono text-xs text-content-muted">
            {totalCount} bounties
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-surface-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onStatusChange(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-md font-mono text-xs transition-colors whitespace-nowrap",
              selectedStatus === tab.id
                ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30 font-semibold"
                : "text-content-secondary hover:text-content-primary hover:bg-surface-secondary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
