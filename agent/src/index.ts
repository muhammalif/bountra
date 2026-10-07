// dotenv does NOT overwrite a variable that already exists, so a stale
// GITHUB_TOKEN inherited from the parent shell used to win over .env and the
// agent answered every call with 401 Bad credentials while .env held a working
// token. Reads masked it: bountra-demo is public, so unauthenticated GETs
// succeed and only writes (PR comments, FR-7) failed.
//
// Do NOT switch to dotenv.config({ override: true }): that clobbers every other
// variable in .env, including the AGENT_PRIVATE_KEY, ESCROW_CONTRACT_ADDRESS and
// DATABASE_PATH that test/setup.ts pins. It made the signature tests fail with
// 409 because the test signature no longer recovered to the pinned signer.
import "dotenv/config";
import { config as loadEnv } from "dotenv";

// This must be a statement, not a module-level side effect written above the
// import. ESM hoists every import above all other statements, so
// `delete process.env.X` placed before `import "dotenv/config"` actually runs
// AFTER dotenv and removes the value dotenv just loaded — which is why the
// agent ran with NO token at all and 401'd every write.
//
// The delete and the re-load have to be adjacent statements below the import:
// delete drops the stale inherited value, then loadEnv sees the key as unset
// and repopulates it from the file. `override: true` is deliberately not used.
delete process.env.GITHUB_TOKEN;
loadEnv({ path: ".env" });

import Fastify, { type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { fileURLToPath } from "node:url";
import { GithubAuditClient } from "./github/client.js";
import type { BountyReader } from "./chain/readBounty.js";
import { reconcileBounties, formatReconcileReport } from "./chain/reconcile.js";
import { createBountyReader, createBountyCountReader } from "./chain/readBounty.js";
import { apiRoutes } from "./routes/api.js";
import { webhookRoutes } from "./routes/webhook.js";

/**
 * Origins allowed to call the agent from a browser.
 *
 * The agent holds AGENT_PRIVATE_KEY and will sign a release authorization for
 * any bounty that passes an audit, so `origin: true` (reflect whatever the
 * caller sends) would let any page on the internet ask it to sign. Only the
 * deployed web frontends and local development get through.
 *
 * The webhook is exempt: GitHub's servers post without an Origin header, and
 * they are authenticated separately by payload signature.
 *
 * ALLOWED_ORIGINS is a comma-separated list. Leaving it unset falls back to
 * localhost only rather than to a wildcard, so a misconfigured deploy fails
 * closed instead of opening the signer to the internet.
 */
function allowedOrigins(): string[] | true {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ];

  const list = [...new Set([...defaults, ...configured])];
  return list;
}

function validateRequiredEnv() {
  if (process.env.NODE_ENV === "test") return;

  const required = ["AGENT_PRIVATE_KEY", "ESCROW_CONTRACT_ADDRESS", "CHAIN_ID"] as const;
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length) {
    for (const name of missing) {
      console.error(`Missing required environment variable: ${name}`);
    }
    process.exit(1);
  }
}

export interface BuildServerOptions extends FastifyServerOptions {
  githubClient?: GithubAuditClient;
  bountyReader?: BountyReader;
}

export function buildServer(opts: BuildServerOptions = {}) {
  const { githubClient, bountyReader, ...fastifyOptions } = opts;
  const app = Fastify({
    logger: false,
    ...fastifyOptions
  });

  app.register(cors, { origin: allowedOrigins() });

  // The webhook HMAC is computed over the bytes GitHub sent, not over the
  // parsed object: JSON re-serialization reorders keys and drops whitespace, so
  // a digest built from the parsed body almost never matches. Fastify's default
  // JSON parser discards those bytes, so keep them on the request as
  // `rawBody` and let the webhook route verify against that.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function jsonWithRawBody(req, payload, done) {
      const raw = payload as Buffer;
      try {
        const parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
        (req as { rawBody?: Buffer }).rawBody = raw;
        done(null, parsed);
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        e.statusCode = 400;
        done(e, undefined);
      }
    }
  );

  app.register(apiRoutes, { githubClient, bountyReader });
  app.register(webhookRoutes, { githubClient });

  /**
   * Repair the bounty table at boot.
   *
   * The DB is filled in by `POST /api/bounties`, one caller at a time, so a
   * bounty funded outside the web UI has no row and a bounty claimed from a
   * browser keeps a stale status. Both leave the feed describing escrow state
   * the contract contradicts. Reconciling here means the first request after a
   * restart already reads accurate rows, without anyone having to remember to
   * trigger it.
   *
   * Skipped under NODE_ENV=test. Tests build a server per file against a
   * throwaway database and a fake escrow address; reconciling would dial the
   * real public RPC on every one of them, and would then write chain rows into
   * a database whose contents those tests are asserting on. `POST
   * /api/bounties/reconcile` still works there, and `test/bounty-reconcile.test.ts`
   * drives the reconciler directly.
   *
   * In production, failure is logged and swallowed: an unreachable RPC must not
   * keep the agent from serving, since the webhook and audit paths work off the
   * DB alone.
   */
  if (process.env.NODE_ENV !== "test") {
    app.addHook("onReady", async () => {
      const reader =
        bountyReader ||
        createBountyReader({
          escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS,
          rpcUrl: process.env.BSC_TESTNET_RPC_URL
        });
      const countReader = createBountyCountReader({
        escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS,
        rpcUrl: process.env.BSC_TESTNET_RPC_URL
      });

      try {
        const result = await reconcileBounties(reader, countReader);
        const { report } = result;
        if (report.inserted.length || report.statusCorrected.length || report.unresolvableIssueUrls.length) {
          app.log.info(
            { reconcile: report },
            `chain→db reconciliation at boot: ${formatReconcileReport(result)}`
          );
        }
      } catch (err) {
        app.log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "chain→db reconciliation skipped; DB may not match the escrow contract"
        );
      }
    });
  }

  return app;
}

export async function start() {
  validateRequiredEnv();

  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "0.0.0.0";
  const app = buildServer({ logger: true });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Received ${signal}; shutting down gracefully.`);
    const forceExit = setTimeout(() => {
      console.error("Graceful shutdown timed out after 10 seconds; forcing exit.");
      process.exit(1);
    }, 10_000);

    try {
      await app.close();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExit);
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen({ port, host });
    console.log(`⚡ Bountra Agent listening on http://${host}:${port}`);
    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Auto-start only when run directly as main script
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  start();
}
