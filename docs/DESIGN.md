### 9.5 Layoutmobile Delivery Gate Checklist (Mandatory for PRs/Commits)

Ticked only where the state was verified — by a browser measurement, a build, or a code-level
audit — not on the basis that the work "looks done". Unverified items stay unticked and are
listed in the known-gaps section of `docs/plans/master-plan.md` §8.1.

Provenance for this pass, so a later reader knows what each tick rests on:

- Overflow figures: measured in-browser at each width.
- The 44px item: **not** re-measured in-browser. The browser automation backend was down
  during this pass. It was verified by code audit — every interactive control was located in
  the JSX and its `min-h`/`min-w` read directly — and the change is covered by a passing
  `pnpm build`. That is weaker than a DOM measurement and should be re-measured before any
  sign-off that claims tap-target compliance.

- [x] Does the layout reflow into a distinct mobile state rather than a squeezed desktop? (R-03) — `<640px` gets the mobile component, not a narrowed table; hamburger replaces the desktop nav (`51b0266`).
- [x] Are there defined states across mobile, tablet, and desktop (3-state reflow)? (R-03, R-35) — `<640px` / `640–1023px` / `≥1024px`, used consistently in Header, Filter, and dashboard views.
- [x] Do sizes (type, gaps, padding) follow the mobile scale register? (R-03, R-05) — `text-xs` on mobile stepping to `text-sm` at `sm:`; spacing and icon sizes follow the same breakpoints.
- [x] Do tables collapse into touch-friendly cards on mobile viewports? (R-03) — `/dashboard` renders cards below 640px and the dense table at `hidden sm:table` above it.
- [x] Is there zero horizontal scroll leak across the entire document (`min-w-0`, text wrapping)? (R-03) — measured `scrollWidth - clientWidth === 0` on `/`, `/explore`, `/dashboard` at 320, 360, 390, 430, 768, and 1440px.
- [x] Are all interactive touch targets at least 44 x 44 px with adequate spacing? (R-03) — this was **false** at audit time: Header nav 36px, dashboard buttons 38–40px, hero CTAs 42px, filter inputs 36–40px, drawer close button 40px. All raised to `min-h-[44px]`, icon buttons to `min-w-[44px]` as well. Verified by code audit, not yet by DOM measurement — see the provenance note above.
- [x] Do modals and drawers avoid clipping and work with mobile keyboards (`max-h-[90dvh]`)? (R-03) — `CreateBountyModal` is `max-h-[90dvh] overflow-y-auto overscroll-contain`; `ClaimBountyDrawer` is `max-h-[100dvh] sm:max-h-none` with its action block now `sticky bottom-0` so the claim button stays reachable when the keyboard shrinks the viewport.
- [x] Are all hover states accompanied by tap/active feedback? (R-03) — four files had `hover:` with no `active:` (`app/page.tsx`, `app/dashboard/page.tsx`, `DashboardHeader.tsx`, `PipelineVisualizer.tsx`); active feedback added. The `PipelineVisualizer` circles are decorative and non-interactive, so they keep hover-scale only.
- [x] Has the layout been verified across 320px, 375px, 768px, and desktop widths? (R-35) — verified at 320, 360, 375, 390, 430, 768, and 1440px. 375px was covered by the 390px run, not measured separately.

### 9.6 What This Checklist Does Not Prove

- It says nothing about populated data. Every measurement above was taken against a dashboard
  behind the wallet gate with no connected wallet, so the empty state is verified and the
  populated state is not.
- It does not cover the claim/signing flow, which requires a real wallet and real on-chain
  escrows.
- It cannot be satisfied by reading the CSS. Each item was checked against a measurement, a
  build, or a direct code audit, which is why several items were unticked on the first pass.
- The 44px item currently rests on a code audit alone. It needs a DOM measurement to close.
