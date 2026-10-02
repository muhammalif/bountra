# Bountra — System Architecture

## 1. Top-Level Overview

```
┌──────────────────┐       1. Create & Fund Bounty (USDT)       ┌────────────────────────┐
│  Project Owner   │ ─────────────────────────────────────────> │  BountraEscrow.sol     │
│  (Dashboard UI)  │                                            │  (BNB Chain / opBNB)   │
└──────────────────┘                                            └───────────┬────────────┘
                                                                            │
┌──────────────────┐       2. Submit Pull Request                           │
│    Developer     │ ─────────────────────────────────┐                     │ 6. Developer-triggered
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
| `createBounty(issueUrl, token, amount, deadline)` | Public | Lock ERC-20 tokens in escrow, tied to GitHub Issue URL |
| `claimBounty(bountyId, devWallet, prUrl, commitHash, signature)` | Public | Verify Agent ECDSA signature via `ecrecover`, transfer funds |
| `cancelBounty(bountyId)` | Bounty Creator | Refund locked funds after deadline expires |

**On-Chain Storage:** See `docs/SCHEMA.md` for struct and mapping layout.

### B. Agent Backend (`agent/`)

```
agent/
├── src/
│   ├── index.ts                # Fastify bootstrap, CORS allowlist, raw-body JSON parser
│   ├── routes/
│   │   ├── api.ts              # REST: bounties, audit, claim authorize/confirm
│   │   └── webhook.ts          # POST /webhook/github — audit pipeline entry point
│   ├── security/
│   │   └── webhookSignature.ts # HMAC-SHA256 (x-hub-signature-256) verification
│   ├── evaluator/
│   │   ├── gemini.ts           # Gemini Flash prompt engine + JSON Schema output
│   │   └── security.ts         # Test/CI tampering detection (Integrity Gate)
│   ├── signer/
│   │   └── index.ts            # Viem ECDSA claim-authorization signing
│   ├── github/
│   │   └── client.ts           # PR/issue/check-runs fetch via Octokit
│   ├── chain/
│   │   └── verifyClaim.ts      # Read claim tx back from BSC testnet RPC
│   └── db/
│       ├── schema.ts           # Drizzle ORM table definitions
│       └── index.ts            # SQLite connection + query helpers
├── test/                       # node:test suites (offline, no live network)
├── .env.example
├── package.json
└── tsconfig.json
```

### C. Frontend (`web/`)

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing page, pipeline visualizer, terminal
│   │   ├── explore/page.tsx        # Bounty explorer and create-bounty modal
│   │   ├── dashboard/page.tsx      # Sponsor and Developer Hub
│   │   └── api/agent/[...path]/route.ts # Allowlisted server-side agent proxy
│   ├── components/
│   │   ├── hero/HeroSection.tsx, PipelineVisualizer.tsx
│   │   ├── terminal/AuditTerminal.tsx, PipelineTracker.tsx, audit-scenarios.ts
│   │   ├── explorer/BountyCard.tsx, BountyFilter.tsx
│   │   ├── dashboard/DashboardHeader.tsx, DeveloperTab.tsx, SponsorTab.tsx
│   │   ├── modals/ClaimBountyDrawer.tsx, CreateBountyModal.tsx, TxHashChip.tsx
│   │   └── layout/Header.tsx, Footer.tsx
│   ├── config/contracts.ts        # ABI, escrow address, and chain configuration
│   ├── hooks/useClaimAuthorization.ts, useOnChainBounties.ts
│   ├── lib/mock-bounties.ts, utils.ts
│   ├── providers/Web3Provider.tsx
│   └── types/bounty.ts
└── package.json
```

---

## 3. Data Flow: Bounty Lifecycle

```
1. CREATE BOUNTY
   Owner → Dashboard → wagmi.writeContract("createBounty") → BNB Chain
                                                              ↓
                                                    Event: BountyCreated
                                                    (not consumed by agent)
                                                              ↓
                     Manual registration → POST /api/bounties → Agent DB
                     (bountyId → exact issueUrl mapping; no chain listener)

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
                    Agent: ecdsa.sign(bountyId, devWallet, commitHash, prUrl, contract, chainId)
                              ↓
                    Agent: commenter.postVerdict(prUrl, verdict)
                              ↓
                    Agent DB: save audit log

3. CLAIM PAYOUT
   Developer → Dashboard / Developer Hub → ClaimBountyDrawer
                              ↓
                    POST /api/claim/authorize (stored passing audit)
                              ↓
                    wagmi.writeContract("claimBounty", signature)
                              ↓
                    BountraEscrow.sol: ecrecover(signature) == agentSigner
                              ↓ (VALID)
                    ERC-20 transfer → Developer wallet
                              ↓
                    Event: BountyClaimed
```

There is no `BountyCreated` event listener in `agent/src/index.ts`. The sponsor
or operator must register the new bounty with `POST /api/bounties` after the
on-chain transaction, using the exact GitHub issue URL. Until that mapping is
present, a matching PR reaches the webhook but returns `skipped` and cannot be
audited.

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
- Untrusted PR metadata and diffs are sanitized and wrapped in XML-like delimiters
- Signature digest is single-use via `usedSignatures[messageHash]`, which is what
  prevents replay attacks; there is no separate nonce value in the payload
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
