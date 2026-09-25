# Bountra — 3-Minute Demo Video Script & Walkthrough Guide
**BNB Chain Hackathon 2026 • AI Agents Track**

---

## 🎬 Video Overview

* **Target Duration:** 3:00 – 3:30 Minutes
* **Format:** Screen Recording + Voiceover / Subtitles (Clean Dark Mode UI)
* **Goal:** Demonstrate that Bountra solves real grant/bounty friction by combining Gemini 2.0 Flash AI agent code auditing with cryptographic ECDSA attestation and on-chain BNB smart contract settlement.

---

## ⏱️ Scene-by-Scene Breakdown

### Scene 1: The Problem (0:00 – 0:35)
* **Visual:**
  * Open GitHub issue with stagnant bounty discussions (months without review).
  * Fast cuts showing PR queues waiting for human maintainers.
* **Voiceover:**
  > "Web3 open-source development and ecosystem grants suffer from a massive bottleneck: human review delay. Developers wait weeks for PR reviews to claim bounties, while DAOs risk grant drains from low-quality PRs or malicious prompt injection attacks designed to trick AI reviewers.
  > Meet **Bountra** — the autonomous GitHub PR auditor and code-gated milestone escrow on BNB Smart Chain."

---

### Scene 2: Landing Page & Live 5-Layer Security Pipeline (0:35 – 1:15)
* **Visual:**
  * Open Bountra Web App (`http://localhost:3000`).
  * Show Header: BNB Testnet badge, Privy GitHub Social Login.
  * Show **Magic UI Animated Beam** in Hero section connecting GitHub PR $\rightarrow$ Gemini 2.0 Flash $\rightarrow$ BNB Escrow Vault.
  * Scroll down to **Live Audit Terminal Viewer**:
    * Switch between scenarios:
      1. *Scenario 1: Clean Approved PR (Score: 94/100, All 5 gates passed)*
      2. *Scenario 2: Test Tampering Attempt (REJECTED: Assertion weakened)*
      3. *Scenario 3: Prompt Injection Payload (BLOCKED: XML Sandboxing)*
    * Click tab **JSON Verdict** & **ECDSA Proof** (showing the keccak256 digest and EIP-191 signature).
* **Voiceover:**
  > "Bountra doesn't just run an LLM prompt. It enforces a strict 5-layer security pipeline:
  > First, GitHub HMAC signature validation.
  > Second, Hard CI Gate from GitHub Actions.
  > Third, Anti-Tamper inspection preventing developers from bypassing tests.
  > Fourth, XML-sandboxed semantic code auditing via Gemini 2.0 Flash.
  > And fifth, an on-chain verifiable ECDSA cryptographic signature that can never be faked or replayed."

---

### Scene 3: Sponsor Creates Escrow on BSC Testnet (1:15 – 1:55)
* **Visual:**
  * Navigate to **Explore** (`/explore`) or click **Create Bounty** button.
  * Open `CreateBountyModal`:
    * Paste GitHub Issue URL: `https://github.com/bountra/core-contracts/issues/42`
    * Reward: `100 USDT` on BSC Testnet.
    * Duration: `14 Days`.
  * Trigger Wagmi approval $\rightarrow$ deposit into `BountraEscrow.sol`.
  * Show BSCScan Testnet contract link (`0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260`).
* **Voiceover:**
  > "Sponsors lock bounty rewards in our audited Solidity escrow contract on BNB Chain. The funds are protected by immutable smart contract logic: if no valid PR is merged before the deadline, the sponsor can claim a 100% refund."

---

### Scene 4: Instant Developer Claim & On-Chain Settlement (1:55 – 2:40)
* **Visual:**
  * In `/explore`, click on bounty card: *"Details & Claim"*.
  * Slide-over `ClaimBountyDrawer` appears:
    * Auto-populates developer wallet.
    * Click *"Autofill Proof from Live Audit Terminal"*.
    * Demonstrates the cryptographic signature binding `(bountyId, devWallet, commitHash, prUrl)`.
    * Click **"Execute Settlement on BSC Testnet"**.
    * Wagmi executes `claimBounty()`. Show instant transaction confirmation and BscScan receipt!
* **Voiceover:**
  > "Once the developer's PR passes the audit, the Bountra Agent generates a cryptographic proof. With a single click, the developer triggers on-chain settlement. The smart contract verifies `ecrecover` on-chain, confirms the agent's signature, and releases the tokens directly to the developer's wallet in under 15 seconds."

---

### Scene 5: User Dashboard & Escrow Protection (2:40 – 3:10)
* **Visual:**
  * Navigate to `/dashboard`.
  * Show **Sponsor Hub**: Track total TVL locked, active bounties, and the active **Refund Escrow** button for expired tasks.
  * Switch to **Developer Hub**: View historical audits, Gemini scores, and verified payout transactions.
* **Voiceover:**
  > "In the User Dashboard, project owners monitor active bounties with zero counterparty risk. If a bounty expires without a qualifying PR, the sponsor reclaims their deposit with one click. Developers keep a transparent, on-chain record of their contributions and earnings."

---

### Scene 6: Conclusion & Impact on BNB Ecosystem (3:10 – 3:30)
* **Visual:**
  * Return to hero overview showing live stats.
  * Display tech stack badges: *BNB Chain • Gemini 2.0 Flash • Foundry • Fastify • Next.js 14 • Privy*.
* **Voiceover:**
  > "By eliminating manual review friction and securing milestone escrow with autonomous AI attestation, Bountra accelerates open-source development across the BNB Chain ecosystem.
  > Autonomous. Code-gated. Cryptographically verified.
  > This is Bountra."
