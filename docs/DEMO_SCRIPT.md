# Bountra — 3-Minute Demo Video Script & Walkthrough Guide
**BNB Chain Hackathon 2026 • AI Agents Track**

---

## 🎬 Video Overview

* **Target Duration:** 3:00 – 3:30 Minutes
* **Format:** Screen Recording + Voiceover / Subtitles (Clean Dark Mode UI)
* **Goal:** Demonstrate that Bountra solves real grant/bounty friction by combining autonomous Bountra Agent code auditing with cryptographic ECDSA attestation and on-chain BNB smart contract settlement.

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
  * Show **Magic UI Animated Beam** in Hero section connecting GitHub PR $\rightarrow$ Bountra Agent $\rightarrow$ BNB Escrow Vault.
  * Scroll down to **Live Audit Terminal Viewer**:
    * Switch between scenarios:
      1. *Scenario 1: Clean Approved PR (Score: 96/100, All 5 gates passed)*
      2. *Scenario 2: Test Tampering Attempt (REJECTED: Assertion weakened)*
      3. *Scenario 3: Prompt Injection Payload (BLOCKED: XML Sandboxing)*
    * Click tab **JSON Verdict** & **ECDSA Proof** (showing the keccak256 digest and EIP-191 signature).
    * Treat these terminal scenarios as static UI fixtures. They illustrate the
      pipeline but do not authorize a live claim.
* **Voiceover:**
  > "Bountra doesn't just run an LLM prompt. It enforces a strict 5-layer security pipeline:
  > First, GitHub HMAC signature validation.
  > Second, Hard CI Gate from GitHub Actions.
  > Third, Anti-Tamper inspection preventing developers from bypassing tests.
  > Fourth, XML-sandboxed semantic code auditing by the Bountra Agent.
  > And fifth, an on-chain verifiable ECDSA cryptographic signature that can never be faked or replayed."

---

### Scene 3: Sponsor Creates Escrow on BSC Testnet (1:15 – 1:55)
* **Visual:**
  * Navigate to **Explore** (`/explore`) or click **Create Bounty** button.
  * Open `CreateBountyModal`:
    * Paste the GitHub Issue URL used by the demo repository.
    * Reward: `100 USDT` on BSC Testnet.
    * Duration: `14 Days`.
  * Trigger Wagmi approval $\rightarrow$ deposit into `BountraEscrow.sol`.
  * Show BSCScan Testnet contract link (`0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260`).
* **Voiceover:**
  > "Sponsors lock bounty rewards in our audited Solidity escrow contract on BNB Chain. The funds are protected by immutable smart contract logic: if no valid PR is merged before the deadline, the sponsor can claim a 100% refund."

---

### Scene 4: Instant Developer Claim & On-Chain Settlement (1:55 – 2:40)
* **Visual:**
  * Open `/dashboard`, connect the developer wallet, and switch to **Developer Hub**.
  * Select a row with an eligible, passing audit for that connected wallet.
  * The claim-mode `ClaimBountyDrawer` requests the already-stored signature from
    the agent; there is no **"Autofill Proof from Live Audit Terminal"** control.
  * Show the claim parameters bound to `(bountyId, devWallet, commitHash, prUrl,
    contractAddress, chainId)` and approve the wallet transaction.
  * The drawer executes `claimBounty()` and shows the transaction hash after the
    receipt confirms. Verify the receipt and token movement on BscScan.
* **Voiceover:**
  > "Once the developer's PR passes the audit, the Bountra Agent provides a cryptographic proof. From the Developer Hub, one wallet action triggers settlement. The smart contract verifies `ecrecover` on-chain, confirms the agent's signature, and releases the tokens directly to the developer's wallet after the receipt succeeds."

---

### Scene 5: User Dashboard & Escrow Protection (2:40 – 3:10)
* **Visual:**
  * Navigate to `/dashboard`.
  * Show **Sponsor Hub**: Current on-chain bounties owned by the connected wallet,
    escrow totals, statuses, and the **Refund Deposit** action after expiry.
  * Switch to **Developer Hub**: Current eligible and claimed rows plus the
    aggregate earned, completed-audit, and available-to-claim counters. It is
    not a historical audit browser or a transaction-proof explorer.
* **Voiceover:**
  > "In the User Dashboard, project owners monitor current escrow bounties. If a bounty expires without a qualifying PR, the sponsor reclaims their deposit with one click. Developers see current claim rows and aggregate earnings, while the settlement itself is verified on-chain by the claim receipt."

---

### Scene 6: Conclusion & Impact on BNB Ecosystem (3:10 – 3:30)
* **Visual:**
  * Return to hero overview showing live stats.
  * Display tech stack badges: *BNB Chain • Bountra Agent • Foundry • Fastify • Next.js 14 • Privy*.
* **Voiceover:**
  > "By eliminating manual review friction and securing milestone escrow with autonomous AI attestation, Bountra accelerates open-source development across the BNB Chain ecosystem.
  > Autonomous. Code-gated. Cryptographically verified.
  > This is Bountra."

---

## Cold-reader live runbook

This is the reproducible path used for the verified demo. The terminal on `/`
is illustrative; it is not the source of a claim signature.

1. Start the agent from `agent/` with `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`,
   `AGENT_PRIVATE_KEY`, the escrow address, the BSC testnet RPC URL, and the
   Gemini key configured as needed. Start the web app from `web/`.
2. If using the live webhook, expose port `3001` with a Cloudflare quick tunnel:
   `cloudflared tunnel --url http://localhost:3001`. Register
   `https://<current-tunnel-host>/webhook/github` on the repository. The URL
   changes after every tunnel restart, so update the hook each time.
3. In the dashboard, connect the sponsor wallet, create a bounty for the exact
   GitHub issue URL, approve the token, and wait for the `createBounty` receipt.
4. Register the bounty manually in the agent database. The UI creates the
   on-chain escrow but does not call `POST /api/bounties`; without this step the
   webhook returns `200 skipped` and no audit is stored.
   Replace each angle-bracket placeholder below with the values from the
   `createBounty` receipt and the exact issue URL.

   ```bash
   curl -X POST http://localhost:3001/api/bounties \
     -H 'Content-Type: application/json' \
     -d '{
       "bountyId": <on-chain-bounty-id>,
       "issueUrl": "https://github.com/<owner>/<repo>/issues/<number>",
       "repoOwner": "<owner>",
       "repoName": "<repo>",
       "issueNum": <number>,
       "creator": "<sponsor-wallet>",
       "token": "<token-address>",
       "amount": "<token-base-units>",
       "deadline": <unix-deadline>,
       "status": "open",
       "txHash": "<create-bounty-tx-hash>"
     }'
   ```

5. Open a PR that references the same issue with `Closes <issue-url>` and
   includes `Wallet: 0x...` in the PR body. Keep the PR away from protected
   test and CI paths, and wait for GitHub CI to report success.
6. Confirm the webhook delivery, the stored passing audit, and the PR verdict
   comment. If no audit appears, first check the exact issue URL and the manual
   registration row.
7. Open `/dashboard` as the developer, select **Developer Hub**, and choose
   the row backed by the passing audit. The drawer must request authorization
   from the agent before the claim button enables.
8. Approve the wallet transaction, wait for the receipt, and verify the
   `BountyClaimed` event and ERC-20 transfer. The claim confirmation endpoint
   records the transaction hash only after it reads those on-chain facts back.
