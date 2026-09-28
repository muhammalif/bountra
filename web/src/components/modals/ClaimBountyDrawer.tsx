"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { X, ExternalLink, ShieldCheck, CheckCircle2, Loader2, Sparkles, AlertCircle, Clock, Eye, GitPullRequest, ArrowRight, Zap } from "lucide-react";
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
  mode?: "public" | "claim";
}

export function ClaimBountyDrawer({
  bounty,
  isOpen,
  onClose,
  onSuccess,
  mode = "public"
}: ClaimBountyDrawerProps) {
  const { address: wagmiAddress, isConnected } = useAccount();
  const { user, authenticated } = usePrivy();
  const address = wagmiAddress || (user?.wallet?.address as `0x${string}` | undefined);
  const isWalletActive = Boolean(isConnected || authenticated);

  const [showSubmitProof, setShowSubmitProof] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [signature, setSignature] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bounty) {
      if (bounty.status === "ready_to_claim") {
        const cleanScenario = AUDIT_SCENARIOS[0];
        setPrUrl(`https://github.com/${cleanScenario.repo}/pull/${cleanScenario.prNumber}`);
        setCommitHash("0x7f8a92b456381029384756281928475629102938");
        setSignature(cleanScenario.signatureData?.signature || "");
        setShowSubmitProof(true);
      } else {
        setPrUrl(`${bounty.issueUrl.replace("/issues/", "/pull/")}`);
        setCommitHash("0xa4b19c8f0293d8b871928471c9a1028471928471");
        setSignature("");
        setShowSubmitProof(false);
      }
      setErrorMsg(null);
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

  const daysRemaining = Math.max(0, Math.ceil((bounty.deadline - Date.now() / 1000) / 86400));

  // ─── Render: Status-dependent content ───

  const renderBountyMeta = () => (
    <div className="space-y-3 mb-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-surface-border bg-surface-primary">
          <span className="block text-[10px] font-mono text-content-muted uppercase">Reward</span>
          <span className="font-mono text-sm font-bold text-brand-primary">
            {bounty.amountFormatted} {bounty.tokenSymbol}
          </span>
        </div>
        <div className="p-3 rounded-lg border border-surface-border bg-surface-primary">
          <span className="block text-[10px] font-mono text-content-muted uppercase">Deadline</span>
          <span className="font-mono text-sm font-semibold text-content-primary">
            {bounty.claimed ? "Completed" : `${daysRemaining}d remaining`}
          </span>
        </div>
      </div>
      <div className="p-3 rounded-lg border border-surface-border bg-surface-primary">
        <span className="block text-[10px] font-mono text-content-muted uppercase mb-1">Repository</span>
        <a
          href={bounty.issueUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-primary hover:underline"
        >
          <span>{bounty.repo}#{bounty.issueNumber}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {bounty.description && (
        <p className="text-xs text-content-secondary leading-relaxed">{bounty.description}</p>
      )}
    </div>
  );

  const renderStatusBadge = () => {
    const badges: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      open: {
        label: "Open for PR",
        className: "border-status-success/30 bg-status-success/10 text-status-success",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />
      },
      in_review: {
        label: "Audit in Review",
        className: "border-status-warning/30 bg-status-warning/10 text-status-warning",
        icon: <Clock className="h-3.5 w-3.5" />
      },
      ready_to_claim: {
        label: "Audit Passed",
        className: "border-brand-primary/40 bg-brand-primary/10 text-brand-primary",
        icon: <Sparkles className="h-3.5 w-3.5" />
      },
      claimed: {
        label: "Claimed & Paid",
        className: "border-surface-border bg-surface-tertiary text-content-muted",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />
      },
      rejected: {
        label: "Audit Rejected",
        className: "border-status-danger/30 bg-red-950/40 text-status-danger",
        icon: <AlertCircle className="h-3.5 w-3.5" />
      },
      cancelled: {
        label: "Cancelled",
        className: "border-status-danger/30 bg-status-danger/10 text-status-danger",
        icon: <AlertCircle className="h-3.5 w-3.5" />
      },
    };
    const b = badges[bounty.status];
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border", b.className)}>
        {b.icon}
        {b.label}
      </span>
    );
  };

  // ─── Ready to Claim: Public vs Developer Claim View ───
  const renderReadyToClaimContent = () => {
    if (mode === "claim") {
      return (
        <div className="space-y-4">
          {renderBountyMeta()}

          <div className="p-4 rounded-xl border border-brand-primary/30 bg-brand-primary/10">
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-brand-primary shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-brand-primary mb-0.5">
                  Audit Passed (Score: 96/100) — Claim Authorization Ready
                </h4>
                <p className="text-[11px] text-content-secondary leading-relaxed">
                  Bountra Agent has signed your submission. Review the claim parameters below and execute on-chain settlement to receive {bounty.amountFormatted} {bounty.tokenSymbol}.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono font-medium text-content-secondary mb-1">
                Claimant Wallet (Beneficiary)
              </label>
              <input
                type="text"
                disabled
                value={address || "Please connect wallet"}
                className="w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2.5 text-sm sm:text-xs font-mono text-content-muted"
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
                className="w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2.5 text-sm sm:text-xs font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none"
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
                className="w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2.5 text-sm sm:text-xs font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono font-medium text-content-secondary">
                  Bountra Agent Cryptographic Signature
                </label>
                <button
                  type="button"
                  onClick={handleAutofillDemoProof}
                  className="text-[10px] font-mono text-brand-primary hover:underline hover:text-brand-hover inline-flex items-center gap-1"
                >
                  <Zap className="h-3 w-3" />
                  <span>Autofill test signature</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="0x... (65-byte ECDSA signature signed by agent 0x2e10...)"
                className="w-full rounded-lg border border-surface-border bg-surface-primary p-2.5 text-sm sm:text-[11px] font-mono text-content-primary placeholder:text-content-muted focus:border-brand-primary focus:outline-none resize-none"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg border border-status-danger/30 bg-red-950/20 text-xs text-status-danger font-mono flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {renderBountyMeta()}

        <div className="p-4 rounded-xl border border-brand-primary/30 bg-brand-primary/10">
          <div className="flex items-start gap-3">
            <Sparkles className="h-8 w-8 text-brand-primary shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-brand-primary mb-1">
                Autonomous Audit Passed (Score: 96/100)
              </h4>
              <p className="text-xs text-content-secondary leading-relaxed">
                Bountra Agent has completed all 5 security verification layers and generated cryptographic authorization. Awaiting on-chain settlement by the developer in their Developer Hub.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-surface-border bg-surface-primary p-3 space-y-2 font-mono text-xs">
          <div className="flex justify-between text-content-muted">
            <span>Authorized Developer:</span>
            <span className="text-content-primary">{formatAddress("0xA116aBe137640B3C62Aa6b4Be08e79E07d664f13")}</span>
          </div>
          <div className="flex justify-between text-content-muted">
            <span>Escrow Payout:</span>
            <span className="text-brand-primary font-bold">{bounty.amountFormatted} {bounty.tokenSymbol}</span>
          </div>
          <div className="flex justify-between text-content-muted">
            <span>Cryptographic Proof:</span>
            <span className="text-status-success font-semibold">ECDSA Signature Ready</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-mono font-semibold text-content-primary uppercase">Audit Verification Checklist</h4>
          {[
            "1. CI Status Gate — Passed",
            "2. Test Immutability Check — Passed (Zero tampering)",
            "3. Anti-Prompt Injection Scan — Clean",
            "4. Static Analysis (AST) — Zero Critical Vulnerabilities",
            "5. Bountra Agent Evaluation — Score 96/100 (Pass)",
          ].map((step, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-surface-border bg-surface-primary">
              <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" />
              <span className="font-mono text-xs text-content-primary">{step}</span>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg border border-dashed border-surface-border bg-surface-primary/40 text-[11px] text-content-muted flex items-center justify-between">
          <span>Are you the developer who submitted this PR?</span>
          <a
            href="/dashboard"
            className="text-brand-primary font-mono font-semibold hover:underline inline-flex items-center gap-1"
          >
            <span>Claim in Developer Hub</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  };

  // ─── In Review: read-only audit progress view ───
  const renderInReviewContent = () => (
    <div className="space-y-4">
      {renderBountyMeta()}

      <div className="p-4 rounded-xl border border-status-warning/30 bg-amber-950/10">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-status-warning/20 flex items-center justify-center shrink-0">
            <Clock className="h-4.5 w-4.5 text-status-warning" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-content-primary mb-1">Bountra Agent Audit In Progress</h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              A developer has submitted a Pull Request for this bounty. The Bountra Agent is currently running the 5-layer autonomous security audit pipeline.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-xs font-mono font-semibold text-content-primary uppercase">Audit Pipeline Status</h4>
        {[
          { step: "CI Status Gate", status: "pass" },
          { step: "Test Immutability Check", status: "pass" },
          { step: "Anti-Prompt Injection Scan", status: "running" },
          { step: "Code Quality Evaluation", status: "pending" },
          { step: "ECDSA Signature Binding", status: "pending" },
        ].map((layer, idx) => (
          <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-surface-border bg-surface-primary">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-content-muted w-4">{idx + 1}.</span>
              <span className="font-mono text-xs text-content-primary">{layer.step}</span>
            </div>
            <span className={cn(
              "font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded",
              layer.status === "pass" && "text-status-success bg-status-success/10",
              layer.status === "running" && "text-status-warning bg-status-warning/10 animate-pulse",
              layer.status === "pending" && "text-content-muted bg-surface-tertiary",
            )}>
              {layer.status === "running" ? "Running..." : layer.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Claimed: view-only audit proof ───
  const renderClaimedContent = () => (
    <div className="space-y-4">
      {renderBountyMeta()}

      <div className="p-4 rounded-xl border border-status-success/30 bg-emerald-950/10">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-8 w-8 text-status-success shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-content-primary mb-1">Bounty Claimed & Settled</h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              This bounty has been successfully audited by Bountra Agent and {bounty.amountFormatted} {bounty.tokenSymbol} was released to the developer on-chain.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-xs font-mono font-semibold text-content-primary uppercase">Audit Verification</h4>
        {[
          "CI Status Gate — Passed",
          "Test Immutability Check — Passed",
          "Anti-Prompt Injection Scan — Clean",
          "Code Quality Evaluation — Score 96/100",
          "ECDSA Signature Binding — Verified",
        ].map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border border-surface-border bg-surface-primary">
            <ShieldCheck className="h-3.5 w-3.5 text-status-success shrink-0" />
            <span className="font-mono text-xs text-content-primary">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Rejected: Audit Failure Report ───
  const renderRejectedContent = () => (
    <div className="space-y-4">
      {renderBountyMeta()}

      <div className="p-4 rounded-xl border border-status-danger/30 bg-red-950/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-8 w-8 text-status-danger shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-status-danger mb-1">Autonomous Audit Verdict: REJECTED</h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              Bountra Agent flagged this submission for critical security vulnerabilities and anti-tampering violations. No funds were released.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-xs font-mono font-semibold text-content-primary uppercase">5-Layer Security Breakdown</h4>
        {[
          { label: "1. CI Status Gate", passed: true, note: "GitHub Actions passed" },
          { label: "2. Test Immutability", passed: false, note: "VIOLATION: modified test/Escrow.t.sol" },
          { label: "3. Prompt Injection Scan", passed: true, note: "Clean, no malicious comments" },
          { label: "4. Static Analysis (AST)", passed: false, note: "Reentrancy without nonReentrant guard" },
          { label: "5. Bountra Agent Evaluation", passed: false, note: "Verdict: REJECT (Score 32/100)" },
        ].map((layer, idx) => (
          <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-surface-border bg-surface-primary">
            <span className="font-mono text-xs text-content-primary">{layer.label}</span>
            <span className={cn(
              "font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded",
              layer.passed
                ? "bg-emerald-950/50 text-status-success border border-status-success/30"
                : "bg-red-950/50 text-status-danger border border-status-danger/30"
            )}>
              {layer.note}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Cancelled: read-only ───
  const renderCancelledContent = () => (
    <div className="space-y-4">
      {renderBountyMeta()}

      <div className="p-4 rounded-xl border border-status-danger/30 bg-red-950/10">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-8 w-8 text-status-danger shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-content-primary mb-1">Bounty Cancelled</h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              This bounty was cancelled by the sponsor after the deadline passed. The escrowed {bounty.amountFormatted} {bounty.tokenSymbol} has been refunded.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Open: Issue Guide & Work Instructions ───
  const renderOpenContent = () => (
    <div className="space-y-4">
      {renderBountyMeta()}

      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-surface-border bg-surface-primary space-y-3">
          <span className="font-mono text-[10px] text-brand-primary uppercase font-semibold block">
            How to Solve & Earn This Bounty
          </span>
          <div className="space-y-2.5 font-mono text-xs text-content-secondary">
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded bg-surface-tertiary flex items-center justify-center text-[10px] font-bold text-content-primary shrink-0">
                1
              </span>
              <span>Inspect requirements & acceptance criteria in the GitHub issue.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded bg-surface-tertiary flex items-center justify-center text-[10px] font-bold text-content-primary shrink-0">
                2
              </span>
              <span>Fork the repository, write code & ensure all unit tests pass.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded bg-surface-tertiary flex items-center justify-center text-[10px] font-bold text-content-primary shrink-0">
                3
              </span>
              <span>Submit PR referencing <code className="text-brand-primary font-bold">Fixes #{bounty.issueNumber}</code>.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded bg-surface-tertiary flex items-center justify-center text-[10px] font-bold text-content-primary shrink-0">
                4
              </span>
              <span>Bountra Agent triggers automated 5-layer audit in &lt;15 seconds.</span>
            </div>
          </div>

          <a
            href={bounty.issueUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-brand-primary text-black font-semibold text-xs py-2.5 hover:bg-brand-hover transition-colors"
          >
            <span>Open Issue on GitHub</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );

  // ─── Main Drawer ───
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex w-full sm:pl-10">
        <div className="w-full sm:w-screen sm:max-w-md bg-surface-secondary border-l border-surface-border p-4 sm:p-6 flex flex-col justify-between shadow-2xl max-h-[100dvh] sm:max-h-none sm:h-auto overflow-y-auto overscroll-contain">
          <div>
            <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-content-muted uppercase">
                    Bounty ID #{bounty.id}
                  </span>
                  {renderStatusBadge()}
                </div>
                <h2 className="text-base font-bold text-content-primary truncate max-w-[260px]">
                  {bounty.title}
                </h2>
              </div>
              <button
                onClick={resetAll}
                className="rounded-lg p-2 -mr-1 text-content-muted hover:bg-surface-tertiary hover:text-content-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
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
              </div>
            ) : bounty.status === "in_review" ? (
              renderInReviewContent()
            ) : bounty.status === "ready_to_claim" ? (
              renderReadyToClaimContent()
            ) : bounty.status === "claimed" ? (
              renderClaimedContent()
            ) : bounty.status === "rejected" ? (
              renderRejectedContent()
            ) : bounty.status === "cancelled" ? (
              renderCancelledContent()
            ) : (
              renderOpenContent()
            )}
          </div>

          {/* Action buttons — for developer claim mode. Sticky on mobile so the
              primary action stays reachable when the virtual keyboard shrinks
              the drawer to a fraction of the viewport. */}
          {!isClaimSuccess && mode === "claim" && (
            <div className="sticky bottom-0 bg-surface-secondary pt-4 border-t border-surface-border flex flex-col gap-2 -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
              <button
                onClick={handleClaim}
                disabled={!isWalletActive || isClaimPending || isClaimConfirming || bounty.claimed}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-primary text-black font-semibold text-xs py-2.5 hover:bg-brand-hover transition-all active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
              >
                {isClaimPending || isClaimConfirming ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Executing Escrow Claim on BSC Testnet...</span>
                  </>
                ) : (
                  <span>Claim {bounty.amountFormatted} {bounty.tokenSymbol} Now</span>
                )}
              </button>

              <button
                onClick={resetAll}
                className="w-full rounded-lg border border-surface-border bg-surface-tertiary text-content-secondary font-medium text-xs py-2 hover:bg-surface-primary hover:text-content-primary transition-all active:scale-[0.98] min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Close button for public modes */}
          {!isClaimSuccess && mode !== "claim" && (
            <div className="pt-4 border-t border-surface-border">
              <button
                onClick={resetAll}
                className="w-full rounded-lg border border-surface-border bg-surface-tertiary text-content-secondary font-medium text-xs py-2.5 hover:bg-surface-primary hover:text-content-primary transition-all active:scale-[0.98] min-h-[44px]"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
