import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { fileURLToPath } from "node:url";
import { apiRoutes } from "./routes/api.js";
import { webhookRoutes } from "./routes/webhook.js";

export function buildServer(opts = {}) {
  const app = Fastify({
    logger: false,
    ...opts
  });

  app.register(cors, {
    origin: true
  });

  app.register(apiRoutes);
  app.register(webhookRoutes);

  return app;
}

export async function start() {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "0.0.0.0";
  const app = buildServer({ logger: true });

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

