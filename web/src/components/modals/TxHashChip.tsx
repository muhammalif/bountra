"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { formatBscScanUrl } from "@/lib/utils";

/**
 * Shows a transaction hash the way a wallet does: the raw hex, selectable and
 * copyable, next to an explorer link.
 *
 * The hash is the receipt a judge can verify independently — a link labelled
 * "View on explorer" hides the value behind a click and cannot be pasted into a
 * verification tool. Both are provided, but the hex comes first.
 *
 * Renders nothing when the hash is missing. Callers pass a live hash from the
 * claim they just sent, or the recorded one from the agent when reading a bounty
 * back later, and either can legitimately be absent.
 */
export function TxHashChip({
  hash,
  label = "Transaction hash",
  className,
}: {
  hash?: string | null;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!hash) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      clearTimeout(timer.current);
      // Clear the confirmation before it reads as a permanent state; the label
      // reverts to the copy affordance so the row still invites a second copy.
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be denied; the hash is selectable text either way.
    }
  };

  return (
    <div
      className={`w-full rounded-xl border border-surface-border bg-surface-tertiary p-3 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-content-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Transaction hash copied" : "Copy transaction hash"}
          className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-secondary px-2 py-1 font-mono text-[10px] text-content-secondary transition-colors hover:text-content-primary active:scale-[0.98] min-h-[28px]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-status-success" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <p
        className="font-mono text-[11px] leading-relaxed break-all text-content-primary select-all"
        title={hash}
      >
        {hash}
      </p>

      <a
        href={formatBscScanUrl("tx", hash)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 mt-2.5 font-mono text-[11px] text-brand-primary hover:underline min-h-[28px]"
      >
        <span>View on BscScan</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
