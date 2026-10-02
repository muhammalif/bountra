# Bountra — GitHub Webhook Setup Runbook

The agent signs release authorizations for bounties. That makes
`POST /webhook/github` the most sensitive endpoint in the system: whoever can
reach it can ask the agent to sign, given a passing audit. Signature
verification is therefore the first thing the route does, before any DB write,
GitHub API call or LLM spend.

**Status:** HMAC verification is implemented, and a signed GitHub → agent →
audit → claim cycle has been observed end to end. The bounty still must be
registered in the agent database before its PR is audited; this is a manual
step because the agent has no chain event listener.

---

## 1. How verification works

| Step | Detail |
|---|---|
| Header | `x-hub-signature-256: sha256=<64 hex chars>` |
| MAC | `HMAC-SHA256(secret, raw request body)` |
| Secret | `GITHUB_WEBHOOK_SECRET` in `agent/.env` |
| Comparison | `crypto.timingSafeEqual` (constant-time) |
| Code | `agent/src/security/webhookSignature.ts` |

Two implementation details that are easy to get wrong and are the reason the
route cannot simply hash the parsed body:

1. **The digest is over the raw bytes.** Fastify's default JSON parser throws
   the original bytes away. Re-serializing the parsed object reorders keys and
   drops whitespace, so `JSON.stringify(body)` almost never reproduces what
   GitHub signed. `src/index.ts` therefore installs a `parseAs: "buffer"`
   content-type parser that keeps the bytes on the request as `rawBody`.
2. **A missing secret fails closed.** If `GITHUB_WEBHOOK_SECRET` is unset the
   route returns `503` and does nothing else. It does not fall back to accepting
   the payload, and it does not use a default secret.

### Response codes

| Code | Meaning |
|---|---|
| `503` | `GITHUB_WEBHOOK_SECRET` not set on the agent — delivery refused, nothing audited |
| `401` | `missing_signature` / `malformed_signature` / `bad_signature` / `missing_raw_body` |
| `200` + `ignored` | Valid signature, but event type or duplicate payload |
| `200` + `skipped` | No bounty registered for the issue the PR closes |
| `200` + `pending_wallet` | PR body has no `Wallet: 0x...` line |
| `200` + `rejected_ci` | Hard Gate: checks not green |
| `200` + `rejected_tampering` | Integrity Gate: test tampering detected |
| `200` + `audited` | Evaluator ran; response carries `verdict`, `score`, `signature` |

---

## 2. Register the webhook (GitHub API)

The agent's own `GITHUB_TOKEN` is used for reading issues, PRs, diffs and
check-runs and for writing the FR-7 audit comment through
`issues.createComment`. The verified setup used the `repo` and `workflow`
scopes; an equivalent fine-grained token needs the corresponding repository
read permissions plus issue/PR comment write access. Webhook administration is
separate: use a token with `admin:repo_hook` (classic PAT) or a GitHub App with
the **Webhooks** permission.

```bash
export REPO=muhammalif/bountra-demo
export HOOK_SECRET="$(openssl rand -hex 32)"
export AGENT_URL="https://<your-tunnel-host>/webhook/github"

curl -X POST "https://api.github.com/repos/$REPO/hooks" \
  -H "Authorization: Bearer $GITHUB_ADMIN_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d "{
    \"name\": \"web\",
    \"active\": true,
    \"events\": [\"pull_request\"],
    \"config\": {
      \"url\": \"$AGENT_URL\",
      \"content_type\": \"json\",
      \"secret\": \"$HOOK_SECRET\",
      \"insecure_ssl\": \"0\"
    }
  }"
```

Echo `$HOOK_SECRET` into `agent/.env` as `GITHUB_WEBHOOK_SECRET` and restart the
agent. Never commit it.

If you already created the hook, rotate by `PATCH`ing the same `config` block —
the old secret stops working immediately.

---

## 3. Expose the agent

The webhook needs a public HTTPS URL that forwards POST requests to
`/webhook/github` on port 3001. The verified setup used a Cloudflare quick
tunnel:

```bash
cd agent && pnpm dev            # listens on :3001
cloudflared tunnel --url http://localhost:3001
```

Register the resulting URL. The `trycloudflare.com` URL changes on every
`cloudflared` restart, so update the hook configuration whenever it changes.
Other tunnels are usable only if they forward POST correctly; a free
`localhost.run` tunnel that returns `503 no tunnel here` to POST cannot carry
this webhook. GitHub's "Ping" and "Redeliver" buttons only work on a
configured hook.

---

## 4. Local end-to-end test without GitHub

A laptop cannot receive GitHub deliveries, so exercise the route with a signed
local request. The signing helper is exported for exactly this:

```bash
cd agent
SECRET=$(grep GITHUB_WEBHOOK_SECRET .env | cut -d= -f2)
BODY='{"action":"opened","pull_request":{"html_url":"https://github.com/muhammalif/bountra-demo/pull/1","body":"Closes https://github.com/muhammalif/bountra-demo/issues/1\nWallet: 0xYOURWALLET","title":"t","number":1,"head":{"sha":"'"$(printf '0%.0s' {1..40})"'"}},"sender":{"login":"you"}}'
SIG=$(node -e "const c=require('crypto');process.stdout.write('sha256='+c.createHmac('sha256',process.argv[1]).update(process.argv[2]).digest('hex'))" "$SECRET" "$BODY")

curl -i -X POST http://localhost:3001/webhook/github \
  -H 'Content-Type: application/json' \
  -H 'x-github-event: pull_request' \
  -H "x-hub-signature-256: $SIG" \
  -d "$BODY"
```

Sanity checks, in order:

- Drop the `x-hub-signature-256` header → expect `401 missing_signature`
- Sign with a different secret → expect `401 bad_signature`
- Unsigned request while `GITHUB_WEBHOOK_SECRET` is unset → expect `503`
- Properly signed → expect `200` with `status: skipped` (no bounty for the issue)
  or `pending_wallet` / `audited` depending on what the PR body contains

---

## 5. What the PR must contain

The webhook extracts two things from the PR body with plain regexes. If either
is missing the delivery is acknowledged but nothing is signed.

| Requirement | Pattern |
|---|---|
| Issue link | `Closes https://github.com/<owner>/<repo>/issues/<n>` (also `Fixes` / `Resolves`) |
| Payout address | `Wallet: 0x<40 hex>` (also `payout` / `payout-address` / `address`) |

The issue URL must match a bounty already registered in the agent's database
(`POST /api/bounties`). Creating the bounty in the UI does not create this agent
row automatically. An unregistered issue yields `200 skipped` — that is the
expected answer, not a failure; register the bounty before retrying the PR.

---

## 6. Where the audit can still be reached without GitHub

The webhook is one of three entry points. The others do not require a hook and
remain available for demos and manual runs:

| Entry point | Endpoint | Notes |
|---|---|---|
| Webhook | `POST /webhook/github` | Now signature-verified |
| Manual audit | `POST /api/audit/evaluate` | Server-side CI and integrity gates; no HMAC or PR comment |
| Claim authorize | `POST /api/claim/authorize` | Re-verifies a stored audit |

The manual endpoint is useful for local evaluation, but the complete live path
uses the signed webhook so the PR comment and webhook authentication are also
exercised. Registering the bounty row is required for either path to find it.

---

## 7. Verification status

- `agent/test/webhook-gates.test.ts` — unsigned, wrong-secret, malformed and
  valid-signature cases. Run with `pnpm test` in `agent/`.
- `tsc -p tsconfig.json --noEmit` must be clean.
- A signed GitHub→agent delivery, audit, signature, connected-wallet claim, and
  on-chain settlement have been observed end to end. Reproduce the complete
  flow with the Cloudflare tunnel and the manual bounty registration step above.
