// Guards for the webhook path that run BEFORE any GitHub API call. The routes
// added in C-lite (real PR fetch, Hard Gate CI, tampering check) all sit behind
// `fetchPullRequest`, so they are covered separately; what is asserted here is
// that the cheap rejections still reject — none of them may reach the network,
// spend LLM quota, or mint a signature.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "../src/index.js";
import { signGithubPayload } from "../src/security/webhookSignature.js";

const SECRET = process.env.GITHUB_WEBHOOK_SECRET as string;
const app = buildServer();

// fastify.inject serializes `payload` to JSON itself, so the bytes the server
// receives are the stringification of exactly this object — signing that same
// string is what GitHub does. Signing a pretty-printed variant would not match,
// which is the whole reason the route hashes the raw buffer instead of the
// parsed body.
function prEvent(payload: Record<string, unknown>, event = "pull_request") {
  const body = {
    action: "opened",
    pull_request: {
      html_url: "https://github.com/bountra/demo/pull/1",
      body: "Wallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      title: "fix: something",
      number: 1,
      head: { sha: "0".repeat(40) }
    },
    sender: { login: "octocat" },
    ...payload
  };
  return {
    method: "POST" as const,
    url: "/webhook/github",
    headers: {
      "x-github-event": event,
      "x-hub-signature-256": signGithubPayload(JSON.stringify(body), SECRET)
    },
    payload: body
  };
}

// An unsigned delivery, for the negative cases below.
function unsignedPrEvent(payload: Record<string, unknown>, event = "pull_request") {
  const { payload: body, ...req } = prEvent(payload, event);
  return { ...req, headers: { "x-github-event": event }, payload: body };
}

describe("Webhook pre-flight gates", () => {
  it("rejects an unsigned delivery before touching the audit path", async () => {
    const res = await app.inject(unsignedPrEvent({}));
    assert.equal(res.statusCode, 401);
    assert.match(JSON.parse(res.body).message, /missing_signature/);
  });

  it("rejects a delivery signed with the wrong secret", async () => {
    const req = prEvent({});
    const res = await app.inject({
      ...req,
      headers: {
        ...req.headers,
        "x-hub-signature-256": signGithubPayload(JSON.stringify(req.payload), "not-the-secret")
      }
    });
    assert.equal(res.statusCode, 401);
    assert.match(JSON.parse(res.body).message, /bad_signature/);
  });

  it("rejects a signature that is not the sha256= form", async () => {
    const req = prEvent({});
    const res = await app.inject({
      ...req,
      headers: { ...req.headers, "x-hub-signature-256": SECRET }
    });
    assert.equal(res.statusCode, 401);
    assert.match(JSON.parse(res.body).message, /malformed_signature/);
  });

  it("ignores events it does not handle", async () => {
    const res = await app.inject(prEvent({}, "issues"));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).status, "ignored");
  });

  it("skips when no bounty is registered for the referenced issue", async () => {
    const res = await app.inject(
      prEvent({
        pull_request: {
          html_url: "https://github.com/bountra/does-not-exist/pull/7",
          body: "Closes https://github.com/bountra/does-not-exist/issues/7\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          title: "t",
          number: 7,
          head: { sha: "1".repeat(40) }
        }
      })
    );
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "skipped");
    assert.equal(body.signature, undefined);
  });

  it("returns pending_wallet when the PR body has no payout address", async () => {
    const bountyId = 900000 + Math.floor(Math.random() * 1000);
    const create = await app.inject({
      method: "POST",
      url: "/api/bounties",
      payload: {
        bountyId,
        issueUrl: `https://github.com/bountra/demo/issues/${bountyId}`,
        repoOwner: "bountra",
        repoName: "demo",
        issueNum: bountyId,
        creator: "0x1111111111111111111111111111111111111111",
        token: "0x2222222222222222222222222222222222222222",
        amount: "100000000000000000000",
        deadline: Math.floor(Date.now() / 1000) + 86400
      }
    });
    assert.equal(create.statusCode, 201);

    const res = await app.inject(
      prEvent({
        pull_request: {
          html_url: "https://github.com/bountra/demo/pull/2",
          body: `Closes https://github.com/bountra/demo/issues/${bountyId}`,
          title: "no wallet here",
          number: 2,
          head: { sha: "2".repeat(40) }
        }
      })
    );

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "pending_wallet");
    // A missing payout address must never produce an authorization.
    assert.equal(body.signature, undefined);
  });

  it("rejects a duplicate payload instead of auditing twice", async () => {
    const payload = prEvent({
      pull_request: {
        html_url: "https://github.com/bountra/demo/pull/3",
        body: "Closes https://github.com/bountra/demo/issues/none\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        title: "dup",
        number: 3,
        head: { sha: "3".repeat(40) }
      }
    });

    const first = await app.inject(payload);
    assert.equal(first.statusCode, 200);
    assert.equal(JSON.parse(first.body).status, "skipped");

    const second = await app.inject(payload);
    assert.equal(second.statusCode, 200);
    assert.equal(JSON.parse(second.body).status, "ignored");
  });
});
