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
| `PipelineBeam` | 3-node animated beam (GitHub → Gemini → BNB) | Magic UI `AnimatedBeam` |
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
