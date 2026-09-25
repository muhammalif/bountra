"use client";

import { CheckCircle2, XCircle, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineTrackerProps {
  currentStage: number; // 1 to 5
  isComplete: boolean;
  isPassed: boolean;
  className?: string;
}

const STAGES = [
  { id: 1, name: "HMAC Ingest", shortDesc: "Webhook Validation" },
  { id: 2, name: "CI Hard Gate", shortDesc: "Test Suite Passing" },
  { id: 3, name: "Anti-Tamper", shortDesc: "Protected Diff Check" },
  { id: 4, name: "Bountra Agent Audit", shortDesc: "AST Security Analysis" },
  { id: 5, name: "ECDSA Signer", shortDesc: "On-Chain Payload Sign" }
];

export function PipelineTracker({
  currentStage,
  isComplete,
  isPassed,
  className
}: PipelineTrackerProps) {
  return (
    <div className={cn("w-full border-b border-surface-border bg-surface-secondary/60 p-4", className)}>
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        {STAGES.map((stage) => {
          const isFinished = currentStage > stage.id || (currentStage === stage.id && isComplete);
          const isCurrent = currentStage === stage.id && !isComplete;
          const isFailed = currentStage === stage.id && isComplete && !isPassed;

          return (
            <div
              key={stage.id}
              className={cn(
                "flex flex-1 min-w-[130px] items-center gap-2.5 rounded-lg border px-3 py-2 transition-all",
                isFinished && isPassed
                  ? "border-status-success/30 bg-status-success/10 text-status-success"
                  : isFailed
                  ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                  : isCurrent
                  ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary"
                  : "border-surface-border bg-surface-primary/50 text-content-muted"
              )}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-[10px] font-bold">
                {isFinished && isPassed ? (
                  <CheckCircle2 className="h-4 w-4 text-status-success" />
                ) : isFailed ? (
                  <XCircle className="h-4 w-4 text-status-danger" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary" />
                ) : (
                  <span>{stage.id}</span>
                )}
              </div>
              <div className="overflow-hidden">
                <span className="block truncate font-mono text-xs font-semibold text-content-primary">
                  {stage.name}
                </span>
                <span className="block truncate font-mono text-[10px] text-content-secondary">
                  {stage.shortDesc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
