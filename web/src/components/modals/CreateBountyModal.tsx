"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { parseUnits, maxUint256 } from "viem";
import { X, AlertCircle, CheckCircle2, Loader2, ExternalLink, ShieldAlert } from "lucide-react";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI, ERC20_ABI, MOCK_USDT_ADDRESS } from "@/config/contracts";
import { formatBscScanUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface CreateBountyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateBountyModal({ isOpen, onClose, onSuccess }: CreateBountyModalProps) {
  const { address: wagmiAddress, isConnected } = useAccount();
  const { user, authenticated } = usePrivy();
  const address = wagmiAddress || (user?.wallet?.address as `0x${string}` | undefined);
  const isWalletActive = Boolean(isConnected || authenticated);

  const [issueUrl, setIssueUrl] = useState("");
  const [amount, setAmount] = useState("100");
  const [durationDays, setDurationDays] = useState("14");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amountParsed = parseUnits(amount || "0", 18);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, BOUNTRA_ESCROW_ADDRESS] : undefined,
    query: {
      enabled: Boolean(address && isOpen)
    }
  });

  const needsApproval = allowance === undefined || allowance < amountParsed;

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    reset: resetApprove
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveTxHash
  });

  const {
    writeContract: writeCreateBounty,
    data: createTxHash,
    isPending: isCreatePending,
    reset: resetCreate
  } = useWriteContract();

  const { isLoading: isCreateConfirming, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({
    hash: createTxHash
  });

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      resetApprove();
      resetCreate();
      if (address) {
        refetchAllowance();
      }
    }
  }, [isOpen, address, refetchAllowance, resetApprove, resetCreate]);

  // When approve succeeds, refetch allowance so button flips to Step 2
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

  // When create succeeds, trigger parent callback
  useEffect(() => {
    if (isCreateSuccess && onSuccess) {
      onSuccess();
    }
  }, [isCreateSuccess, onSuccess]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApprove = () => {
    setErrorMsg(null);
    try {
      writeApprove({
        address: MOCK_USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BOUNTRA_ESCROW_ADDRESS, maxUint256]
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to trigger approval");
    }
  };

  const handleCreate = () => {
    setErrorMsg(null);
    if (!issueUrl.trim().startsWith("https://github.com/")) {
      setErrorMsg("Please enter a valid GitHub issue URL (e.g. https://github.com/owner/repo/issues/12)");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Please enter a valid bounty amount greater than 0");
      return;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(durationDays) * 86400);

    try {
      writeCreateBounty({
        address: BOUNTRA_ESCROW_ADDRESS,
        abi: BOUNTRA_ESCROW_ABI,
        functionName: "createBounty",
        args: [issueUrl.trim(), MOCK_USDT_ADDRESS, amountParsed, deadline]
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send create bounty transaction");
    }
  };

  const resetAll = () => {
    resetApprove();
    resetCreate();
    setIssueUrl("");
    setAmount("100");
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-surface-border bg-surface-secondary p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-content-primary">Create New Escrow Bounty</h2>
            <p className="text-xs text-content-secondary">
              Lock funds on BSC Testnet. AI audits PRs and releases payout upon completion.
            </p>
          </div>
          <button
            onClick={resetAll}
            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-tertiary hover:text-content-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isCreateSuccess ? (
          <div className="py-6 flex flex-col items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-status-success mb-3" />
            <h3 className="text-base font-bold text-content-primary mb-1">Bounty Escrow Created!</h3>
            <p className="text-xs text-content-secondary max-w-sm mb-4">
              Your bounty is now live on BNB Smart Chain Testnet. Developers can submit PRs to start autonomous AI auditing.
            </p>
            {createTxHash && (
              <a
                href={formatBscScanUrl("tx", createTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-primary hover:underline mb-6"
              >
                <span>View on BscScan Testnet</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={resetAll}
              className="w-full rounded-lg bg-brand-primary text-black font-semibold text-xs py-2.5 hover:bg-brand-hover transition-colors"
            >
              Done & Return to Workspace
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {!isWalletActive && (
              <div className="p-3 rounded-lg border border-status-warning/30 bg-amber-950/20 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Please connect your wallet first to create and fund an on-chain bounty escrow.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono font-medium text-content-secondary mb-1.5">
                GitHub Issue URL
              </label>
              <input
                type="url"
                placeholder="https://github.com/bountra/core-contracts/issues/42"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface-primary px-3.5 py-2 text-xs font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none"
              />
              <span className="block mt-1 text-[10px] text-content-muted">
                The agent parses repo, issue requirements, and acceptance criteria from this URL.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono font-medium text-content-secondary mb-1.5">
                  Reward Amount (USDT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-surface-border bg-surface-primary px-3.5 py-2 text-xs font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-content-muted">
                    USDT
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-content-secondary mb-1.5">
                  Expiry Duration
                </label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface-primary px-3.5 py-2 text-xs font-mono text-content-primary focus:border-brand-primary focus:outline-none"
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-surface-border bg-surface-primary/60 p-3 text-xs font-mono space-y-1.5">
              <div className="flex justify-between text-content-secondary">
                <span>Escrow Contract:</span>
                <span className="text-content-primary">BountraEscrow.sol</span>
              </div>
              <div className="flex justify-between text-content-secondary">
                <span>Network:</span>
                <span className="text-brand-primary">BNB Smart Chain Testnet (97)</span>
              </div>
              <div className="flex justify-between text-content-secondary">
                <span>Token Asset:</span>
                <span className="text-status-success">Mock BEP-20 USDT</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg border border-status-danger/30 bg-red-950/20 text-xs text-status-danger font-mono flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              {needsApproval ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={!isWalletActive || isApprovePending || isApproveConfirming}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-primary text-black font-semibold text-xs py-2.5 hover:bg-brand-hover transition-colors disabled:opacity-50"
                >
                  {isApprovePending || isApproveConfirming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Approving USDT on BSC Testnet...</span>
                    </>
                  ) : (
                    <span>Step 1: Approve USDT Spending</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!isWalletActive || isCreatePending || isCreateConfirming}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-primary text-black font-semibold text-xs py-2.5 hover:bg-brand-hover transition-colors disabled:opacity-50"
                >
                  {isCreatePending || isCreateConfirming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Confirming Escrow Deposit...</span>
                    </>
                  ) : (
                    <span>Deposit Funds & Create Escrow</span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={resetAll}
                className="w-full rounded-lg border border-surface-border bg-surface-tertiary text-content-secondary font-medium text-xs py-2 hover:bg-surface-primary hover:text-content-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
