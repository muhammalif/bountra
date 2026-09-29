# Claim Flow — Session Log & Implementation State

> [!warning] Status
> **Implemented, unit-tested, and production-built. NOT verified end-to-end.**
> `pnpm build` exits 0 with a valid `.next` and all three routes serve 200.
> No successful on-chain claim has been proven. No commit has been made for
> the work described below.

Date: 2026-09-29
Scope: five Claim Bounty audit findings + "Opsi A" hybrid bounty architecture.

---

## 1. What was asked

1. Fix five audit findings in the Claim Bounty flow.
2. Answer: can Developer Hub show **real on-chain** bounties *and* **mock**
   bounties that can be claimed?

---

## 2. The five findings, and what fixed them

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Signature was never collected in any claim flow | Agent now issues it; UI fetches it, never fabricates it |
| 2 | Validation errors were invisible | `errorMsg` moved to drawer level, so it renders in every state |
| 3 | "Open Issue on GitHub" appeared inside the claim form | Removed; claim mode renders a dedicated form |
| 4 | `ready_to_claim` never formed on-chain | Replaced with a real eligibility intersection (see §4) |
| 5 | Developer Hub mixed mock and on-chain ambiguously | Split into explicit sources with distinct namespaces |

---

## 3. Why mock signatures can never work on-chain

The contract verifies:

```solidity
bytes32 messageHash = _getMessageHash(bountyId, devWallet, commitHash, prUrl);
if (ECDSA.recover(messageHash, signature) != agentSigner) revert UnauthorizedSigner();
```

`messageHash` binds **bounty id, developer wallet, commit, PR URL, contract
address, and chain id**. A signature is valid for exactly one combination.

Consequences:

- The static signature in `web/src/components/terminal/audit-scenarios.ts` is
  bound to `bountyId: 1`, `devWallet: 0x70997970...` (an Anvil test wallet).
- It cannot authorize a different bounty, a different PR, a different commit, or
  a different developer.
- No bounty currently on BSC Testnet has a matching signature.

**Therefore: reusing fixture signatures for real claims is not possible, and any
implementation that tried would fail on-chain.** The signature has to come from
the agent, at claim time, for that exact scope.

---

## 4. The architecture that was implemented

### 4.1 Agent: authorization endpoints

`agent/src/routes/api.ts`

- `POST /api/claim/authorize` — looks up a stored passing audit matching
  `(bountyId, prUrl, commitHash, developer)`. Issues a signature only if one
  exists. Returns `signature`, `rawHash`, `digest`.
- `GET /api/claim/eligible?developer=0x…` — lists bounties with a passing audit
  for that developer.

The endpoint deliberately does **not** re-run the Gemini evaluator. Quota is not
the concern; a verdict can flip between runs, which would silently revoke an
authorization the developer already holds.

### 4.2 Web: server-side proxy

`web/src/app/api/agent/[...path]/route.ts`

- Whitelists only `claim/eligible`, `claim/authorize`, `bounties`.
- `evaluate` is intentionally **not** forwarded — running an audit is a
  server-side decision made by the webhook, not a client button.
- Keeps the agent's signing key and network location out of the browser bundle.

### 4.3 Claim drawer

`web/src/components/modals/ClaimBountyDrawer.tsx`

- Signature is `readOnly` and sourced from the agent, not editable.
- Claim button gated on:
  `isWalletActive && !isClaimPending && !isClaimConfirming && !bounty.claimed && !isAuthorizing && !!signature`
- `errorMsg` renders at drawer level, above the status switch, so it is visible
  in every branch.
- Claim mode no longer falls through to `renderOpenContent`.

### 4.4 Developer Hub: intersection, not union

`web/src/app/dashboard/page.tsx`

A claim row requires **both** facts:

- the bounty id exists in the escrow contract, **and**
- the agent has a passing audit for `(bountyId, prUrl, commitHash, connectedWallet)`

Neither alone is sufficient. On-chain state knows nothing about the audit trail;
mock data invents ids that `claimBounty()` rejects. The intersection is also
exactly the set where a usable agent signature exists.

---

## 5. Security bug found and fixed

`AGENT_PRIVATE_KEY` unset previously fell back to:

```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

That is **Anvil account #0** — published in every Foundry tutorial. A
misconfigured deployment would have produced signatures that verified against a
publicly known address.

Fixed with `requireAgentSigningKey()` in `agent/src/signer/index.ts`, which
throws instead. Wired into both `api.ts` and `webhook.ts`.

Also fixed: `if (!bountyId)` rejected **bounty 0**, a real escrow index. Guards
now use `bountyId === undefined`.

---

## 6. Test correction worth remembering

`BountraEscrow` recovers the **raw** hash with no EIP-191 prefix, and viem's
`signMessage({ raw })` also skips the prefix for a 32-byte message. The first
version of the test wrapped the raw hash in `hashMessage()` again, which
double-prefixed it and made a perfectly valid signature look forged.

Tests must mirror contract recovery exactly:

```ts
recoverMessageAddress({ message: { raw: rawHash }, signature })
```

`test/setup.ts` now pins `AGENT_PRIVATE_KEY`, `ESCROW_CONTRACT_ADDRESS` and
`CHAIN_ID` so the signature domain cannot be decided by a developer's `.env`.

---

## 7. Verification status

| Check | Result |
|-------|--------|
| Agent `tsc --noEmit` | clean |
| Web `tsc --noEmit` | clean |
| Agent test suite | **27/27 pass** (20 previous + 7 new) |
| Foundry contract tests | **15/15 pass** |
| Web production build | **PASS** — `BUILD_EXIT=0`, valid `BUILD_ID`, `/api/agent/[...path]` in route table |
| Routes served | **PASS** — `/`, `/explore`, `/dashboard` all HTTP 200 |
| Proxy allowlist | **PASS** — `claim/eligible` → 502 (agent down), `audit/evaluate` → 404 (blocked by design) |
| Agent live HTTP boot | **BLOCKED** — see §8.2 |
| Browser QA of new claim flow | not done |
| Connected-wallet claim | not done |
| On-chain claim receipt / event / ERC-20 movement | not done |

---

## 8. Blockers

### 8.1 Production build (resolved)

The first attempts stalled at `Creating an optimized production build …` for
15+ minutes. An earlier `EXIT=0` was **discarded** — `.next` held no valid
build, so that number came from the shell wrapper rather than from Next.

Cause was machine load, not the code: `load average: 251`, with Brave Browser at
80% CPU while the build received ~19%. A retry on a calmer machine completed:

```text
BUILD_EXIT=0
.next/BUILD_ID = -1SgnJ8sX5xUBBtfCjFGq
ƒ /api/agent/[...path]
/ 200   /explore 200   /dashboard 200
```

`pnpm build` in `web/` still reports `Skipping validation of types` and
`Skipping linting`, so type safety is proven separately by `tsc --noEmit`.

### 8.2 Agent cannot boot locally

```
ERR_DLOPEN_FAILED  (better-sqlite3)
```

The native binding is built for a different Node ABI than the one on PATH. The
test suite passes because it runs through a different resolution path. Endpoints
were therefore tested via Fastify `inject`, not over live HTTP.

### 8.3 Mock claim path is not implemented

The hybrid model is only half built:

- ✅ on-chain bounty + agent signature → real claim
- ❌ mock bounty namespace + local claim action

Deliberately not faked: the dashboard shows nothing rather than inventing
claimable rows. If a mock claim path is added later, it must use a non-numeric
namespace and a non-contract action path.

---

## 9. Chain state at time of writing

```
bountyCount = 5          valid ids 0..4
bounty 0: 500 tUSDT      deadline 2026-10-26   claimed=false
bounty 1: 100 tUSDT      deadline 2026-10-10   claimed=false
bounty 2: 100 tUSDT      deadline 2026-10-10   claimed=false
bounty 3: 100 tUSDT      deadline 2026-10-10   claimed=false
bounty 4: 100 tUSDT      deadline 2026-10-10   claimed=false
```

Failed claim that motivated the earlier fix:

```
tx 0x7e7b3fb8fa14d5e377689a881a8746d7a0d0a96213aad76a0c3d9c7949132b64
status reverted, gasUsed 33601, no logs
revert 0x93395f9c = BountyNotFound()
calldata: bountyId = 6 (mock id, never existed on chain)
          commitHash and prUrl were swapped
```

---

## 10. Next steps

- [ ] Get a green `pnpm build` on a less loaded machine, then `pnpm start`
- [ ] Fix the `better-sqlite3` ABI mismatch and boot the agent over real HTTP
- [ ] Verify `/api/agent/claim/eligible` through the Next proxy
- [ ] Run a real audit for a bounty owned by a wallet you control
- [ ] Claim through the connected wallet, then verify receipt, `BountyClaimed`
      event, and the actual ERC-20 balance change
- [ ] Decide on the mock claim path (namespace + local action), or drop it
- [ ] Commit only after the build and claim evidence are real

---

## 11. Files changed (uncommitted)

```text
agent/src/db/index.ts                            listDeveloperAudits helper
agent/src/routes/api.ts                          /api/claim/authorize, /api/claim/eligible
agent/src/routes/webhook.ts                      requireAgentSigningKey
agent/src/signer/index.ts                        requireAgentSigningKey
agent/test/setup.ts                              pinned signature domain
agent/test/claim-authorize.test.ts               new, 7 tests
web/src/app/api/agent/[...path]/route.ts         new server-side proxy
web/src/hooks/useClaimAuthorization.ts           new
web/src/components/modals/ClaimBountyDrawer.tsx claim form, global errors, signature gate
web/src/app/dashboard/page.tsx                   eligibility intersection
docs/RULES.md                                    claim authorization invariants
.gitignore                                       agent/data/*.db-shm, *.db-wal
```

---

## 12. Related

- [[Projects/Bountra - Master Plan]]
- `docs/RULES.md` § Claim authorization
- `docs/RULES.md` § Developer Hub claim rows
