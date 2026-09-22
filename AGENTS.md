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
| `docs/plans/master-plan.md` | Original ideation & planning document |

## Stack

- **Smart Contract:** Solidity 0.8.28 (Foundry, OpenZeppelin v5) → `contracts/`
- **Agent Backend:** Node.js / TypeScript (Fastify, Octokit, Viem, Gemini 1.5/2.0 Flash) → `agent/`
- **Frontend:** Next.js 14 App Router (Tailwind CSS, shadcn/ui, Magic UI, RainbowKit/Wagmi v2) → `web/`
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
    ├── plans/             # Source planning docs (master-plan.md)
    ├── PRD.md
    ├── ARCHITECTURE.md
    ├── DESIGN.md
    ├── SCHEMA.md
    └── RULES.md
```

## Key Conventions

- Solidity: `0.8.28`, EVM target `cancun`, OpenZeppelin v5, Foundry for testing
- AI Engine: Gemini 1.5/2.0 Flash via Google AI Studio (free tier), enforced JSON Schema outputs
- All contract interactions via Viem (no ethers.js)
- Commit style: `feat:`, `fix:`, `docs:`, `test:`, `chore:` (conventional commits)
- English for code & docs, Bahasa Indonesia for user-facing copy

## Security Invariants

- AI Agent signs ECDSA approvals only; never holds user funds directly
- CI status fetched server-side from GitHub API (never trust client claims)
- Test suite immutability check before AI evaluation
- Structured Outputs (JSON Schema) enforced on all LLM responses
- Signature binds: `keccak256(bountyId, devWallet, commitHash, prUrl, nonce)`
