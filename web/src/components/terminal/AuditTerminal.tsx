"use client";

import { useEffect, useRef, useState } from "react";
import {
  Terminal,
  Play,
  RotateCcw,
  ShieldAlert,
  FileCode,
  Key,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import { AUDIT_SCENARIOS, AuditScenario } from "./audit-scenarios";
import { PipelineTracker } from "./PipelineTracker";
import { cn } from "@/lib/utils";

export function AuditTerminal() {
  const [selectedScenario, setSelectedScenario] = useState<AuditScenario>(AUDIT_SCENARIOS[0]);
  const [activeTab, setActiveTab] = useState<"logs" | "json" | "crypto">("logs");
  const [visibleLogCount, setVisibleLogCount] = useState<number>(AUDIT_SCENARIOS[0].logs.length);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const startSimulation = (scenario: AuditScenario) => {
    setSelectedScenario(scenario);
    setVisibleLogCount(1);
    setIsRunning(true);
    setActiveTab("logs");
  };

  useEffect(() => {
    if (!isRunning) return;

    if (visibleLogCount < selectedScenario.logs.length) {
      const timer = setTimeout(() => {
        setVisibleLogCount((prev) => prev + 1);
      }, 450);
      return () => clearTimeout(timer);
    } else {
      setIsRunning(false);
    }
  }, [isRunning, visibleLogCount, selectedScenario]);

  useEffect(() => {
    if (activeTab === "logs" && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [visibleLogCount, activeTab]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case "INGEST":
        return "text-blue-400 border-blue-500/30 bg-blue-950/20";
      case "CI_GATE":
        return "text-amber-400 border-amber-500/30 bg-amber-950/20";
      case "TAMPER_GUARD":
        return "text-cyan-400 border-cyan-500/30 bg-cyan-950/20";
      case "GEMINI_EVAL":
        return "text-purple-400 border-purple-500/30 bg-purple-950/20";
      case "ECDSA_SIGN":
        return "text-brand-primary border-brand-primary/30 bg-brand-primary/10";
      case "ESCROW":
        return "text-status-success border-status-success/30 bg-emerald-950/20";
      case "ERROR":
        return "text-status-danger border-status-danger/30 bg-red-950/20";
      default:
        return "text-content-secondary border-surface-border bg-surface-primary";
    }
  };

  const isComplete = !isRunning && visibleLogCount >= selectedScenario.logs.length;

  return (
    <section id="audit-terminal" className="w-full max-w-5xl mx-auto px-4 py-12">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-primary mb-2">
            <Terminal className="h-5 w-5" />
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">Live Security Engine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-content-primary">
            Real-Time Audit Terminal
          </h2>
          <p className="mt-1 text-sm text-content-secondary max-w-xl">
            Simulate and inspect the 5-layer autonomous verification pipeline before ECDSA payouts are signed on BNB Chain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {AUDIT_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => startSimulation(sc)}
              disabled={isRunning}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-all",
                selectedScenario.id === sc.id
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                  : "border-surface-border bg-surface-secondary/80 text-content-secondary hover:border-surface-border-hover hover:text-content-primary",
                isRunning && "opacity-60 cursor-not-allowed"
              )}
            >
              <Play className="h-3 w-3" />
              <span>{sc.name.split(":")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-secondary shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border bg-surface-tertiary px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="ml-2 font-mono text-xs font-semibold text-content-muted">
              bountra-agent://evaluator/session-{selectedScenario.prNumber}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("logs")}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                activeTab === "logs"
                  ? "bg-surface-primary text-brand-primary"
                  : "text-content-secondary hover:text-content-primary"
              )}
            >
              Live Stream
            </button>
            <button
              onClick={() => setActiveTab("json")}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                activeTab === "json"
                  ? "bg-surface-primary text-brand-primary"
                  : "text-content-secondary hover:text-content-primary"
              )}
            >
              JSON Verdict
            </button>
            <button
              onClick={() => setActiveTab("crypto")}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                activeTab === "crypto"
                  ? "bg-surface-primary text-brand-primary"
                  : "text-content-secondary hover:text-content-primary"
              )}
            >
              ECDSA Proof
            </button>
            <button
              onClick={() => startSimulation(selectedScenario)}
              disabled={isRunning}
              title="Replay Simulation"
              className="ml-2 rounded p-1 text-content-muted hover:bg-surface-primary hover:text-content-primary transition-colors disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <PipelineTracker
          currentStage={selectedScenario.activeStage}
          isComplete={isComplete}
          isPassed={selectedScenario.passed}
        />

        <div className="p-4 sm:p-6 font-mono text-xs">
          {activeTab === "logs" && (
            <div className="space-y-2.5 min-h-[280px] max-h-[420px] overflow-y-auto pr-2">
              {selectedScenario.logs.slice(0, visibleLogCount).map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 font-mono leading-relaxed">
                  <span className="text-content-muted shrink-0 text-[11px]">{log.timestamp}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0", getTagColor(log.tag))}>
                    [{log.tag}]
                  </span>
                  <span className={cn("text-content-primary", log.tag === "ERROR" && "text-status-danger font-semibold")}>
                    {log.message}
                  </span>
                </div>
              ))}
              {isRunning && (
                <div className="flex items-center gap-2 text-brand-primary pt-2 animate-pulse">
                  <span className="inline-block h-2 w-2 rounded-full bg-brand-primary" />
                  <span>Processing security pipeline...</span>
                </div>
              )}
              <div ref={terminalBottomRef} />
            </div>
          )}

          {activeTab === "json" && (
            <div className="min-h-[280px] max-h-[420px] overflow-y-auto bg-surface-primary/80 rounded-xl p-4 border border-surface-border">
              <pre className="text-emerald-400 font-mono text-xs whitespace-pre-wrap">
                {JSON.stringify(selectedScenario.verdictJson, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === "crypto" && (
            <div className="min-h-[280px] max-h-[420px] overflow-y-auto space-y-4">
              {selectedScenario.signatureData ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-surface-border bg-surface-primary/80 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-content-secondary uppercase">Agent Signer Address</span>
                      <button
                        onClick={() => copyToClipboard(selectedScenario.signatureData!.signer, "signer")}
                        className="text-content-muted hover:text-brand-primary"
                      >
                        {copiedField === "signer" ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <span className="font-mono text-xs text-brand-primary break-all">
                      {selectedScenario.signatureData.signer}
                    </span>
                  </div>

                  <div className="rounded-xl border border-surface-border bg-surface-primary/80 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-content-secondary uppercase">keccak256 Claim Digest</span>
                      <button
                        onClick={() => copyToClipboard(selectedScenario.signatureData!.digest, "digest")}
                        className="text-content-muted hover:text-brand-primary"
                      >
                        {copiedField === "digest" ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <span className="font-mono text-xs text-blue-400 break-all">
                      {selectedScenario.signatureData.digest}
                    </span>
                  </div>

                  <div className="rounded-xl border border-surface-border bg-surface-primary/80 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-content-secondary uppercase">ECDSA Cryptographic Signature</span>
                      <button
                        onClick={() => copyToClipboard(selectedScenario.signatureData!.signature, "sig")}
                        className="text-content-muted hover:text-brand-primary"
                      >
                        {copiedField === "sig" ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <span className="font-mono text-xs text-status-success break-all">
                      {selectedScenario.signatureData.signature}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[240px] text-center p-6 border border-dashed border-surface-border rounded-xl">
                  <ShieldAlert className="h-10 w-10 text-status-danger mb-2" />
                  <span className="font-mono text-sm font-semibold text-content-primary">
                    Signature Generation Blocked
                  </span>
                  <p className="mt-1 text-xs text-content-secondary max-w-md">
                    This PR failed the 5-layer security check. Under Bountra invariants, no cryptographic signature is issued for malicious or modified code.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border bg-surface-primary/60 px-4 py-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-content-muted">Target PR:</span>
            <span className="text-content-primary font-semibold">
              {selectedScenario.repo}#{selectedScenario.prNumber}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-content-muted">Audit Score:</span>
              <span
                className={cn(
                  "font-bold",
                  selectedScenario.score >= 80 ? "text-status-success" : "text-status-danger"
                )}
              >
                {selectedScenario.score}/100
              </span>
            </div>
            <div
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                selectedScenario.badgeVariant === "success" && "bg-status-success/20 text-status-success",
                selectedScenario.badgeVariant === "danger" && "bg-status-danger/20 text-status-danger",
                selectedScenario.badgeVariant === "warning" && "bg-amber-500/20 text-amber-400"
              )}
            >
              {selectedScenario.badgeText}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
