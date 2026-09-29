import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy to the Bountra Agent API.
 *
 * The agent holds the signing key and the audit trail, so it must not be called
 * from the browser: NEXT_PUBLIC_* is baked into the client bundle at build time
 * and would leak the agent's network location to anyone loading the page. Routing
 * through Next also keeps the agent URL out of the client entirely.
 *
 * Only the read/authorize paths the UI needs are exposed. `evaluate` is NOT
 * forwarded on purpose — running an audit is a server-side decision made by the
 * webhook, not something a client button can trigger.
 */
const ALLOWED = new Set([
  "claim/eligible",
  "claim/authorize",
  "claim/confirm",
  "bounties",
  "bounties/statuses"
]);

function agentBase(): string {
  const url = process.env.NEXT_PUBLIC_AGENT_API_URL || process.env.AGENT_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_AGENT_API_URL is not configured");
  return url.replace(/\/+$/, "");
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const joined = path.join("/");
  if (!ALLOWED.has(joined)) {
    return NextResponse.json({ error: `Path not allowed: /${joined}` }, { status: 404 });
  }

  const base = agentBase();
  const method = request.method;
  const search = method === "GET" ? `?${request.nextUrl.searchParams.toString()}` : "";

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
  }

  try {
    const upstream = await fetch(`${base}/api/${joined}${search}`, {
      method,
      body,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });

    const text = await upstream.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: "Agent returned a non-JSON response", detail: text.slice(0, 200) };
    }

    return NextResponse.json(parsed, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Agent API unreachable", detail: (err as Error).message },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}
