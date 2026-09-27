import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-surface-border py-8 bg-surface-primary/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center text-xs text-content-muted">
        <div className="flex items-center gap-2.5 font-mono text-center">
          <div className="relative w-5 h-5 rounded overflow-hidden bg-black border border-surface-border shrink-0">
            <Image
              src="/bountra-logo.png"
              alt="Bountra"
              fill
              className="object-cover p-0.5"
            />
          </div>
          <span className="font-semibold text-content-primary">BOUNTRA</span>
          <span>© 2026 — Autonomous GitHub PR Auditor & Code-Gated Escrow</span>
        </div>
      </div>
    </footer>
  );
}
