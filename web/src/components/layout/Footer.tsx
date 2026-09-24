import { formatAddress, formatBscScanUrl } from "@/lib/utils";
import { BOUNTRA_ESCROW_ADDRESS } from "@/config/contracts";

export function Footer() {
  return (
    <footer className="border-t border-surface-border py-8 bg-surface-primary/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-content-muted">
        <div className="flex items-center gap-2 font-mono">
          <span className="font-semibold text-content-primary">BOUNTRA</span>
          <span>© 2026 — Autonomous PR Auditor & Escrow</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={formatBscScanUrl("address", BOUNTRA_ESCROW_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="text-brand-primary hover:underline font-mono"
          >
            Contract: {formatAddress(BOUNTRA_ESCROW_ADDRESS)}
          </a>
          <span>•</span>
          <span className="text-content-secondary font-mono">BNB Smart Chain Testnet (97)</span>
        </div>
      </div>
    </footer>
  );
}
