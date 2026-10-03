# Bountra

> **Autonomous GitHub PR Auditor & Code-Gated Milestone Escrow on BNB Chain** 

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Foundry-363636?logo=ethereum)](https://book.getfoundry.sh/)
[![Fastify](https://img.shields.io/badge/Fastify-363636?logo=fastify)](https://fastify.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black?logo=next.js)](https://nextjs.org/)
[![BNB Chain](https://img.shields.io/badge/BNB%20Chain-BSC%20Testnet%2097-F0B90B?logo=binance)](https://testnet.bscscan.com/address/0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260)

---

## 🌟 Executive Summary

**Bountra** eliminates human review bottlenecks and milestone payment delays in Web3 open-source development. Sponsors lock milestone bounties in escrow on BNB Smart Chain. When a developer submits a pull request on GitHub, Bountra's AI Agent executes a rigorous **5-layer automated security and quality audit pipeline**:

1. **GitHub HMAC Verification** — Authenticates authentic webhook delivery origin via HMAC-SHA256 (`x-hub-signature-256`).
2. **CI Hard Gate** — Fetches GitHub Actions check-runs server-side; non-passing test suites fail immediately with zero LLM expenditure.
3. **Anti-Tamper Gate** — Audits git diffs for unauthorized modifications to protected test cases, workflows, and CI configurations.
4. **Gemini Flash Code Evaluation** — Performs sandboxed, XML-delimited semantic code review enforcing strict JSON Schema structured output.
5. **ECDSA Cryptographic Attestation** — Produces a signed on-chain claim authorization proof (`keccak256(bountyId, devWallet, commitHash, prUrl, contractAddress, chainId)`).

Once attested, the developer triggers escrow release on-chain via the Developer Hub. If a milestone expires without a valid submission, the sponsor reclaims 100% of their deposited funds.

---

## 📜 Deployed Contracts

| Network | Contract | Address | Explorer / Role |
|---|---|---|---|
| **BSC Testnet (Chain ID 97)** | `BountraEscrow.sol` | `0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260` | [BscScan Testnet](https://testnet.bscscan.com/address/0xbe576879961Bd8cdf7CfA72F146C8a3E352c7260) |
| **Agent Signer Key** | Viem ECDSA Signer | `0x2e10F4a41F665c657Ff4deC4A780e8734A066848` | On-Chain Attestation Signer |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Users ["👤 Actors & Interfaces"]
        Sponsor["Sponsor / Project Owner"]
        Dev["Contributor / Developer"]
        WebUI["Web dApp (Next.js 14 + Privy + Wagmi)"]
    end

    subgraph GitHub ["🐙 GitHub Ecosystem"]
        GH_Repo["GitHub Repository"]
        GH_PR["Pull Request\n(Closes #issue, Wallet: 0x...)"]
        GH_CI["GitHub Actions CI (check_runs)"]
        GH_Hook["Webhook Delivery"]
        GH_Comment["PR Audit Bot Comment"]
    end

    subgraph Agent ["🤖 Bountra Agent Backend (Fastify)"]
        direction TB
        WH_Gate["1. HMAC-SHA256 Origin Verification"]
        CI_Gate["2. Server-Side CI Hard Gate"]
        Tamper_Gate["3. Anti-Tamper Test Gate"]
        AI_Gate["4. Gemini Flash Semantic Evaluator"]
        ECDSA_Gate["5. ECDSA Signer (Viem keccak256 proof)"]
        DB[("SQLite / Drizzle ORM\nAudit Logs & Bounties")]

        WH_Gate --> CI_Gate --> Tamper_Gate --> AI_Gate --> ECDSA_Gate
        ECDSA_Gate -.-> DB
        ECDSA_Gate -.-> GH_Comment
    end

    subgraph Blockchain ["⛓️ BNB Smart Chain (BSC Testnet 97)"]
        Escrow["BountraEscrow.sol"]
        Vault[("Milestone Escrow Pool (USDT / ERC-20)")]
        Escrow --- Vault
    end

    %% Sponsor Flow
    Sponsor -->|"1. Lock ERC-20 & Define Milestone"| WebUI
    WebUI -->|"createBounty()"| Escrow
    WebUI -->|"POST /api/bounties (Register Issue Mapping)"| DB

    %% Developer Flow
    Dev -->|"2. Submit PR with Issue & Wallet"| GH_PR
    GH_PR --> GH_Repo
    GH_Repo -->|"Run Test Suite"| GH_CI
    GH_Repo -->|"pull_request (opened, synchronize)"| GH_Hook
    GH_Hook -->|"x-hub-signature-256"| WH_Gate
    CI_Gate <-->|"Fetch check_runs via Octokit"| GH_CI
    GH_Comment -.->|"Post Audit Verdict"| GH_PR

    %% Payout Flow
    Dev -->|"3. Request Claim Authorization"| WebUI
    WebUI <-->|"POST /api/claim/authorize"| DB
    WebUI -->|"claimBounty(signature, proof)"| Escrow
    Escrow -->|"Verify ecrecover == agentSigner"| Escrow
    Escrow -->|"Transfer Locked Tokens"| Dev
```

---

## 🔄 User Flow & Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Sponsor as 👤 Sponsor
    actor Dev as 👨💻 Developer
    participant GH as 🐙 GitHub (Repo & CI)
    participant Agent as 🤖 Bountra Agent
    participant Web as 🌐 Bountra dApp
    participant Contract as ⛓️ BountraEscrow (BSC)

    %% Phase 1
    rect rgb(240, 245, 255)
    Note over Sponsor, Contract: Phase 1: Milestone Bounty Creation
    Sponsor->>Web: Connect wallet & fill issue URL, token, amount, deadline
    Web->>Contract: createBounty(issueUrl, token, amount, deadline)
    Contract-->>Web: Event: BountyCreated(bountyId)
    Web->>Agent: POST /api/bounties (Register bountyId ↔ issueUrl mapping)
    end

    %% Phase 2
    rect rgb(245, 255, 240)
    Note over Dev, Agent: Phase 2: PR Submission & Autonomous 5-Layer Audit
    Dev->>GH: Open Pull Request ("Closes <issue-url>", "Wallet: 0x...")
    GH->>GH: Run GitHub Actions CI workflow
    GH->>Agent: Webhook POST /webhook/github (HMAC-SHA256 payload)
    Agent->>Agent: Layer 1: Verify HMAC-SHA256 signature
    Agent->>GH: Layer 2: Fetch check-runs (CI Hard Gate)
    Agent->>Agent: Layer 3: Scan diff for test tampering (Anti-Tamper Gate)
    Agent->>Agent: Layer 4: Gemini Flash semantic code review (Score ≥ 70)
    Agent->>Agent: Layer 5: Sign keccak256(bountyId, devWallet, commit, prUrl, contract, chainId)
    Agent->>GH: Post comprehensive audit comment on PR
    Agent->>Agent: Persist audit log & ECDSA signature in SQLite
    end

    %% Phase 3
    rect rgb(255, 250, 240)
    Note over Dev, Contract: Phase 3: Cryptographic Claim & Escrow Release
    Dev->>Web: Open Developer Hub & launch Claim Drawer
    Web->>Agent: POST /api/claim/authorize (bountyId, prUrl, commitHash, devWallet)
    Agent-->>Web: Return stored ECDSA signature & message hash
    Dev->>Web: Confirm claim transaction
    Web->>Contract: claimBounty(bountyId, devWallet, prUrl, commitHash, signature)
    Contract->>Contract: Verify ecrecover(messageHash, signature) == agentSigner
    Contract->>Contract: Guard against replay (usedSignatures[messageHash] = true)
    Contract->>Dev: Transfer locked ERC-20 tokens to developer wallet
    end
```

### Detailed Lifecycle Phases

1. **Milestone Creation & Funding**:
   - The sponsor specifies the target GitHub Issue, ERC-20 token, reward amount, and deadline on the dApp.
   - The contract transfers tokens into escrow and emits `BountyCreated`.
   - The dApp registers the `bountyId ↔ issueUrl` mapping with the agent backend via `POST /api/bounties`.

2. **PR Submission & Multi-Gate Audit**:
   - The contributor opens a Pull Request referencing the issue and their payout address:
     ```markdown
     Closes https://github.com/<owner>/<repo>/issues/<id>
     Wallet: 0xYourBscAddressHere
     ```
   - Only `opened` and `synchronize` webhook actions trigger audits. Non-diff actions (`closed`, `labeled`, `edited`) return `200 ignored` immediately without LLM costs.
   - The pipeline sequentially verifies HMAC, checks GitHub CI completion, audits test integrity, and passes sandboxed diffs to Gemini Flash.
   - If score $\ge 70$ and no security issues are found, the agent signs an ECDSA authorization hash and posts the verdict comment to GitHub.

3. **Escrow Claiming**:
   - The developer opens the Developer Hub on the dApp.
   - The frontend calls `POST /api/claim/authorize` through the Next.js server proxy (`/api/agent/...`) to retrieve the stored passing signature.
   - The developer submits `claimBounty(...)` on BNB Chain. The smart contract validates the agent's signature on-chain and releases the bounty funds directly to the developer's wallet.

---
ß
## 📁 Repository Structure

```
bountra/
├── contracts/               # Foundry Smart Contracts (Solidity 0.8.28, Cancun EVM)
│   ├── src/BountraEscrow.sol    # Core code-gated escrow & ECDSA verification logic
│   ├── test/BountraEscrow.t.sol  # Reentrancy, replay guard, and authorization test cases
│   └── script/Deploy.s.sol      # Deployment script for BSC/opBNB Testnet
├── agent/                   # Autonomous Auditor Backend (Fastify + TypeScript)
│   ├── src/evaluator/           # Gemini Flash structured review & anti-tamper security
│   ├── src/signer/              # Viem ECDSA claim attestation signing
│   ├── src/security/            # HMAC-SHA256 signature verification
│   ├── src/routes/              # Webhook endpoint & claim authorization proxy
│   └── src/db/                  # SQLite schema & Drizzle ORM client
├── web/                     # Frontend dApp (Next.js 14 App Router + Tailwind + Wagmi)
│   ├── src/app/page.tsx         # Landing page, pipeline visualizer, audit terminal
│   ├── src/app/explore/page.tsx # Bounty directory & creation modal
│   ├── src/app/dashboard/       # Sponsor Escrow Management & Developer Claims
│   └── src/components/modals/   # CreateBountyModal & ClaimBountyDrawer
└── docs/                    # Technical specs, architecture, & master plan
```

---

## 📄 License

MIT License. Built with ❤️ for the BNB Chain Ecosystem.
