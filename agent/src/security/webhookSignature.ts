// HMAC-SHA256 verification for GitHub webhook deliveries.
//
// docs/RULES.md §1 requires every webhook payload to be verified via
// `x-hub-signature-256`. Until now nothing in this file existed and the route
// trusted whatever POST body arrived: anyone who could reach the agent's port
// could have it sign a release authorization for a bounty they never solved.
//
// Two things make the naive implementation wrong:
//
//   1. The digest must be computed over the RAW request body. Fastify parses
//      JSON into an object; re-serializing it reorders keys, drops whitespace
//      and mangles escapes, so `JSON.stringify(body)` almost never reproduces
//      the bytes GitHub signed. The route therefore requires `rawBody` to be
//      attached by the JSON parser registered in src/index.ts.
//   2. The comparison must be constant-time. `===` on a hex string leaks
//      prefix bytes to a patient attacker through timing.
import * as crypto from "node:crypto";

const PREFIX = "sha256=";

export type SignatureResult =
  | { ok: true }
  | { ok: false; reason: "no_secret_configured" | "missing_signature" | "malformed_signature" | "bad_signature" | "missing_raw_body" };

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // timingSafeEqual throws on length mismatch. Still burn a comparison so
    // the rejection path does not stand out by timing alone.
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/**
 * Verifies one delivery.
 *
 * `secret` is passed in rather than read from process.env so the caller decides
 * the fail-closed policy and tests can pin their own value.
 */
export function verifyGithubSignature(args: {
  signature: string | undefined;
  rawBody: Buffer | string | undefined;
  secret: string | undefined;
}): SignatureResult {
  const { signature, rawBody, secret } = args;

  // Fail closed. An agent that cannot authenticate the sender must not fall
  // back to accepting the payload, and it must not fall back to a hardcoded
  // secret either.
  if (!secret || secret.trim() === "") {
    return { ok: false, reason: "no_secret_configured" };
  }
  if (!signature) {
    return { ok: false, reason: "missing_signature" };
  }
  if (!signature.startsWith(PREFIX)) {
    return { ok: false, reason: "malformed_signature" };
  }
  if (rawBody === undefined) {
    return { ok: false, reason: "missing_raw_body" };
  }

  const provided = signature.slice(PREFIX.length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    return { ok: false, reason: "malformed_signature" };
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

  return timingSafeEqualHex(expected, provided) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** Builds the header value GitHub would send for `body`. Used by tests and by the redelivery script. */
export function signGithubPayload(body: Buffer | string, secret: string): string {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return PREFIX + crypto.createHmac("sha256", secret).update(buf).digest("hex");
}
