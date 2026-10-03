# Claim Flow — Session Log & Implementation State

> [!warning] Status
> **Implemented, tested, and verified end-to-end on BSC Testnet.**
> The current agent suite reports 125 tests: 118 passed, 0 failed, and 7 skipped.
> The skips are the live-chain cases gated by `NO_CHAIN`; they are not failures.
> A connected-wallet claim has settled on-chain and its transaction was recorded
> back into the agent database.

Date: 2026-10-02
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
| 1 | Signature was never collected in any claim flow | Agent now returns the stored signature; UI fetches it, never fabricates it |
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
- A live claim must use a signature issued for the exact stored audit scope;
  the fixture signature is not a live authorization source.

**Therefore: reusing fixture signatures for real claims is not possible, and any
implementation that tried would fail on-chain.** The signature has to come from
the agent, at claim time, for that exact scope.

---

## 4. The architecture that was implemented

### 4.1 Agent: authorization endpoints

`agent/src/routes/api.ts`

- `POST /api/claim/authorize` — looks up a stored passing audit matching
  `(bountyId, prUrl, commitHash, developer)`. Returns its signature only if one
  exists, along with `rawHash` and `digest`.
- `GET /api/claim/eligible?developer=0x…` — lists bounties with a passing audit
  for that developer.

The endpoint deliberately does **not** re-run the Gemini evaluator. Quota is not
the concern; a verdict can flip between runs, which would silently revoke an
authorization the developer already holds.

### 4.2 Web: server-side proxy

`web/src/app/api/agent/[...path]/route.ts`

- Whitelists only `claim/eligible`, `claim/authorize`, `claim/confirm`,
  `bounties`, and `bounties/statuses`.
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

`BountraEscrow` recovers the EIP-191-wrapped digest produced from the raw claim
hash. Viem's `signMessage({ raw })` and `recoverMessageAddress({ message: { raw
} })` apply the same wrapper; the raw hash is only the preimage that both sides
encode identically. The first version of the test applied an extra wrapper,
which double-prefixed it and made a valid signature look forged.

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
| Agent `npx tsc --noEmit` | **PASS** |
| Agent test suite | **125 tests: 118 passed, 0 failed, 7 skipped**; the skips are `NO_CHAIN` live-chain cases |
| Foundry contract tests | **15 passed, 0 failed** |
| Claim path | **VERIFIED** — dashboard → Developer Hub → eligible audit → claim drawer |
| On-chain settlement | **VERIFIED** — receipt, `BountyClaimed`, and ERC-20 movement observed |
| Agent claim confirmation | **VERIFIED** — stored `claim_tx_hash` matched the successful transaction |

---

## 8. Design decision

### 8.1 Mock bounties are display-only, deliberately

The hybrid model has two populations, and they are intentionally not symmetrical:

- ✅ on-chain bounty + agent signature → real claim
- 🚫 mock bounty namespace → shown, badged `DEMO`, never claimable

Nothing is faked: a mock id sent to `claimBounty()` reverts with `BountyNotFound()`,
so inventing a claimable mock row could only ever produce a lie. Mocks are **displayed**
rather than hidden, but they are inert — `ClaimBountyDrawer` hard-stops on `isMock`
before any authorization call, every mock listing carries a visible `DEMO` badge, and
`/explore` counts the mock and on-chain populations separately.

If a mock claim path is added later, it must use a non-numeric namespace and a
non-contract action path.

---

## 9. Live cycle observed

- Sponsor created issue `muhammalif/bountra-demo#4` and funded a 100 mockUSDT
  bounty through the UI.
- Developer opened PR `#5` touching exactly one file, `src/slug.js`, with CI
  evidence and the required wallet reference.
- The agent evaluated the PR, produced a passing score of 95, and issued a
  signature after the bounty had been manually registered in its database.
- The developer claimed through the Dashboard Developer Hub from a different
  wallet. The receipt settled the ERC-20 transfer, and the agent's stored
  `claim_tx_hash` matched the transaction hash.

---

## 10. Next steps

- The verified on-chain claim path is complete.
- Keep the manual `POST /api/bounties` registration step explicit until a chain
  event listener exists.
- A mock claim namespace remains intentionally unimplemented; add it only if a
  separate off-chain demo flow is required.

---

## 11. Relevant current files

```text
agent/src/db/index.ts                            listDeveloperAudits helper
agent/src/routes/api.ts                          /api/claim/authorize, /api/claim/eligible
agent/src/routes/webhook.ts                      requireAgentSigningKey
agent/src/signer/index.ts                        requireAgentSigningKey
agent/test/setup.ts                              pinned signature domain
agent/test/claim-authorize.test.ts               claim authorization coverage
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
