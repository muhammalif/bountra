# Bountra

Autonomous GitHub PR Auditor & Code-Gated Milestone Escrow on BNB Chain.

> Commit your code, get paid by AI in seconds — zero human review delay.

## Documentation (Source of Truth)

| Doc | Purpose |
|---|---|
| `docs/PRD.md` | Scope, MVP milestones, success metrics |
| `docs/ARCHITECTURE.md` | System diagrams, data flow, component specs |
| `docs/DESIGN.md` | Brand identity, color tokens, UI patterns, anti-AI-slop rules |
| `docs/SCHEMA.md` | On-chain storage layout, off-chain DB schema, ERD |
| `docs/RULES.md` | Runtime rules, security boundaries, LLM guardrails, conventions |
| `docs/plans/master-plan.md` | **Live project status** — sprint progress, verified on-chain state, test baseline, ranked blockers |

> **Note on `docs/`:** the whole tree is gitignored (`.gitignore:17:/docs/`), so these docs
> are disk-only and won't show in `git status`. A few files (`ARCHITECTURE.md`,
> `CLAIM-FLOW.md`, `DEMO_SCRIPT.md`, `PITCH.md`, `WEBHOOK-SETUP.md`) were already tracked
> before the ignore rule landed and remain tracked — gitignore only affects new files.
>
> `docs/plans/master-plan.md` is a **symlink** to the Bountra master plan in the Obsidian
> vault. It is the single source of truth for project status, not an archived planning doc,
> and editing it from either path writes the same file.

## Stack

- **Smart Contract:** Solidity 0.8.28 (Foundry, OpenZeppelin v5) → `contracts/`
- **Agent Backend:** Node.js / TypeScript (Fastify, Octokit, Viem, Gemini `gemini-3.1-flash-lite` with `gemini-3.6-flash` fallback) → `agent/`
- **Frontend:** Next.js 14 App Router (Tailwind CSS, shadcn/ui, Magic UI, Privy Auth & Embedded Wallet + Viem/Wagmi) → `web/`
- **Network:** BNB Smart Chain Testnet / opBNB Testnet
- **Database:** SQLite (Drizzle ORM) — off-chain audit logs, webhook-bounty mapping

## Directory Layout

```
bountra/
├── AGENTS.md              # This file — agent briefing & doc pointers
├── contracts/             # Foundry project (BountraEscrow.sol)
├── agent/                 # GitHub Webhook listener + AI evaluation engine
├── web/                   # Next.js dashboard & landing page
├── scripts/               # Deploy scripts, seed data, utilities
└── docs/
    ├── plans/             # master-plan.md — symlink to Obsidian vault, live project status
    ├── PRD.md
    ├── ARCHITECTURE.md
    ├── DESIGN.md
    ├── SCHEMA.md
    └── RULES.md
```

## Key Conventions

- Solidity: `0.8.28`, EVM target `cancun`, OpenZeppelin v5, Foundry for testing
- AI Engine: Gemini `gemini-3.1-flash-lite` by default with `gemini-3.6-flash` fallback via Google AI Studio (free tier), enforced provider JSON Schema outputs. The previously documented `gemini-2.0-flash` default returns HTTP 404 from the provider.
- All contract interactions via Viem (no ethers.js)
- Commit style: `feat:`, `fix:`, `docs:`, `test:`, `chore:` (conventional commits)
- English for code & docs, Bahasa Indonesia for user-facing copy

## Security Invariants

- AI Agent signs ECDSA approvals only; never holds user funds directly
- CI status fetched server-side from GitHub API (never trust client claims)
- Test suite immutability check before AI evaluation
- Structured Outputs (JSON Schema) enforced on all LLM responses
- Signature binds: `keccak256(bountyId, devWallet, commitHash, prUrl, contractAddress, chainId)`, replay-guarded by `usedSignatures[messageHash]` (no nonce field)
