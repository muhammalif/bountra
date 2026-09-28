# Bountra — Design System

## 1. Brand Identity

- **Name:** Bountra (*Bounty* + *Era/Mantra*)
- **Persona:** "The Incorruptible Code Auditor" — Autonomous, objective, fast, transparent, cryptographic-native
- **Voice:** Technical, confident, trustworthy. Never hype, never vague.
- **Positioning:** "Commit your code, get paid by AI in seconds — zero human review delay."

---

## 2. Color Tokens

### Semantic Colors

| Token | Hex | Usage |
|---|---|---|
| `--brand-primary` | `#F0B90B` | BNB Yellow — CTA buttons, active states, accent highlights |
| `--brand-primary-hover` | `#D4A20A` | CTA hover states |
| `--success` | `#0ECB81` | Passed audit, funds released, CI green |
| `--error` | `#F6465D` | Failed audit, rejected PR, CI red |
| `--warning` | `#FCD535` | In-progress, pending review |
| `--info` | `#1E90FF` | Claimable state, informational badges |

### Neutral Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0D0E12` | Page background (deepest) |
| `--bg-secondary` | `#16181D` | Card surfaces, terminal body |
| `--bg-tertiary` | `#1E2026` | Elevated panels, drawer, modal |
| `--border` | `#2B313A` | Dividers, table borders, card outlines |
| `--text-primary` | `#F5F5F5` | Headings, primary content |
| `--text-secondary` | `#A0A5B1` | Descriptions, labels, metadata |
| `--text-muted` | `#6B7280` | Placeholder text, disabled states |

---

## 3. Typography

| Element | Font | Size | Weight | Usage |
|---|---|---|---|---|
| Hero heading | `Inter` | 48–64px | 700 (Bold) | Landing page main title |
| Section heading | `Inter` | 28–32px | 600 (Semibold) | Section titles |
| Body | `Inter` | 14–16px | 400 (Regular) | Paragraphs, descriptions |
| Code / Terminal | `JetBrains Mono` | 13–14px | 400 | Terminal logs, code snippets, hashes, addresses |
| Badge / Label | `Inter` | 12px | 500 (Medium) | Status chips, filter pills, tier badges |

---

## 4. Spacing System

- **Base unit:** 4px
- **Scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
- **Component padding:** `16px` (cards), `24px` (sections), `32px` (page margins)
- **Card border-radius:** `12px`
- **Button border-radius:** `8px`
- **Badge border-radius:** `9999px` (full pill)

---

## 5. Component Patterns

### A. Hero Section (Landing Page `/`)

| Component | Pattern | Source |
|---|---|---|
| `HackathonBadge` | Shimmer pill badge with subtle glow animation | Magic UI `AnimatedShinyText` |
| `HeroHeading` | 2-line bold + gradient text on key phrase | Tailwind `bg-gradient-to-r` + `bg-clip-text` |
| `HeroActions` | Primary (solid yellow) + Secondary (ghost/outline) buttons | shadcn/ui `Button` variants |
| `PipelineBeam` | 3-node animated beam (GitHub → Bountra Agent → BNB) | Magic UI `AnimatedBeam` |
| `TechTicker` | Horizontal logo strip with hover tooltip | Tailwind flex + grayscale filter |

### B. Live Audit Terminal

| Component | Pattern | Source |
|---|---|---|
| `StepProgress` | 5-step horizontal stepper with active pulse animation | Custom + Lucide icons |
| `TerminalConsole` | macOS-style window (3 dots header) + streaming log lines | Magic UI `Terminal` |
| Log lines | Monospaced, color-coded by type (⚙️ cyan, 🤖 green, 🔐 yellow, 💸 emerald) | `JetBrains Mono` + Tailwind text color |

### C. Dashboard

| Component | Pattern | Source |
|---|---|---|
| `StatsOverview` | 4-card metric grid (icon + value + label) | shadcn/ui `Card` |
| `BountyDataTable` | Full-width table with sortable columns, pagination | shadcn/ui `Table` + `@tanstack/react-table` |
| `StatusBadge` | Color-coded pill chips: Open/Reviewing/Claimable/Settled | shadcn/ui `Badge` variant mapping |
| `BountyDetailDrawer` | Right slide-over panel, 400px wide | shadcn/ui `Sheet` |
| `CreateBountyModal` | Centered dialog with form steps | shadcn/ui `Dialog` |

---

## 6. Motion & Animation Rules

- **Principle:** Minimal, functional, informational. Animations communicate state, not decoration.
- **Allowed:**
  - Beam flow animation on hero (continuous, subtle)
  - Terminal log typing effect (sequential line reveal with delay)
  - Step progress pulse on active state
  - Button hover scale (`scale-105`, 150ms ease)
  - Drawer/modal enter: slide + fade (200ms)
- **Not Allowed:**
  - Parallax scrolling
  - 3D transforms on cards
  - Bouncing/spinning loaders (use linear progress or skeleton)
  - Auto-playing video backgrounds
  - Confetti or particle effects

---

## 7. Accessibility (WCAG AA)

- All text passes 4.5:1 contrast ratio against backgrounds
- Interactive elements have visible focus rings (`ring-2 ring-brand-primary`)
- Terminal logs are selectable/copyable text (not canvas/image)
- All CTA buttons have descriptive `aria-label`
- Status badges use both color AND icon/text (not color-only differentiation)

---

## 8. Voice & Tone Guide

### On-Brand Examples ✅

- "50 USDT released to your wallet in 12 seconds."
- "CI check passed. 14/14 tests green."
- "Audit verdict: APPROVED (Score: 96/100)"
- "Escrow locked. Waiting for developer PR."

### AI-Slop to Avoid ❌

- "🎉 Congratulations! Your amazing code has been brilliantly approved!"
- "We're thrilled to announce that your funds are on their way!"
- "Our cutting-edge AI has leveraged advanced algorithms to verify..."
- "Unlock the power of blockchain-powered autonomous verification!"

### Rules

- Use data, not adjectives. "12 seconds" not "blazingly fast."
- Use action verbs. "Released" not "has been successfully processed."
- Terminal output is raw and technical. No emojis in log lines (except status prefixes defined above).
- Dashboard text is factual. No motivational language.

---

## 9. Mobile & Responsive Layout Specifications (antislop-layoutmobile)

Governed by `antislop-layoutmobile` (R-03, R-05, R-35).
**Core Rule:** Mobile layout is a distinct designed state, not desktop squeezed into a narrow viewport. Content must reflow: re-stack, rescale, and re-order with intent across the entire continuous width spectrum (320px to 1440px+).

### 9.1 Breakpoint & Multi-State Strategy
Layouts must define three deliberate states to prevent the "two-state layout" failure where tablets and small laptops inherit awkward stretched stacks or cramped grids:
- **Compact Mobile (`< 640px` / `sm:`):** Single-column stacked layout, dense spacing register, touch-first ergonomics (44x44px min target).
- **Tablet & Compact Desktop (`640px – 1023px` / `sm:` to `lg:`):** 2-column card layouts, balanced padding, intermediate type scale.
- **Full Desktop (`>= 1024px` / `lg:`):** Multi-column grids (3-column cards, side-by-side terminal/data, full tabular views).

### 9.2 Mobile Scale & Sizing Register
- **Container Padding:** `px-4` on mobile (`< 640px`), expanding to `sm:px-6` and `lg:px-8`.
- **Vertical Spacing:** Section padding reduced from desktop (`py-16` / `py-20`) to mobile register (`py-8` / `py-10`) to eliminate empty scroll voids.
- **Viewport Height Hygiene:** Never lock hero or section containers to `100vh` on mobile (which causes content overflow and browser chrome collisions). Use `min-h-[calc(100dvh-4rem)]` or natural content height.
- **Heading Scale:** Hero headings scale fluidly (`text-3xl` at mobile up to `sm:text-5xl` / `md:text-6xl` at desktop) with `leading-tight` to avoid headline wrapping collisions.

### 9.3 Component Reflow Specifications

#### A. Header & Mobile Navigation
- **Issue:** Logo, navigation links, and Web3 wallet button collide or wrap awkwardly on 320px–375px screens.
- **Reflow Rule:**
  - On mobile (`< 768px`), shorten brand lockup to icon + compact text.
  - Wallet button shrinks padding (`px-2.5 py-1.5`) and displays truncated address (`0x12...34`) or icon-only for secondary indicators.
  - Primary links ("Explore", "Dashboard") remain directly accessible or collapse into a dedicated accessible mobile menu panel.
  - Sticky nav height capped at `h-14` to prevent eating visible vertical screen real estate.

#### B. Pipeline Visualizer (`PipelineVisualizer.tsx`)
- **Issue:** 3-node horizontal beam layout and absolute badge ("Automated AI Escrow Pipeline") crowd and collide on narrow viewports.
- **Reflow Rule:**
  - Container padding steps down from `p-10` to `p-4 sm:p-6`.
  - Nodes scale down from `w-16 h-16` to `w-12 h-12` on mobile, font sizes step from `text-xs` to `text-[10px]`.
  - Absolute status badge relocates to a static stacked position below the nodes on `< 640px` to prevent overlapping node labels.

#### C. Audit Terminal Window (`AuditTerminal.tsx` & `PipelineTracker.tsx`)
- **Issue:** Window header has macOS traffic lights + 45-character session URL on left, and 3 tab buttons on right, forcing horizontal scroll or collision on mobile.
- **Reflow Rule:**
  - Header reflows to stacked 2-tier layout on mobile: Top tier holds traffic lights + truncated session ID (`bountra://session-43`); bottom tier holds the 3 view tabs with full touch targets (`py-1.5 px-3`).
  - `PipelineTracker` horizontal stage list uses smooth touch drag (`overflow-x-auto scrollbar-none`) with visual edge gradient affordance indicating scrollable content.
  - Monospace log text wraps cleanly with `break-all` and `min-w-0` on parent flex children to prevent horizontal layout leakage.

#### D. Explorer Catalog & Filters (`explore/page.tsx` & `BountyFilter.tsx`)
- **Issue:** Search input and sort select fight for width; filter tabs overflow without scroll clues.
- **Reflow Rule:**
  - Search bar and Sort dropdown stack vertically on mobile (`flex-col sm:flex-row`).
  - Filter status pills maintain horizontal swipe with `whitespace-nowrap` and active pill visual prominence.
  - Bounty cards utilize full width on mobile (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).

#### E. Dashboard Dual-Mode: Tables to Card List (`SponsorTab.tsx` & `DeveloperTab.tsx`)
- **Issue:** HTML `<table>` elements cause horizontal clipping and push critical action buttons ("Claim Reward", "Refund Escrow") off-screen on mobile.
- **Reflow Rule:**
  - **Mobile (`block sm:hidden`):** Reflow table rows into dedicated mobile cards. Each card displays:
    1. Header: Bounty ID + Status badge.
    2. Body: Issue title & repository link.
    3. Metrics: Amount (prominent yellow) + Deadline countdown.
    4. Action: Full-width touch-friendly button (`h-10` / 44px min hit area).
  - **Desktop (`hidden sm:table`):** Retain high-density tabular view with full columns.

#### F. Modals & Drawers (`CreateBountyModal.tsx` & `ClaimBountyDrawer.tsx`)
- **Issue:** Desktop modal exceeds mobile screen height when virtual keyboard appears; drawer reserves `pl-10` wasting 40px width on narrow screens.
- **Reflow Rule:**
  - `CreateBountyModal`: Enforce `max-h-[90dvh] overflow-y-auto w-full max-w-lg p-5 sm:p-6`. Inputs and labels maintain `text-sm` (16px equivalent font size during focus to prevent iOS Safari auto-zoom).
  - `ClaimBountyDrawer`: Removes desktop inset margin on mobile (`pl-0 sm:pl-10`), expanding to full screen width (`w-full sm:max-w-md`) with sticky bottom action buttons.

#### G. Footer (`Footer.tsx`)
- **Issue:** Single-row flex container forces long copyright tagline to collide or wrap awkwardly.
- **Reflow Rule:** Reflow to `flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left`.

### 9.4 Tap Target & Ergonomics Hygiene
- **Minimum Tap Size:** All interactive buttons, tabs, select dropdowns, and links must have a minimum bounding touch target of `44 x 44 px` (via visual size or padding hit-area).
- **Target Spacing:** Minimum `8px` gap between adjacent interactive controls to prevent mis-taps.
- **Touch State Feedback:** Every interactive control must provide active tactile feedback (`active:scale-[0.98]` or visible color shift), with zero reliance on hover-only visibility.

### 9.5 Layoutmobile Delivery Gate Checklist (Mandatory for PRs/Commits)
- [ ] Does the layout reflow into a distinct mobile state rather than a squeezed desktop? (R-03)
- [ ] Are there defined states across mobile, tablet, and desktop (3-state reflow)? (R-03, R-35)
- [ ] Do sizes (type, gaps, padding) follow the mobile scale register? (R-03, R-05)
- [ ] Do tables collapse into touch-friendly cards on mobile viewports? (R-03)
- [ ] Is there zero horizontal scroll leak across the entire document (`min-w-0`, text wrapping)? (R-03)
- [ ] Are all interactive touch targets at least 44 x 44 px with adequate spacing? (R-03)
- [ ] Do modals and drawers avoid clipping and work with mobile keyboards (`max-h-[90dvh]`)? (R-03)
- [ ] Are all hover states accompanied by tap/active feedback? (R-03)
- [ ] Has the layout been verified across 320px, 375px, 768px, and desktop widths? (R-35)

