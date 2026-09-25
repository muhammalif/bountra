"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { X, ExternalLink, ShieldCheck, CheckCircle2, Loader2, Sparkles, AlertCircle, Copy, Check } from "lucide-react";
import { BountyItem } from "@/types/bounty";
import { BOUNTRA_ESCROW_ADDRESS, BOUNTRA_ESCROW_ABI } from "@/config/contracts";
import { AUDIT_SCENARIOS } from "@/components/terminal/audit-scenarios";
import { formatBscScanUrl, formatAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ClaimBountyDrawerProps {
  bounty: BountyItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClaimBountyDrawer({
  bounty,
  isOpen,
  onClose,
  onSuccess
}: ClaimBountyDrawerProps) {
  const { address, isConnected } = useAccount();
  const [prUrl, setPrUrl] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [signature, setSignature] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (bounty) {
      setPrUrl(`${bounty.issueUrl.replace("/issues/", "/pull/")}`);
      setCommitHash("0xa4b19c8f0293d8b871928471c9a1028471928471");
    }
  }, [bounty]);

  const {
    writeContract: writeClaim,
    data: claimTxHash,
    isPending: isClaimPending,
    reset: resetClaim
  } = useWriteContract();

  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimTxHash
  });

  useEffect(() => {
    if (isClaimSuccess && onSuccess) {
      onSuccess();
    }
  }, [isClaimSuccess, onSuccess]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !bounty) return null;

  const handleAutofillDemoProof = () => {
    const cleanScenario = AUDIT_SCENARIOS[0];
    if (cleanScenario && cleanScenario.signatureData) {
      setPrUrl(`https://github.com/${cleanScenario.repo}/pull/${cleanScenario.prNumber}`);
      setCommitHash("0x7f8a92b456381029384756281928475629102938");
      setSignature(cleanScenario.signatureData.signature);
      setErrorMsg(null);
    }
  };

  const handleClaim = () => {
    setErrorMsg(null);
    if (!address) {
      setErrorMsg("Please connect your developer wallet to claim.");
      return;
    }
    if (!prUrl.startsWith("https://github.com/")) {
      setErrorMsg("Invalid PR URL format.");
      return;
    }
    if (!commitHash || commitHash.length < 10) {
      setErrorMsg("Please provide a valid commit hash.");
      return;
    }
    if (!signature.startsWith("0x") || signature.length < 130) {
      setErrorMsg("Invalid ECDSA cryptographic signature. Expected 65-byte hex string (0x...).");
      return;
    }

    try {
      writeClaim({
        address: BOUNTRA_ESCROW_ADDRESS,
        abi: BOUNTRA_ESCROW_ABI,
        functionName: "claimBounty",
        args: [
          BigInt(bounty.id),
          address,
          prUrl.trim(),
          commitHash.trim(),
          signature.trim() as `0x${string}`
        ]
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to trigger claim transaction");
    }
  };

  const resetAll = () => {
    resetClaim();
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-surface-secondary border-l border-surface-border p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
          <div>
            <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-5">
              <div>
                <span className="font-mono text-[10px] text-content-muted uppercase">
                  Bounty ID #{bounty.id}
                </span>
                <h2 className="text-base font-bold text-content-primary truncate max-w-[260px]">
                  {bounty.title}
                </h2>
              </div>
              <button
                onClick={resetAll}
                className="rounded-lg p-1.5 text-content-muted hover:bg-surface-tertiary hover:text-content-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isClaimSuccess ? (
              <div className="py-10 flex flex-col items-center text-center">
                <CheckCircle2 className="h-14 w-14 text-status-success mb-3 animate-bounce" />
                <h3 className="text-lg font-bold text-content-primary mb-1">
                  Bounty Claimed Successfully!
                </h3>
                <p className="text-xs text-content-secondary mb-4 leading-relaxed">
                  {bounty.amountFormatted} {bounty.tokenSymbol} has been transferred directly from the on-chain escrow vault to your wallet address.
                </p>
                {claimTxHash && (
                  <a
                    href={formatBscScanUrl("tx", claimTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-primary hover:underline mb-6"
                  >
                    <span>View Settlement on BscScan</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={resetAll}
                  className="w-full rounded-lg bg-brand-primary text-black font-semibold text-xs py-2.5 hover:bg-brand-hover transition-colors"
                >
                  Close & Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-surface-border bg-surface-primary/70 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-content-muted uppercase">Escrow Locked Reward</span>
                    <span className="font-mono text-xs font-semibold text-status-success">Ready for Release</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-bold text-brand-primary">
                      {bounty.amountFormatted}
                    </span>
                    <span className="font-mono text-xs font-medium text-content-secondary">
                      {bounty.tokenSymbol}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-surface-border bg-surface-tertiary/40 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-content-muted">Target Repo:</span>
                    <span className="text-content-primary font-semibold">{bounty.repo}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-content-muted">Creator:</span>
                    <span className="text-content-primary">{formatAddress(bounty.creator)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutofillDemoProof}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-xs font-mono text-brand-primary hover:bg-brand-primary/20 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Autofill Proof from Live Audit Terminal</span>
                </button>

                <div>
                  <label className="block text-xs font-mono font-medium text-content-secondary mb-1">
                    Claimant Wallet (Beneficiary)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={address || "Please connect wallet"}
                    className="w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2 text-xs font-mono text-content-muted"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-content-secondary mb-1">
                    GitHub Pull Request URL
                  </label>
                  <input
                    type="url"
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    placeholder="https://github.com/bountra/core-contracts/pull/43"
                    className="w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2 text-xs font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-content-secondary mb-1">
                    Audited Commit Hash
                  </label>
                  <input
                    type="text"
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2 text-xs font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-content-secondary mb-1">
                    AI Agent Cryptographic Signature
                  </label>
                  <textarea
                    rows={3}
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="0x... (65-byte ECDSA signature signed by agent 0x2e10...)"
                    className="w-full rounded-lg border border-surface-border bg-surface-primary p-2.5 text-[11px] font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none resize-none"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-lg border border-status-danger/30 bg-red-950/20 text-xs text-status-danger font-mono flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isClaimSuccess && (
            <div className="pt-4 border-t border-surface-border flex flex-col gap-2">
              <button
                onClick={handleClaim}
                disabled={!isConnected || isClaimPending || isClaimConfirming || bounty.claimed}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-primary text-black font-semibold text-xs py-2.5 hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {isClaimPending || isClaimConfirming ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Executing Escrow Claim on BSC Testnet...</span>
                  </>
                ) : bounty.claimed ? (
                  <span>Bounty Already Claimed</span>
                ) : (
                  <span>Claim {bounty.amountFormatted} {bounty.tokenSymbol} Now</span>
                )}
              </button>

              <button
                onClick={resetAll}
                className="w-full rounded-lg border border-surface-border bg-surface-tertiary text-content-secondary font-medium text-xs py-2 hover:bg-surface-primary hover:text-content-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
