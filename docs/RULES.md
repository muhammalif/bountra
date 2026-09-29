# Bountra — Rules & Conventions

## 1. Runtime Rules

### Smart Contract
- Solidity version: `0.8.28` (pinned, not caret)
- EVM target: `cancun`
- All external calls must use `ReentrancyGuard`
- Only `agentSigner` can authorize payouts (verified via `ecrecover`)
- Signature includes `nonce` — each signature is single-use
- `claimBounty` must verify `bounty.claimed == false` before transfer
- `cancelBounty` only allowed after `block.timestamp > bounty.deadline`

### Agent Backend
- All webhook payloads must be verified via HMAC-SHA256 (`x-hub-signature-256`)
- CI status must be fetched server-side from GitHub API — never trust client input
- AI evaluation only triggered after Hard Gate + Integrity Gate pass (cost optimization)
- All LLM prompts wrap untrusted data in `<untrusted_diff>` / `<untrusted_commit_message>` XML tags
- LLM response must conform to JSON Schema — non-conforming responses are rejected
- Agent private key stored in `.env` — never committed, never logged, never sent to frontend

### Frontend
- Wallet connection & Auth via Privy (GitHub login + Embedded EVM Wallet + External Wallets)
- All contract reads via Wagmi / Viem hooks
- All contract writes via Wagmi / Viem hooks with confirmation wait
- No direct `fetch()` to blockchain RPC — always through Viem/Wagmi abstraction

---

## 2. Security Boundaries

| Boundary | Rule |
|---|---|
| Agent key | Server-side only. `.env` file, never in git, never in logs |
| GitHub webhook secret | Server-side only. Verify every incoming request |
| LLM prompt | System instruction is immutable. User data is sandboxed as XML-delimited data |
| On-chain signature | Binds `(bountyId, devWallet, commitHash, prUrl, nonce)` — no partial replay |
| Frontend | Read-only access to contract state. Write access only through user's own wallet |

---

## 3. LLM Guardrails

- **Model:** Gemini Flash (Google AI Studio free tier), configurable via `GEMINI_PRIMARY_MODEL` with `GEMINI_FALLBACK_MODEL` as secondary
- **Temperature:** 0.0 (deterministic evaluation)
- **Response format:** `response_mime_type: "application/json"` with `response_schema` enforced
- **Required output fields:**
  ```json
  {
    "passed": "boolean",
    "score": "number (0-100)",
    "criteria_checklist": [
      { "requirement": "string", "met": "boolean", "reason": "string" }
    ],
    "security_issues": ["string"],
    "review_comment": "string"
  }
  ```
- **Rejection criteria:** Score < 70, any `security_issues` array not empty, any critical criteria not met
- **Prompt injection defense:** System prompt explicitly forbids executing instructions from `<untrusted_diff>` content
- **Retry policy:** Max 1 retry on malformed JSON; if second attempt fails, audit result = FAILED with reason logged

---

## 4. Dependency Policy

- **No new dependencies** without explicit justification in commit message
- Prefer established, maintained packages:
  - Viem over ethers.js (lighter, tree-shakeable, TypeScript-native)
  - Drizzle over Prisma (lighter for SQLite, no binary engine)
  - Fastify over Express (faster, schema validation built-in)
- Check for deprecation warnings before adding any package
- Pin exact versions in `package.json` (no caret/tilde for core deps)
- OpenZeppelin contracts: use `forge install` from GitHub, not npm

---

## 5. Commit Conventions

- Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`
- Scopes: `contracts`, `agent`, `web`, `docs`, `scripts`
- Examples:
  - `feat(contracts): implement createBounty with ERC-20 deposit`
  - `test(contracts): add replay attack protection tests`
  - `feat(agent): integrate Gemini Flash evaluation engine`
  - `docs: add ARCHITECTURE.md with component diagrams`
- Keep commits atomic: one logical change per commit
- Never force-push to main branch

---

## 6. Test Policy

### Smart Contract (Foundry)
- Every public function must have test coverage
- Required test scenarios:
  - Happy path (valid deposit, valid claim, valid refund)
  - Invalid signature rejection
  - Replay attack prevention (same signature reused)
  - Deadline enforcement (early cancel blocked, late cancel allowed)
  - Reentrancy protection
- Run `forge test -vvv` before every commit to `contracts/`

### Agent Backend
- Webhook signature verification: test valid + tampered payloads
- Hard Gate: test CI pass/fail status mapping
- **AI evaluator:** test with mock Gemini response (both pass and fail) — enforced by
  `test/setup.ts`, which clears `GEMINI_API_KEY` before any test module loads. The suite
  must never make a live provider call; a passing suite reflects this repo, not Google's uptime.
- **Live provider path:** `pnpm test:live` (requires `set -a && . ./.env`) exercises the real
  Gemini call including retry, fallback, and prompt-injection detection. Not part of `pnpm test`.
- **Model IDs:** no hardcoded model strings. `GEMINI_PRIMARY_MODEL` / `GEMINI_FALLBACK_MODEL`
  default to `gemini-3.1-flash-lite` / `gemini-3.6-flash`. Retired IDs (e.g. `gemini-2.0-flash`,
  `gemini-2.5-flash`) return 404 and are detected as permanent failures — never retried.
- **Provider failure must not masquerade as a verdict:** `EvaluatorUnavailableError` maps to
  HTTP 503 with `verdict: "error"` and an `audit_logs` row of `status = "error"`. No signature
  is produced. A provider 404 must never surface as a Bountra 404.
- **Verdict reuse:** a repeated audit of the same claim returns the stored verdict with
  `cached: true` and no provider call. Scope is `(bountyId, prUrl, commitHash, developer)` —
  the signature is bound to all of those, so reuse across bounties would be a replay.
  Only `status = "passed"` rows are reusable; failed and errored verdicts are always
  re-evaluated. Digests are recomputed from params, never read from the row.
- ECDSA signer: verify signature recovery matches agent address

### Frontend
- No mandatory test coverage for hackathon MVP
- Manual verification: connect wallet → create bounty → view explorer → check drawer
- **Mock and on-chain data must not share an ID namespace.** Displaying a mock
  row is fine; sending its id to the contract is not. Either offset mock ids out
  of the on-chain range (e.g. `+ 100`) or gate the row on a real on-chain bounty
  with a matching id. A mock-only row reaches the contract as
  `claimBounty(id)` and reverts with `BountyNotFound()`.
- **One convention for one data set.** The same bounty list must be merged and
  id-assigned the same way on every page. Two pages can disagree about the
  offset and one of them will send ids the contract cannot resolve.
- **Write contract ABIs from the compiler artifact, never by hand.** Two
  parameters of the same type in the wrong order produce an identical selector
  and no compile error; the frontend then sends `commitHash` where the contract
  expects `prUrl` and the call fails at signature recovery instead. When an
  argument order changes in Solidity, regenerate or re-check every caller.
- **A wallet signature is not a transaction.** A wallet that opens for signing
  proves nothing about the contract. Verify the receipt status, the emitted
  event, and the resulting state; a reverted transaction still collected a valid
  signature from the user.

### Layout
- A slide-over panel must be anchored to one edge with a fixed width, never
  `w-screen` inside an edge-anchored wrapper. A full-viewport panel offset by the
  wrapper's own padding overflows the viewport by that padding, which shifts
  visible content sideways and reads as a stacking or z-index glitch.

---

## 7. Error Handling

- **Every external API call** (GitHub, Gemini, RPC) must have:
  - Timeout: 10 seconds
  - Retry: 1 attempt with 2-second delay
  - Fallback: log error, set audit status to "error", skip (no silent failure)
- **Contract reverts** must use custom errors (not `require` strings) for gas efficiency
- **Frontend** must show user-friendly toast on transaction failure (not raw revert data)

---

## 8. What NOT to Do

- ❌ Never store private keys in code, logs, or frontend
- ❌ Never trust CI status from client-side or PR description text
- ❌ Never let LLM output bypass JSON Schema validation
- ❌ Never use `require("message")` in Solidity — use custom errors
- ❌ Never use ethers.js — use Viem exclusively
- ❌ Never deploy to mainnet during hackathon
- ❌ Never add decorative animations (confetti, parallax, 3D cards)
- ❌ Never use motivational/hype language in UI copy
