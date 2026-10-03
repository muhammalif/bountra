#!/usr/bin/env bash
# Phase 1 smoke test — Bountra.
# Reads secrets from agent/.env; never prints them.
#   1. Is GEMINI_API_KEY a live key, or does it fall through to mockEvaluatePr()?
#   2. Does GITHUB_TOKEN have the scopes the manual audit route now needs?
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

set -a; . ./.env; set +a

fail=0

echo "== 1. GEMINI_API_KEY live check =="
KEY="${GEMINI_API_KEY:-}"
MODEL="${GEMINI_PRIMARY_MODEL:-gemini-3.1-flash-lite}"
if [ -z "$KEY" ]; then
  echo "FAIL  GEMINI_API_KEY is empty — /api/audit/evaluate would sign via mockEvaluatePr()"
  fail=1
else
  resp=$(curl -sS -m 30 -w '\n%{http_code}' \
    "https://generativelanguage.googleapis.com/v1beta/models/$MODEL:generateContent" \
    -H "x-goog-api-key: $KEY" -H 'content-type: application/json' \
    -d '{"contents":[{"parts":[{"text":"reply with the single word: pong"}]}],"generationConfig":{"maxOutputTokens":8}}' 2>&1)
  body=$(printf '%s' "$resp" | sed '$d'); code=$(printf '%s' "$resp" | tail -1)
  if [ "$code" = "200" ]; then
    echo "PASS  key accepted by generativelanguage API (HTTP 200, model reachable)"
    echo "      reply: $(printf '%s' "$body" | python3 -c 'import sys,json
try: print(json.load(sys.stdin)["candidates"][0]["content"]["parts"][0]["text"].strip()[:40])
except Exception: print("(unparsed)")' 2>/dev/null)"
  else
    echo "FAIL  HTTP $code — key rejected or quota/auth problem"
    echo "      $(printf '%s' "$body" | head -c 300)"
    fail=1
  fi
fi

echo
echo "== 2. GITHUB_TOKEN scopes =="
TOK="${GITHUB_TOKEN:-}"
if [ -z "$TOK" ]; then
  echo "FAIL  GITHUB_TOKEN is empty"
  fail=1
else
  hdr=$(curl -sS -m 20 -D - -o /dev/null \
    -H "Authorization: Bearer $TOK" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/user 2>&1)
  sc=$(printf '%s' "$hdr" | tr -d '\r' | grep -i '^x-oauth-scopes:' | cut -d: -f2- | sed 's/^ *//')
  if printf '%s' "$hdr" | grep -q '^HTTP/.* 200'; then
    echo "PASS  token authenticates as a user"
    echo "      scopes:${sc:- <none — fine-grained PAT>}"
    case "$sc" in
      ""|*"repo"*) echo "      OK   issue/PR comment write should work (repo scope or fine-grained)" ;;
      *) echo "WARN  'repo' scope not visible; comment writes may 403 (T6-N12)" ;;
    esac
  else
    echo "FAIL  token rejected (HTTP $(printf '%s' "$hdr" | tr -d '\r' | grep -o '^HTTP/.* [0-9]*' | tail -1 | grep -o '[0-9]*$'))"
    fail=1
  fi
fi

echo
[ "$fail" -eq 0 ] && echo "RESULT: all checks passed" || echo "RESULT: at least one check failed"
exit "$fail"