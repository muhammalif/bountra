# Bountra

> **Autonomous GitHub PR Auditor & Code-Gated Milestone Escrow on BNB Chain** 

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Foundry-363636?logo=ethereum)](https://book.getfoundry.sh/)
[![Fastify](https://img.shields.io/badge/Fastify-363636?logo=fastify)](https://fastify.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black?logo=next.js)](https://nextjs.org/)
[![BNB Chain](https://img.shields.io/badge/BNB%20Chain-BSC%20Testnet%2097-F0B90B?logo=binance)](https://testnet.bscscan.com/address/0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260)

---

## 🌟 Executive Summary

**Bountra** is a decentralized protocol that eliminates human review bottlenecks in Web3 open-source development and grant distribution. Project owners lock milestone bounties in escrow on BNB Smart Chain. When a developer submits a pull request on GitHub, Bountra's AI Agent conducts a rigorous **5-layer automated security audit**:
1. **GitHub HMAC Verification** (Authentic webhook origin)
2. **CI Hard Gate** (GitHub Actions unit tests must pass)
3. **Anti-Tamper Gate** (Detects assertion weakening or test suite modification)
4. **Gemini Flash Code Evaluation** (XML sandboxed semantic review)
5. **ECDSA Cryptographic Attestation** (Signed keccak256 proof)

Once verified, the developer triggers instant on-chain escrow release in under 15 seconds. If a milestone expires without a valid submission, the sponsor reclaims 100% of their deposit.

---

## 📜 Deployed Contracts

| Network | Contract | Address | Explorer |
|---|---|---|---|
| **BSC Testnet (Chain ID 97)** | `BountraEscrow.sol` | `0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260` | [BscScan Testnet](https://testnet.bscscan.com/address/0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260) |
| **Agent Signer Key** | Viem ECDSA Signer | `0x2e10F4a41F665c657Ff4deC4A780e8734A066848` | On-Chain Attestation Signer |

---

## 🏗️ Repository Architecture

```
bountra/
├── contracts/               # Foundry Smart Contracts (Solidity 0.8.28, Cancun EVM)
│   ├── src/BountraEscrow.sol
│   ├── test/BountraEscrow.t.sol
│   └── script/DeployEscrow.s.sol
├── agent/                   # Agent Evaluation Backend (Fastify + Gemini Flash)
│   ├── src/evaluator/       # Gemini Flash code review, XML-sandboxed
│   ├── src/signer/          # Viem ECDSA claim attestation
│   ├── src/routes/webhook.ts
│   └── test/                # CI gates, scope binding, mock evaluator
├── web/                     # Frontend Multi-Page dApp (Next.js 14 + Privy + Wagmi)
│   ├── src/app/page.tsx           # Landing Page + Hero Visualizer + Live Terminal
│   ├── src/app/explore/page.tsx   # Bounty Directory + Filters + CreateBountyModal
│   ├── src/app/dashboard/page.tsx # Sponsor Escrow Manager (Refund) + Developer Claims
│   ├── src/components/modals/     # CreateBountyModal + ClaimBountyDrawer
│   └── src/components/terminal/   # 5-Layer Live Audit Terminal & Simulator
```

---

## ⚡ Quickstart

Each package reads its config from a local env file. Copy the matching
`.env.example` in that package's root, fill in the values, and keep the file
untracked — the agent refuses to sign claims without an explicit
`AGENT_PRIVATE_KEY`, so there is no default to fall back on.

### 1. Smart Contracts (Foundry)
```bash
cd contracts
cp .env.example .env      # needs PRIVATE_KEY and AGENT_SIGNER
forge build
forge test -vvv
```

### 2. Agent Evaluation Service (Fastify)
```bash
cd agent
cp .env.example .env      # needs AGENT_PRIVATE_KEY, GEMINI_API_KEY, GITHUB_TOKEN
pnpm install
pnpm test
pnpm dev
```

### 3. Frontend Multi-Page dApp (Next.js 14)
```bash
cd web
cp .env.example .env.local   # needs NEXT_PUBLIC_PRIVY_APP_ID
pnpm install
pnpm dev # runs on http://localhost:3000
```

The GitHub webhook target must be a **public URL** during the demo. Tunnel
port 3001 and register the resulting URL as the GitHub App webhook.

---

## 📹 Hackathon Demo & Presentation

The demo script, pitch deck and development plan are maintained outside the
public repo. What a judge needs is in this README: the 5-layer audit pipeline,
the deployed contract address, the test counts, and the Quickstart above.

---

## 📄 License
MIT License. Built with ❤️ for the BNB Chain Ecosystem.
