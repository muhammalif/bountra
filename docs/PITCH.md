# Bountra — Hackathon Submission Pitch
**BNB Chain Hackathon 2026 • AI Agents Track**

---

## 📌 Project Overview

* **Project Name:** Bountra
* **Tagline:** Autonomous GitHub PR Auditor & Code-Gated Milestone Escrow on BNB Chain
* **Track:** AI Agents Track
* **Live Web App:** `http://localhost:3000` (Multi-Page Next.js 14.2.35 dApp)
* **Smart Contract (BSC Testnet, Chain ID 97):** [`0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260`](https://testnet.bscscan.com/address/0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260)
* **Escrow Token:** Bountra Mock USDT (`0x189C7cA448e89DaF1C2A1C9a4DB4D9Ec475441c1`) — a testnet ERC-20, **not real USDT**. The escrow contract, agent, and settlement path are production code running on testnet; the funding asset is the only testnet component.
* **Agent Signer Address:** `0x2e10F4a41F665c657Ff4deC4A780e8734A066848` — the key that produced the 3 live settlements. Judges can verify each `ecrecover` on BscScan against the contract's `usedSignatures` and the audit records.
* **Live State:** 7 escrows created, 3 settled on-chain, 400 Mock USDT currently held in escrow.
* **Test Baseline:** 125 agent tests (118 passed, 0 failed, 7 skipped — live-chain tests gated by `NO_CHAIN`), 15/15 Foundry contract tests, web type-check clean.

---

## 💡 Problem Statement

Web3 open-source development and ecosystem grant distribution suffer from severe operational friction:

1. **Review Latency Bottleneck:** Developers wait weeks or months for project maintainers to review pull requests, draining developer momentum and stalling grant milestones.
2. **High Security & Poisoning Risks:** Malicious contributors attempt to bypass tests, tamper with existing unit test suites (`assert(true)`), or inject deceptive instructions into code comments (*Prompt Injection*) to deceive automated AI review tools.
3. **Escrow Trust Deficit:** Developers fear working without guaranteed payouts, while sponsors fear locking funds in escrows that can be drained by substandard or malicious code.

---

## 🛡️ The Bountra Solution

Bountra bridges GitHub repositories with BNB Smart Chain smart contracts through an **autonomous, 5-layer AI security agent**:

1. **Escrow Creation:** Project owners deposit milestone funds into `BountraEscrow.sol` on BNB Chain, bound to a specific GitHub issue.
2. **Autonomous 5-Layer Security Audit:** When a developer submits a PR, the Bountra Agent executes a multi-gate verification pipeline:
   * **Gate 1: HMAC Webhook Authentication:** Ensures payloads genuinely originate from GitHub.
   * **Gate 2: CI Hard Gate:** Rejects the PR when server-side GitHub CI evidence is not green.
   * **Gate 3: Anti-Tamper Test Suite Check:** Rejects changes to protected test and CI file paths using a conservative path-regex guard.
   * **Gate 4: Bountra Agent Semantic Evaluation:** Sanitizes and wraps untrusted issue, PR, and diff text in XML-like delimiters before the structured Gemini evaluation.
   * **Gate 5: ECDSA Cryptographic Attestation:** If approved, the agent signs a proof binding `keccak256(bountyId, devWallet, commitHash, prUrl, contractAddress, chainId)`.
3. **Instant Settlement:** The developer calls `claimBounty()` on BNB Chain with the agent's signature. The smart contract validates `ecrecover` on-chain and transfers tokens immediately.

---

## ⚙️ Architecture & Technical Stack

```
   ┌────────────────────────────────────────────────────────┐
   │                    GitHub Workflow                     │
   │   Issue Opened  ──>  PR Submitted  ──>  CI Actions     │
   └───────────────────────────┬────────────────────────────┘
                               │ Webhook
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │             Bountra Agent Backend (Fastify)            │
   │  Layer 1: HMAC Verify                                  │
   │  Layer 2: CI Status Hard Gate                          │
   │  Layer 3: Test Diff Anti-Tampering Gate                │
   │  Layer 4: Sanitized XML-delimited Gemini Audit         │
   │  Layer 5: ECDSA Viem Signer (Keccak256 Proof)          │
   └───────────────────────────┬────────────────────────────┘
                               │ ECDSA Signature
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │             BNB Chain Smart Contract                   │
   │  BountraEscrow.sol (Solidity 0.8.28 • Cancun EVM)      │
   │  - createBounty(issueUrl, token, amount, deadline)     │
   │  - claimBounty(bountyId, devWallet, prUrl, hash, sig)  │
   │  - cancelBounty(bountyId) [100% Sponsor Refund]        │
   │  - ReentrancyGuard, SafeERC20, digest replay guard      │
   └────────────────────────────────────────────────────────┘
```

* **Smart Contracts:** Solidity `0.8.28`, EVM `cancun`, OpenZeppelin v5, Foundry testing suite (15/15 tests passing).
* **Agent Engine:** Fastify REST API, Viem Cryptographic Signer, Octokit API, Google Gemini Flash Free Tier (`gemini-3.1-flash-lite` with `gemini-3.6-flash` fallback). Current agent suite: 125 tests, 118 passed, 0 failed, 7 skipped because the live BSC testnet tests are gated by `NO_CHAIN`.
* **Frontend Web App:** Next.js 14 App Router (`14.2.35`), Tailwind CSS, Magic UI (Animated Beam, Animated Shiny Text), Privy Auth & Embedded EVM Wallet, Wagmi v2 / Viem, Anti-Slop UI.

---

## 🚀 Key Features

* **Multi-Page Web3 dApp:**
  * **Landing Page (`/`):** Hero pipeline visualizer, live 5-layer macOS terminal simulator (clean PR, test tampering, prompt injection), and featured bounties teaser.
  * **Bounty Explorer (`/explore`):** Interactive directory with search, status filters (*Open*, *In Review*, *Claimed*), on-chain deposit modal (`CreateBountyModal`), and slide-over claim drawer (`ClaimBountyDrawer`).
  * **User Dashboard (`/dashboard`):** Sponsor Escrow Management with deadline-based 100% refund capability (`cancelBounty`) and Developer Claims tracker with Bountra Agent audit logs.
* **Resilient Security Design:**
  * Prompt-injection mitigation: untrusted content is sanitized, wrapped in XML-like delimiters, and evaluated under explicit anti-injection instructions. This reduces risk; it is not a proof of zero risk.
  * Replay attack prevention: the signature binds `(bountyId, devWallet, commitHash, prUrl, contractAddress, chainId)` and the contract consumes each digest once through `usedSignatures`.

---

## 🗺️ Roadmap & Ecosystem Future

1. **opBNB Gasless Settlement:** Implementing Account Abstraction (ERC-4337) and Paymasters on opBNB to offer zero gas fees for developer payouts.
2. **Multi-Agent Audit Quorum:** Integrating a 2-of-3 agent consensus model (e.g. Gemini 3.1 Flash Lite + a second provider + DeepSeek-class model) with aggregated BLS signatures.
3. **EigenLayer / AVS Integration:** Economic slashing for autonomous agent validators to guarantee attestation integrity.
