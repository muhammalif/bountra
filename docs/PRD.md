# Bountra — Product Requirements Document

## 1. Product Summary

**Bountra** is an autonomous GitHub PR auditor and code-gated milestone escrow protocol on BNB Smart Chain. It eliminates manual review bottlenecks for open-source bounties and freelance milestones by combining deterministic CI verification with AI-powered semantic code analysis, triggering instant on-chain payouts via cryptographic signatures.

---

## 2. Scope

### In Scope (MVP / Hackathon)

- Smart contract escrow (`BountraEscrow.sol`) with deposit, claim (ECDSA-gated), and refund
- GitHub Webhook listener that captures `pull_request` events
- Dual-gate verification pipeline (Hard Gate: CI status, Soft Gate: Gemini AI audit)
- ECDSA signature generation by Agent for on-chain claim authorization
- Transparent PR commenting with structured audit verdicts
- Landing page with animated pipeline hero, live audit terminal demo, and bounty explorer
- Dashboard with bounty data table, detail drawer, and create bounty modal
- SQLite database for off-chain audit logs, webhook-bounty mapping, and session cache

### Out of Scope (Post-Hackathon)

- Multi-chain deployment beyond BNB/opBNB
- Production token economics / protocol fees
- Mainnet deployment with real funds
- Mobile-responsive optimization
- OAuth-based GitHub identity binding (MVP uses wallet + PR description)
- Dispute resolution / human appeal mechanism
- Multi-sig governance for Agent key rotation

---

## 3. Goals

1. **Demonstrate end-to-end autonomous flow:** Issue funded → PR submitted → AI audits → funds released on-chain in under 30 seconds
2. **Prove dual-gate security model:** Show that prompt injection, test tampering, and replay attacks are mitigated
3. **Deliver a compelling 3-minute demo video** for BNB Hackathon 2026 submission
4. **Validate cost efficiency:** AI evaluation costs zero (free-tier Gemini) with ~1,500–3,000 tokens per audit

---

## 4. Target Users

| Persona | Role | Primary Action |
|---|---|---|
| **Project Owner / Maintainer** | DAO lead, OSS maintainer, grant allocator | Fund bounty escrow for GitHub issues |
| **Developer / Contributor** | Freelance dev, hackathon participant, OSS contributor | Solve issue, submit PR, claim payout |

---

## 5. Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-1 | **Bounty Creation** | Project owner locks ERC-20 tokens (USDT/BNB) in escrow, linked to a GitHub Issue URL with a deadline |
| FR-2 | **Webhook Detection** | Agent receives and validates `pull_request.opened` and `pull_request.synchronize` events within 5 seconds |
| FR-3 | **Hard Gate (CI Check)** | Agent fetches `check_runs` status from GitHub API; CI failure = instant reject without calling LLM |
| FR-4 | **Test Integrity Check** | Agent detects modifications to existing test assertions in the PR diff; unauthorized weakening = reject |
| FR-5 | **Soft Gate (AI Audit)** | Gemini Flash (free tier, configurable via GEMINI_PRIMARY_MODEL) evaluates diff against issue acceptance criteria; returns structured JSON verdict |
| FR-6 | **Cryptographic Payout** | Agent generates ECDSA signature binding `(bountyId, devWallet, commitHash, prUrl, nonce)`; developer calls `claimBounty()` on-chain |
| FR-7 | **PR Comment** | Agent posts transparent audit result (score, checklist, verdict) as a GitHub PR comment |
| FR-8 | **Refund / Cancel** | Project owner can withdraw locked funds after bounty deadline expires with no valid claim |
| FR-9 | **Bounty Explorer** | Dashboard displays all bounties with status, reward amount, tier category, and filter/search |
| FR-10 | **Audit Detail View** | Slide-over drawer shows acceptance criteria checklist, AI verdict, signature, and claim button |

---

## 6. Non-Functional Requirements

| Requirement | Target |
|---|---|
| **End-to-end audit latency** | ≤ 30 seconds (PR opened → signature generated) |
| **AI cost per audit** | $0.00 (Gemini free tier, ~1,500–3,000 tokens) |
| **Gas cost per claim** | Optimized for BNB Chain (~$0.01–$0.05 on testnet) |
| **Uptime** | N/A for hackathon (local/demo deployment) |
| **Browser support** | Chrome/Brave with MetaMask or Rabby wallet extension |

---

## 7. MVP Milestones & Exit Criteria

### Sprint H0: Ideation & Foundation ✅ (Done)

- [x] Concept ideation, architecture design, track selection
- [x] Naming & branding (`Bountra`)
- [x] Security mitigation framework documented
- [x] UI/UX component anatomy & design references documented
- **Exit:** Master Plan complete in Obsidian, AGENTS.md + docs suite initialized

### Sprint H1: Smart Contract & Core (Day 1)

- [x] Foundry project initialized (`solc = 0.8.28`, `evm_version = cancun`)
- [x] `BountraEscrow.sol` implements `createBounty`, `claimBounty`, `cancelBounty`
- [x] OpenZeppelin v5 ECDSA + ReentrancyGuard integrated
- [x] Foundry test suite: deposit, claim with valid/invalid signature, replay protection, deadline refund
- [x] Contract deployed & verified on BSC Testnet
- **Exit:** `forge test` passes 100%, contract verified on BSCScan testnet

### Sprint H2: Agent Backend & AI Engine (Day 2)

- [x] GitHub App / Webhook receiver (Fastify) operational
- [x] Octokit integration: fetch issue spec, diff, commit hash, check_runs
- [x] Gemini Flash (free tier, configurable via GEMINI_PRIMARY_MODEL) prompt engine with enforced JSON Schema
- [x] ECDSA signer via Viem private key wallet
- [x] PR auto-commenting with structured verdict
- **Exit:** End-to-end webhook → audit → signature generation works on a test repo

### Sprint H3: Frontend & Demo (Day 3)

- [x] Next.js 14 landing page: hero, animated beam pipeline, live audit terminal
- [x] Dashboard: bounty data table, filters, detail drawer, create bounty modal — *empty state verified only; the populated table and the claim signing flow still need a connected wallet against real on-chain data*
- [x] Privy wallet connection & GitHub auth with embedded EVM wallet to BNB Testnet
- [ ] Live demo recording (3-minute video) — *not recorded yet. `docs/DEMO_SCRIPT.md` is the script; the video is the remaining deliverable.*
- [ ] Pitch deck finalized & hackathon submission — *`docs/PITCH.md` and `README.md` are written; the submission itself has not been made.*
- **Exit:** Complete demo video showing PR → AI review → BSCScan payout transaction

---

## 8. Success Metrics (Demo Day)

| Metric | Target |
|---|---|
| Demo completes end-to-end without manual intervention | Yes |
| Time from PR open to escrow release (demo) | < 20 seconds |
| AI audit produces correct structured verdict | Score ≥ 90/100 on valid PR |
| Prompt injection attempt correctly rejected | 100% block rate |
| BSCScan shows confirmed payout transaction | Verified tx hash |

---

## 9. Bounty Scope Classification

| Tier | Examples | Hard Gate | Soft Gate |
|---|---|---|---|
| **Tier 1 (High Automation)** | Bug fix, scoped feature, refactor, security patch | CI 100% pass, test coverage maintained, diff scoped | Gemini validates acceptance criteria + zero vulnerabilities |
| **Tier 2 (Semantic Heavy)** | API docs, markdown specs, test suite additions | Linter/formatter pass | Gemini evaluates completeness, accuracy, structure |
| **Out of Scope** | UI styling, ambiguous tasks without criteria | Auto-reject | Confidence < 70% triggers manual fallback |
