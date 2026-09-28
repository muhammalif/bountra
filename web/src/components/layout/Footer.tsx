import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-surface-border py-6 sm:py-8 bg-surface-primary/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left font-mono">
          <div className="flex items-center gap-2">
            <div className="relative w-5 h-5 rounded overflow-hidden bg-black border border-surface-border shrink-0">
              <Image
                src="/bountra-logo.png"
                alt="Bountra"
                fill
                className="object-cover p-0.5"
              />
            </div>
            <span className="font-bold text-xs tracking-wider text-content-primary">BOUNTRA</span>
            <span className="text-[11px] text-content-muted">© 2026</span>
          </div>

          <p className="text-[11px] text-content-secondary max-w-md">
            Autonomous GitHub PR Auditor & Code-Gated Escrow on BNB Chain
          </p>
        </div>
      </div>
    </footer>
  );
}
