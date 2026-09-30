"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BountyItem } from "@/types/bounty";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI } from "@/config/contracts";
import { formatBscScanUrl } from "@/lib/utils";
import { PlusCircle, RotateCcw, ExternalLink, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SponsorTabProps {
  bounties: BountyItem[];
  onCreateBounty: () => void;
  onRefresh: () => void;
}

export function SponsorTab({ bounties, onCreateBounty, onRefresh }: SponsorTabProps) {
  const [refundingId, setRefundingId] = useState<number | null>(null);

  const {
    writeContract: writeCancel,
    data: cancelTxHash,
    isPending: isCancelPending,
    reset: resetCancel
  } = useWriteContract();

  const { isLoading: isCancelConfirming, isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({
    hash: cancelTxHash
  });

  const handleRefund = (bountyId: number) => {
    setRefundingId(bountyId);
    try {
      writeCancel({
        address: BOUNTRA_ESCROW_ADDRESS,
        abi: BOUNTRA_ESCROW_ABI,
        functionName: "cancelBounty",
        args: [BigInt(bountyId)]
      });
    } catch (err) {
      console.error(err);
    }
  };

  const onChainBounties = bounties.filter((bounty) => !bounty.isMock);
  const totalDeposited = onChainBounties.reduce((acc, curr) => acc + parseFloat(curr.amountFormatted), 0);
  const activeCount = onChainBounties.filter((b) => b.status === "open" || b.status === "in_review").length;
  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Total Deposited</span>
          <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-brand-primary">
            {totalDeposited.toLocaleString()} USDT
          </div>
          <span className="text-[10px] font-mono text-content-secondary">Across on-chain escrows</span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl border border-surface-border bg-surface-secondary/70">
          <span className="text-[10px] font-mono uppercase text-content-muted">Active Tasks</span>
          <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-content-primary">
            {activeCount} Tasks
          </div>
          <span className="text-[10px] font-mono text-content-secondary">Awaiting PR submission</span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl border border-surface-border bg-surface-secondary/70 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-content-muted">Sponsor Action</span>
          <button
            onClick={onCreateBounty}
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary text-black font-semibold text-xs py-2 hover:bg-brand-hover transition-all active:scale-95 min-h-[44px]"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Fund New Bounty</span>
          </button>
        </div>
      </div>

      {isCancelSuccess && cancelTxHash && (
        <div className="p-3.5 rounded-xl border border-status-success/30 bg-emerald-950/20 flex items-center justify-between text-xs font-mono text-status-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Escrow refund processed! Funds returned to your wallet.</span>
          </div>
          <a
            href={formatBscScanUrl("tx", cancelTxHash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-brand-primary hover:underline"
          >
            <span>View BscScan</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {bounties.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-surface-border rounded-xl bg-surface-secondary/30">
          <p className="font-mono text-sm text-content-secondary mb-3">
            You have not created any bounty escrows yet.
          </p>
          <button
            onClick={onCreateBounty}
            className="px-4 py-2 rounded-lg bg-brand-primary text-black font-semibold text-xs hover:bg-brand-hover transition-colors"
          >
            Create Your First Escrow
          </button>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {bounties.map((b) => {
              const isExpired = nowSec > b.deadline;
              const canRefund = isExpired && !b.claimed && !b.cancelled;
              const isRefundingThis = refundingId === b.id && (isCancelPending || isCancelConfirming);

              return (
                <div key={b.id} className="rounded-xl border border-surface-border bg-surface-secondary p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-content-muted">#{b.id}</span>
                        {b.isMock && (
                          <span className="rounded border border-surface-border bg-surface-tertiary px-1.5 py-0.5 font-mono text-[9px] font-semibold text-content-muted">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm font-semibold text-content-primary truncate">
                        {b.title}
                      </div>
                      <a
                        href={b.issueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-brand-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        <span>{b.repo}#{b.issueNumber}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium border uppercase shrink-0",
                        b.status === "open" && "border-status-success/30 bg-status-success/10 text-status-success",
                        b.status === "in_review" && "border-status-warning/30 bg-status-warning/10 text-status-warning",
                        b.status === "claimed" && "border-surface-border bg-surface-tertiary text-content-muted",
                        b.status === "cancelled" && "border-status-danger/30 bg-status-danger/10 text-status-danger"
                      )}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-lg font-bold text-brand-primary">
                      {b.amountFormatted} {b.tokenSymbol}
                    </span>
                    <span className="text-content-secondary">
                      {isExpired ? (
                        <span className="text-status-danger font-semibold">Expired</span>
                      ) : (
                        <span>{Math.ceil((b.deadline - nowSec) / 86400)}d left</span>
                      )}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-surface-border/60">
                    {canRefund ? (
                      <button
                        onClick={() => handleRefund(b.id)}
                        disabled={isRefundingThis}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
                      >
                        {isRefundingThis ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Refunding...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Refund Deposit</span>
                          </>
                        )}
                      </button>
                    ) : b.claimed ? (
                      <span className="block text-center text-xs text-content-muted py-1">Payout Settled</span>
                    ) : b.cancelled ? (
                      <span className="block text-center text-xs text-status-danger py-1">Refunded</span>
                    ) : (
                      <span className="block text-center text-xs text-content-secondary py-1">Locked in Vault</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border border-surface-border bg-surface-secondary overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-surface-tertiary border-b border-surface-border text-content-muted uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Bounty ID</th>
                    <th className="py-3 px-4">Repository / Issue</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Deadline</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Escrow Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {bounties.map((b) => {
                    const isExpired = nowSec > b.deadline;
                    const canRefund = isExpired && !b.claimed && !b.cancelled;
                    const isRefundingThis = refundingId === b.id && (isCancelPending || isCancelConfirming);

                    return (
                      <tr key={b.id} className="hover:bg-surface-tertiary/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-content-primary">
                          <div className="flex items-center gap-2">
                            <span>#{b.id}</span>
                            {b.isMock && (
                              <span className="rounded border border-surface-border bg-surface-tertiary px-1.5 py-0.5 font-mono text-[9px] font-semibold text-content-muted">
                                DEMO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-content-primary truncate max-w-xs">
                            {b.title}
                          </div>
                          <a
                            href={b.issueUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-brand-primary hover:underline inline-flex items-center gap-1"
                          >
                            <span>{b.repo}#{b.issueNumber}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </td>
                        <td className="py-3.5 px-4 text-brand-primary font-bold">
                          {b.amountFormatted} {b.tokenSymbol}
                        </td>
                        <td className="py-3.5 px-4 text-content-secondary">
                          {isExpired ? (
                            <span className="text-status-danger font-semibold">Expired</span>
                          ) : (
                            <span>{Math.ceil((b.deadline - nowSec) / 86400)}d left</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-medium border uppercase",
                              b.status === "open" && "border-status-success/30 bg-status-success/10 text-status-success",
                              b.status === "in_review" && "border-status-warning/30 bg-status-warning/10 text-status-warning",
                              b.status === "claimed" && "border-surface-border bg-surface-tertiary text-content-muted",
                              b.status === "cancelled" && "border-status-danger/30 bg-status-danger/10 text-status-danger"
                            )}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {canRefund ? (
                            <button
                              onClick={() => handleRefund(b.id)}
                              disabled={isRefundingThis}
                              className="inline-flex items-center gap-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                            >
                              {isRefundingThis ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Refunding...</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Refund Deposit</span>
                                </>
                              )}
                            </button>
                          ) : b.claimed ? (
                            <span className="text-[11px] text-content-muted">Payout Settled</span>
                          ) : b.cancelled ? (
                            <span className="text-[11px] text-status-danger">Refunded</span>
                          ) : (
                            <span className="text-[11px] text-content-secondary" title="Refund available after deadline passes">Locked in Vault</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
