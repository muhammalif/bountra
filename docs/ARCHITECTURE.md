# Bountra — System Architecture

## 1. Top-Level Overview

```
┌──────────────────┐       1. Create & Fund Bounty (USDT)       ┌────────────────────────┐
│  Project Owner   │ ─────────────────────────────────────────> │  BountraEscrow.sol     │
│  (Dashboard UI)  │                                            │  (BNB Chain / opBNB)   │
└──────────────────┘                                            └───────────┬────────────┘
                                                                            │
┌──────────────────┐       2. Submit Pull Request                           │
│    Developer     │ ─────────────────────────────────┐                     │ 6. Auto-Release
│  (GitHub)        │                                  ▼                     │    Bounty Funds
└──────────────────┘                         ┌─────────────────┐            │
                                             │ GitHub Webhook  │            │
                                             └────────┬────────┘            │
                                                      │                    │
                                                      ▼                    │
                                        ┌─────────────────────────┐        │
                                        │   Bountra Agent Server  │        │
                                        │   (Fastify / Node.js)   │        │
                                        ├─────────────────────────┤        │
                                        │ 3. Hard Gate            │        │
                                        │    └─ GitHub CI Status  │        │
                                        │ 4. Integrity Check      │        │
                                        │    └─ Test Tamper Scan  │        │
                                        │ 5a. Soft Gate           │        │
                                        │    └─ Gemini Flash │        │
                                        │ 5b. ECDSA Signer       │        │
                                        │    └─ Viem Wallet       │───────>│
                                        ├─────────────────────────┤        │
                                        │ SQLite (Drizzle ORM)    │        │
                                        │ └─ Audit logs, mapping  │        │
                                        └─────────────────────────┘        │
                                                      │                    │
                                                      ▼                    ▼
                                             ┌─────────────────┐   ┌─────────────┐
                                             │  GitHub PR      │   │  Developer   │
                                             │  Comment Bot    │   │  Wallet      │
                                             └─────────────────┘   └─────────────┘
```

---

## 2. Component Architecture

### A. Smart Contract Layer (`contracts/`)

```
contracts/
├── src/
│   └── BountraEscrow.sol       # Core escrow logic
├── test/
│   └── BountraEscrow.t.sol     # Foundry test suite
├── script/
│   └── Deploy.s.sol            # Deployment script
└── foundry.toml                # solc=0.8.28, evm=cancun
```

**Dependencies:** OpenZeppelin Contracts v5 (`ECDSA`, `MessageHashUtils`, `ReentrancyGuard`, `IERC20`)

**Core Functions:**

| Function | Access | Description |
|---|---|---|
| `createBounty(issueUrl, token, amount, deadline)` | Public (Owner) | Lock ERC-20 tokens in escrow, tied to GitHub Issue URL |
| `claimBounty(bountyId, devWallet, prUrl, commitHash, signature)` | Public (Developer) | Verify Agent ECDSA signature via `ecrecover`, transfer funds |
| `cancelBounty(bountyId)` | Bounty Creator | Refund locked funds after deadline expires |

**On-Chain Storage:** See `docs/SCHEMA.md` for struct and mapping layout.

### B. Agent Backend (`agent/`)

```
agent/
├── src/
│   ├── server.ts               # Fastify HTTP server (webhook endpoint)
│   ├── webhook/
│   │   ├── handler.ts          # Parse & validate GitHub webhook payload
│   │   └── verifier.ts         # HMAC-SHA256 signature verification
│   ├── gates/
│   │   ├── hardGate.ts         # Fetch CI check_runs from GitHub API
│   │   └── integrityCheck.ts   # Detect test assertion tampering in diff
│   ├── ai/
│   │   ├── evaluator.ts        # Gemini Flash prompt engine
│   │   └── schema.ts           # JSON Schema for structured output
│   ├── signer/
│   │   └── ecdsa.ts            # Viem wallet ECDSA message signing
│   ├── github/
│   │   └── commenter.ts        # Post audit verdict as PR comment
│   └── db/
│       ├── schema.ts           # Drizzle ORM table definitions
│       └── client.ts           # SQLite connection
├── .env.example
├── package.json
└── tsconfig.json
```

### C. Frontend (`web/`)

```
web/
├── app/
│   ├── layout.tsx              # Root layout + Web3Provider (Privy + Wagmi)
│   ├── page.tsx                # Landing page (Hero + Terminal + Explorer)
│   └── dashboard/
│       └── page.tsx            # Dashboard (Table + Drawer + Modal)
├── components/
│   ├── hero/
│   │   ├── HackathonBadge.tsx
│   │   ├── HeroHeading.tsx
│   │   ├── HeroActions.tsx
│   │   ├── PipelineBeam.tsx
│   │   └── TechTicker.tsx
│   ├── terminal/
│   │   ├── StepProgress.tsx
│   │   └── TerminalConsole.tsx
│   ├── explorer/
│   │   ├── FilterBar.tsx
│   │   ├── BountyGrid.tsx
│   │   └── BountyCard.tsx
│   ├── dashboard/
│   │   ├── StatsOverview.tsx
│   │   ├── BountyDataTable.tsx
│   │   ├── BountyDetailDrawer.tsx
│   │   └── CreateBountyModal.tsx
│   └── ui/                     # shadcn/ui primitives
├── lib/
│   ├── contracts.ts            # ABI + contract addresses
│   ├── wagmi.ts                # Wagmi config (BNB Testnet chain)
│   └── queries.ts              # Data fetching (on-chain reads + API)
└── package.json
```

---

## 3. Data Flow: Bounty Lifecycle

```
1. CREATE BOUNTY
   Owner → Dashboard → wagmi.writeContract("createBounty") → BNB Chain
                                                              ↓
                                                    Event: BountyCreated
                                                              ↓
                                                    Agent DB: save mapping
                                                    (bountyId → issueUrl)

2. AUDIT PR
   Developer → GitHub PR → Webhook fires
                              ↓
                    Agent: verifyWebhookSignature()
                              ↓
                    Agent: hardGate() → GitHub API check_runs
                              ↓ (PASS)
                    Agent: integrityCheck() → scan test diff
                              ↓ (CLEAN)
                    Agent: evaluator() → Gemini Flash
                              ↓ (PASSED, score ≥ 70)
                    Agent: ecdsa.sign(bountyId, devWallet, commitHash, prUrl, nonce)
                              ↓
                    Agent: commenter.postVerdict(prUrl, verdict)
                              ↓
                    Agent DB: save audit log

3. CLAIM PAYOUT
   Developer → Dashboard → wagmi.writeContract("claimBounty", signature)
                              ↓
                    BountraEscrow.sol: ecrecover(signature) == agentSigner
                              ↓ (VALID)
                    ERC-20 transfer → Developer wallet
                              ↓
                    Event: BountyClaimed
```

---

## 4. Security Architecture

### Defense-in-Depth Pipeline

```
[PR Webhook Received]
        │
        ├──> 1. HMAC-SHA256 Webhook Signature ──[ Invalid ]──> ❌ Reject (Not from GitHub)
        │         │ (Valid)
        ├──> 2. CI Hard Gate (GitHub API) ──[ CI Failed ]──> ❌ Reject (No LLM cost)
        │         │ (Passed)
        ├──> 3. Test Integrity Check ──[ Tampering Detected ]──> ❌ Reject
        │         │ (Clean)
        ├──> 4. AI Audit (Sandboxed Input) ──[ Score < 70 ]──> ❌ Reject + Feedback
        │         │ (Passed)
        ├──> 5. Structured JSON Output Validation ──[ Schema Mismatch ]──> ❌ Reject
        │         │ (Valid)
        └──> 6. ECDSA Sign & Post Verdict ──> ✅ Developer can claim on-chain
```

### Invariants

- Agent private key is server-side only; never exposed to frontend or user
- All LLM inputs wrapped in `<untrusted_diff>` XML delimiters
- Signature includes `nonce` to prevent replay attacks
- Contract enforces `bounty.claimed == false` before transfer

---

## 5. Technology Matrix

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Smart Contract | Solidity | 0.8.28 | Escrow logic with ECDSA verification |
| Contract Framework | Foundry | Latest | Testing, deployment, verification |
| Contract Libraries | OpenZeppelin | v5.x | ECDSA, ReentrancyGuard, IERC20 |
| Agent Runtime | Node.js | 20 LTS | Webhook server, orchestration |
| Agent Framework | Fastify | v5.x | HTTP server for webhook endpoint |
| GitHub SDK | Octokit | Latest | REST API + Webhook verification |
| AI Engine | Gemini Flash | Latest | Code audit with structured outputs |
| Web3 SDK | Viem | v2.x | Contract interaction, ECDSA signing |
| Wallet & Auth SDK | Privy (@privy-io/react-auth) + Wagmi | Latest | Embedded wallet, GitHub auth & external wallets |
| Frontend | Next.js | 14.x | App Router, SSR landing + dashboard |
| Styling | Tailwind CSS | v3.x | Utility-first CSS |
| UI Components | shadcn/ui + Magic UI | Latest | DataTable, Dialog, Terminal, Beam |
| Database | SQLite + Drizzle ORM | Latest | Off-chain audit logs & mapping |
| Network | BNB Smart Chain Testnet | — | Primary deployment target |
