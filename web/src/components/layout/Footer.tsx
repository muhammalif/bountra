export function Footer() {
  return (
    <footer className="border-t border-surface-border py-8 bg-surface-primary/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-content-muted">
        <div className="flex items-center gap-2 font-mono">
          <span className="font-semibold text-content-primary">BOUNTRA</span>
          <span>© 2026 — Autonomous PR Auditor & Escrow</span>
        </div>
        <div className="flex items-center gap-4 text-content-muted font-mono">
          <span>Autonomous Code Review & Milestone Settlement</span>
        </div>
      </div>
    </footer>
  );
}
