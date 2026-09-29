### 9.5 Layoutmobile Delivery Gate Checklist (Mandatory for PRs/Commits)

Ticked only where the state was verified — by a browser measurement, a build, or a code-level
audit — not on the basis that the work "looks done". Unverified items stay unticked and are
listed in the known-gaps section of `docs/plans/master-plan.md` §8.1.

Provenance for this pass, so a later reader knows what each tick rests on:

- Overflow figures and every 44px figure: **measured in the DOM**, not read from source.
  Measured with `web/scripts/cdp-probe.py`, which drives Brave over raw CDP
  (`web/scripts/cdp_lib.py`). Playwright cannot install on macOS 13 and the browser-use
  profile backend requires Chromium, so the measurement path bypasses both and adds no
  project dependency. Each figure is `getBoundingClientRect()` on the rendered element.
- What that measurement caught: `Header.tsx:212` and `BountyFilter.tsx:82` each carried
  two conflicting `min-h-*` utilities, and the smaller one won. A source grep reported both
  files as compliant; the rendered button was 36px. Source inspection alone is not evidence.

- [x] Does the layout reflow into a distinct mobile state rather than a squeezed desktop? (R-03) — `<640px` gets the mobile component, not a narrowed table; hamburger replaces the desktop nav (`51b0266`).
- [x] Are there defined states across mobile, tablet, and desktop (3-state reflow)? (R-03, R-35) — `<640px` / `640–1023px` / `≥1024px`, used consistently in Header, Filter, and dashboard views.
- [x] Do sizes (type, gaps, padding) follow the mobile scale register? (R-03, R-05) — `text-xs` on mobile stepping to `text-sm` at `sm:`; spacing and icon sizes follow the same breakpoints.
- [x] Do tables collapse into touch-friendly cards on mobile viewports? (R-03) — `/dashboard` renders cards below 640px and the dense table at `hidden sm:table` above it.
- [x] Is there zero horizontal scroll leak across the entire document (`min-w-0`, text wrapping)? (R-03) — measured `scrollWidth - clientWidth === 0` on `/`, `/explore`, `/dashboard` at 320, 360, 390, 430, 768, and 1440px.
- [x] Are all interactive touch targets at least 44 x 44 px with adequate spacing? (R-03) — measured in the DOM, not audited in source. The first measurement found 14 unique controls under 44px (a raw count across 18 viewport/route pairs read as 190, which is not a unique-element count). Root causes included three scenario buttons at 30px, a replay icon at 36px, three terminal tabs at 36px, a card icon link at 32px, the wallet CTA at 36px, a filter chip at 36px, and two desktop-only icon buttons with no minimum size at all. All now measure ≥44px.
  Two sub-44px links were previously reported as exempt under WCAG 2.5.8. That was wrong: `View All Bounties` and `BSC Testnet (Chain 97)` are standalone navigation links, not links inside a sentence, and the inline exception does not cover them. Both are now 44px. The earlier exemption slipped through because the probe accepted any link inside a `p`/`li`/`label`, including a wrapper whose only content was the link itself; the probe now requires the enclosing block to contain other text. A final sweep reports `0` sub-44px controls on `/`, `/explore`, and `/dashboard`, and `0` inside the open `ClaimBountyDrawer`.
- [x] Do modals and drawers avoid clipping and work with mobile keyboards (`max-h-[90dvh]`)? (R-03) — `CreateBountyModal` is `max-h-[90dvh] overflow-y-auto overscroll-contain`; `ClaimBountyDrawer` is `max-h-[100dvh] sm:max-h-none` with its action block `sticky bottom-0` so the claim button stays reachable when the keyboard shrinks the viewport. Measured with `web/scripts/cdp-drawer.py`, which opens the drawer through a real click and measures the rendered panel: at 1440px the panel spans `L=992 R=1440` (448px wide), at 768px `L=320 R=768`, at 390px it fills `L=0 R=390`, with no horizontal overflow at any of them.
  The drawer used to sit in a `sm:pl-10` wrapper while the panel itself was `sm:w-screen`, so a full-viewport panel was pushed 40px from the right edge and overflowed the viewport by that same amount. That shifted the content sideways and read as a stacking glitch. The panel is now right-anchored at a fixed `sm:w-[28rem]`.
- [x] Are all hover states accompanied by tap/active feedback? (R-03) — four files had `hover:` with no `active:` (`app/page.tsx`, `app/dashboard/page.tsx`, `DashboardHeader.tsx`, `PipelineVisualizer.tsx`); active feedback added. The `PipelineVisualizer` circles are decorative and non-interactive, so they keep hover-scale only.
- [x] Has the layout been verified across 320px, 375px, 768px, and desktop widths? (R-35) — measured in the DOM at 320, 375, 390, 430, 768, and 1440px on `/`, `/explore`, and `/dashboard`. Horizontal overflow is `0` at every one of those 18 combinations.

### 9.6 What This Checklist Does Not Prove

- It says nothing about populated data. Every measurement above was taken against a dashboard
  behind the wallet gate with no connected wallet, so the empty state is verified and the
  populated state is not.
- It does not cover the claim/signing flow, which requires a real wallet and real on-chain
  escrows. A wallet that opens for signing proves nothing: the transaction still has to be
  confirmed on chain and its receipt, event, and resulting state checked.
- It does not cover states that need a connected wallet. The header's wallet dropdown, the
  dashboard's populated table and card views, and `CreateBountyModal` all render behind or
  after a wallet connection, so those states remain unmeasured even though the controls
  inside them were raised to 44px in source.
- `ClaimBountyDrawer` is now measured while open, via `web/scripts/cdp-drawer.py`. What that
  still does not cover is the claim form's own state: the proof inputs, the error message, the
  pending spinner, and the success panel all need a submitted transaction to appear.
- It cannot be satisfied by reading the CSS, and the 44px pass is the proof: two files passed
  a source audit while rendering sub-44px buttons. Every figure above now comes from a
  measurement.
