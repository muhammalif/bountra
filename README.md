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
2. **CI Hard Gate** (Server-side GitHub CI evidence must be green)
3. **Anti-Tamper Gate** (Blocks changes to protected test and CI file paths)
4. **Gemini Flash Code Evaluation** (Sanitized, XML-delimited semantic review)
5. **ECDSA Cryptographic Attestation** (Signed keccak256 proof)

Once verified, the developer triggers on-chain escrow release from the Developer Hub. If a milestone expires without a valid submission, the sponsor reclaims 100% of their deposit.

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
│   └── script/Deploy.s.sol
├── agent/                   # Agent Evaluation Backend (Fastify + Gemini Flash)
│   ├── src/evaluator/       # Gemini Flash review, sanitized XML-delimited prompts
│   ├── src/signer/          # Viem ECDSA claim attestation
│   ├── src/security/        # HMAC-SHA256 webhook signature verification
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

### 4. GitHub Webhook (optional — the manual path works without it)

```bash
# 1. pick a secret, put it in agent/.env
echo "GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)" >> agent/.env

# 2. expose the agent
cd agent && pnpm dev
cloudflared tunnel --url http://localhost:3001

# 3. register the hook (needs a separate token with admin:repo_hook; the agent's
#    GITHUB_TOKEN reads PRs/check-runs and writes the FR-7 audit comment)
curl -X POST https://api.github.com/repos/<owner>/<repo>/hooks \
  -H "Authorization: Bearer $GITHUB_ADMIN_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"name":"web","active":true,"events":["pull_request"],
       "config":{"url":"https://<tunnel-host>/webhook/github",
                 "content_type":"json","secret":"<same secret>"}}'
```

The agent's `GITHUB_TOKEN` is not read-only: the verified setup used the
`repo` and `workflow` scopes so Octokit can read PR/check-run data and write the
FR-7 audit comment. `GITHUB_ADMIN_TOKEN` is separate and is only used to create
or update the webhook with `admin:repo_hook`.

Every delivery is authenticated with `HMAC-SHA256(secret, raw body)` and checked
against `x-hub-signature-256` in constant time. If `GITHUB_WEBHOOK_SECRET` is
unset the endpoint answers `503` and audits nothing — by design, not as a bug to
work around.

| Response | Meaning |
|---|---|
| `503` | Secret not configured on the agent |
| `401` | Missing, malformed or wrong signature |
| `200` `skipped` | PR closes an issue with no registered bounty |
| `200` `pending_wallet` | PR body has no `Wallet: 0x...` line |
| `200` `audited` | Evaluator ran — `verdict`, `score`, `signature` returned |

The PR body must reference the bounty issue (`Closes <issue-url>`) and the
payout address (`Wallet: 0x...`), otherwise nothing is signed.

For a direct agent demo, `POST /api/audit/evaluate` fetches CI status from
GitHub and runs the integrity gate without a webhook, but it does not post the
FR-7 GitHub comment and is not forwarded through the web proxy. The complete
GitHub-to-agent flow uses the signed webhook.

**Tunnel notes.** The verified setup used a Cloudflare quick tunnel. Its
`trycloudflare.com` host changes every time you restart `cloudflared`, so update
the hook URL each time. Use a public HTTPS tunnel that forwards POST; free
`localhost.run` tunnels only proxy GET and answer `503 no tunnel here` to POST.
Verify the public URL with an actual POST before trusting it — `GET /health`
does not prove POST works. Wait for the agent's `/health` before registering.

Only two `pull_request` actions are audited: `opened` (first submission) and
`synchronize` (a new commit, the only thing that invalidates a prior verdict).
Every other action — `closed`, `reopened`, `edited`, `labeled` — is answered
`200 {"status":"ignored"}` before the bounty lookup, so a metadata change on a
judged PR costs no provider spend.

**Two hook settings that fail confusingly.** Both were hit while wiring this up:

| Setting | Wrong value | Symptom |
|---|---|---|
| `config.content_type` | `form` (GitHub's default) | Every delivery returns `415 Unsupported Media Type`. Worse, a form body is *not* the raw bytes you signed, so HMAC verification could never pass. |
| `config.secret` | omitted on a later `PATCH .../config` | Silently rotates to empty; deliveries return `401 missing_signature`. Re-send `secret` in the same PATCH that updates `url`. |

Check both after any hook edit:
`GET /repos/<owner>/<repo>/hooks/<id>` must show `"content_type": "json"`, then
`POST /repos/<owner>/<repo>/hooks/<id>/pings` must return a delivery with `200`.

---

## 📄 License
MIT License. Built with ❤️ for the BNB Chain Ecosystem.
