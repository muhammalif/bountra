"use client";

import { forwardRef, useRef } from "react";
import { GitPullRequest, Bot, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { AnimatedBeam } from "../magicui/animated-beam";
import { cn } from "@/lib/utils";

interface CircleProps {
  className?: string;
  children?: React.ReactNode;
}

const Circle = forwardRef<HTMLDivElement, CircleProps>(
  ({ className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-surface-border bg-surface-secondary shadow-lg transition-transform hover:scale-105",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

Circle.displayName = "Circle";

export function PipelineVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const devRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const escrowRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative flex w-full max-w-3xl items-center justify-between overflow-hidden rounded-2xl border border-surface-border bg-surface-secondary/40 p-6 sm:p-10 backdrop-blur-sm shadow-2xl"
    >
      <div className="flex flex-col items-center gap-2.5 z-10">
        <Circle ref={devRef} className="border-blue-500/40 bg-blue-950/30 text-blue-400 shadow-blue-500/10">
          <GitPullRequest className="h-6 w-6" />
        </Circle>
        <div className="text-center">
          <span className="block font-mono text-xs font-semibold text-content-primary">GitHub PR</span>
          <span className="block font-mono text-[10px] text-content-secondary">git diff + CI status</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2.5 z-10">
        <div className="relative">
          <div className="absolute -inset-1 rounded-2xl bg-brand-primary/20 blur-sm animate-pulse" />
          <Circle ref={agentRef} className="relative h-16 w-16 border-brand-primary/60 bg-surface-primary text-brand-primary shadow-brand-primary/20">
            <Bot className="h-8 w-8" />
          </Circle>
        </div>
        <div className="text-center">
          <span className="block font-mono text-xs font-semibold text-brand-primary">Bountra Agent</span>
          <span className="block font-mono text-[10px] text-content-secondary">5-Layer Gates + ECDSA</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2.5 z-10">
        <Circle ref={escrowRef} className="border-status-success/40 bg-emerald-950/30 text-status-success shadow-emerald-500/10">
          <ShieldCheck className="h-6 w-6" />
        </Circle>
        <div className="text-center">
          <span className="block font-mono text-xs font-semibold text-content-primary">BNB Escrow</span>
          <span className="block font-mono text-[10px] text-status-success">Auto Payout Released</span>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={devRef}
        toRef={agentRef}
        curvature={-25}
        duration={3}
        pathWidth={3}
        gradientStartColor="#3B82F6"
        gradientStopColor="#F0B90B"
      />

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={agentRef}
        toRef={escrowRef}
        curvature={25}
        duration={3}
        delay={1.5}
        pathWidth={3}
        gradientStartColor="#F0B90B"
        gradientStopColor="#0ECB81"
      />

      <div className="absolute bottom-2.5 right-4 flex items-center gap-1.5 font-mono text-[10px] text-content-muted">
        <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
        Verified on-chain via ecrecover
      </div>
    </div>
  );
}
