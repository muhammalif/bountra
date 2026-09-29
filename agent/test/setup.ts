// Loaded before any test module. Forces the offline path so `pnpm test` never
// touches the network or the developer's real GEMINI_API_KEY.
//
// docs/RULES.md §6 requires the AI evaluator to be tested against a mock
// response; §7 requires external calls to be resilient. Before this file,
// `import "dotenv/config"` in src/index.ts pulled the developer's real key in
// and the suite silently made live Gemini calls — one test failed whenever
// Google returned 503, and passed only by accident when the key was absent.
process.env.GEMINI_API_KEY = "";
delete process.env.GEMINI_PRIMARY_MODEL;
delete process.env.GEMINI_FALLBACK_MODEL;

// The signing key and the escrow address are part of the signature domain. Tests
// must pin both, or a developer's real .env (or its absence) decides whether a
// signature recovers to the address the contract trusts. Anvil account #1 is
// used because it is the standard throwaway key; nothing in these tests
// touches a funded account.

import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.AGENT_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
process.env.ESCROW_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000001";
process.env.CHAIN_ID = "97";

// src/db/index.ts defaults to ./data/bountra.db. Without this, every `pnpm test`
// run opened the developer's real database and left rows behind, so the dev
// database accumulated ~100 fake audits and /api/claim/eligible answered with
// them. Tests get a file that is wiped on boot and removed on exit.
const TEST_DB = path.join(os.tmpdir(), `bountra-test-${process.pid}.db`);
process.env.DATABASE_PATH = TEST_DB;
for (const suffix of ["", "-shm", "-wal"]) {
  try {
    rmSync(TEST_DB + suffix, { force: true });
  } catch {
    /* first run: nothing to remove */
  }
}
process.on("exit", () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* best effort */
    }
  }
});
