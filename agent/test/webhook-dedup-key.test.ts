import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import type { Octokit } from "@octokit/rest";
import { buildServer } from "../src/index.js";
import { createBountyRecord } from "../src/db/index.js";
import { GithubAuditClient } from "../src/github/client.js";
import { signGithubPayload } from "../src/security/webhookSignature.js";
import { buildWebhookDedupKey } from "../src/routes/webhook-dedup-key.js";

const SECRET = process.env.GITHUB_WEBHOOK_SECRET as string;
const HEAD_SHA = "a806b1bc" + "a".repeat(32);
const OTHER_HEAD_SHA = "b806b1bc" + "b".repeat(32);
const DEV_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function pullRequestDelivery(overrides: { action?: string; headSha?: string; prNumber?: number; updatedAt?: string; pushedAt?: string } = {}) {
  const bountyId = 970000 + Math.floor(Math.random() * 10000);
  const action = overrides.action || "synchronize";
  const headSha = overrides.headSha || HEAD_SHA;
  const prNumber = overrides.prNumber || 3;
  const updatedAt = overrides.updatedAt || "2026-09-30T10:00:00Z";
  const pushedAt = overrides.pushedAt || "2026-09-30T09:59:00Z";
  const issueUrl = `https://github.com/bountra/demo/issues/${bountyId}`;

  return {
    action,
    number: prNumber,
    repository: {
      id: 123456789,
      name: "demo",
      full_name: "bountra/demo",
      private: false,
      owner: { login: "bountra", id: 1001 },
      html_url: "https://github.com/bountra/demo",
      pushed_at: pushedAt,
      updated_at: updatedAt
    },
    pull_request: {
      id: 987654321,
      number: prNumber,
      html_url: `https://github.com/bountra/demo/pull/${prNumber}`,
      url: `https://api.github.com/repos/bountra/demo/pulls/${prNumber}`,
      title: "fix: webhook deduplication",
      body: `Closes ${issueUrl}\nWallet: ${DEV_WALLET}`,
      state: "open",
      draft: false,
      created_at: "2026-09-30T09:00:00Z",
      updated_at: updatedAt,
      user: { login: "octocat", id: 42 },
      head: {
        label: `bountra:fix/dedup-${prNumber}`,
        ref: `fix/dedup-${prNumber}`,
        sha: headSha,
        repo: { full_name: "bountra/demo" }
      },
      base: {
        label: "bountra:main",
        ref: "main",
        sha: "c".repeat(40),
        repo: { full_name: "bountra/demo" }
      }
    },
    sender: { login: "octocat", id: 42 }
  };
}

function signedWebhookRequest(body: Record<string, unknown>) {
  return {
    method: "POST" as const,
    url: "/webhook/github",
    headers: {
      "x-github-event": "pull_request",
      "x-hub-signature-256": signGithubPayload(JSON.stringify(body), SECRET)
    },
    payload: body
  };
}

function countedPassingGithubClient() {
  let pullRequestsFetched = 0;
  const octokit = {
    pulls: {
      get: async (params: { mediaType?: { format: string } }) => {
        if (params.mediaType) return { data: "diff --git a/src/fix.ts b/src/fix.ts\n+const fixed = true;" };
        pullRequestsFetched += 1;
        return {
          data: {
            head: { sha: HEAD_SHA },
            html_url: "https://github.com/bountra/demo/pull/3",
            title: "fix: webhook deduplication",
            body: "Closes issue",
            user: { login: "octocat" }
          }
        };
      },
      listFiles: async () => ({ data: [{ filename: "src/fix.ts", status: "modified" }] })
    },
    checks: {
      listForRef: async () => ({
        data: {
          total_count: 1,
          check_runs: [{ name: "test", status: "completed", conclusion: "success" }]
        }
      })
    },
    repos: {
      getCombinedStatusForRef: async () => ({ data: { state: "success", total_count: 1 } })
    },
    issues: {
      get: async () => ({ data: { title: "Issue", body: "Acceptance criteria" } }),
      createComment: async () => ({ data: {} })
    }
  } as unknown as Octokit;

  return {
    client: new GithubAuditClient("test-token", octokit),
    pullRequestsFetched: () => pullRequestsFetched
  };
}

describe("webhook deduplication keys", () => {
  it("ignores delivery metadata changes for the same pull request intent", () => {
    const first = pullRequestDelivery({ updatedAt: "2026-09-30T10:00:00Z", pushedAt: "2026-09-30T09:59:00Z" });
    const second = pullRequestDelivery({ updatedAt: "2026-09-30T10:05:00Z", pushedAt: "2026-09-30T10:04:00Z" });

    assert.equal(buildWebhookDedupKey("pull_request", first), buildWebhookDedupKey("pull_request", second));
  });

  it("distinguishes a new head commit", () => {
    const first = pullRequestDelivery({ headSha: HEAD_SHA });
    const second = pullRequestDelivery({ headSha: OTHER_HEAD_SHA });

    assert.notEqual(buildWebhookDedupKey("pull_request", first), buildWebhookDedupKey("pull_request", second));
  });

  it("distinguishes different pull request actions", () => {
    const opened = pullRequestDelivery({ action: "opened" });
    const synchronized = pullRequestDelivery({ action: "synchronize" });

    assert.notEqual(buildWebhookDedupKey("pull_request", opened), buildWebhookDedupKey("pull_request", synchronized));
  });

  it("distinguishes different pull requests in the same repository", () => {
    const first = pullRequestDelivery({ prNumber: 3 });
    const second = pullRequestDelivery({ prNumber: 4 });

    assert.notEqual(buildWebhookDedupKey("pull_request", first), buildWebhookDedupKey("pull_request", second));
  });

  it("falls back to whole-payload hashes for check_run and incomplete pull_request events", () => {
    const checkRun = {
      action: "completed",
      check_run: { id: 101, head_sha: HEAD_SHA, conclusion: "success" },
      repository: { full_name: "bountra/demo" }
    };
    const otherCheckRun = { ...checkRun, check_run: { ...checkRun.check_run, id: 102 } };
    const expected = crypto.createHash("sha256").update(JSON.stringify(checkRun)).digest("hex");
    const missingRepository = pullRequestDelivery();
    delete missingRepository.repository.full_name;
    const missingHead = pullRequestDelivery();
    delete missingHead.pull_request.head.sha;

    assert.equal(buildWebhookDedupKey("check_run", checkRun), expected);
    assert.notEqual(buildWebhookDedupKey("check_run", checkRun), buildWebhookDedupKey("check_run", otherCheckRun));
    assert.equal(buildWebhookDedupKey("pull_request", missingRepository), crypto.createHash("sha256").update(JSON.stringify(missingRepository)).digest("hex"));
    assert.equal(buildWebhookDedupKey("pull_request", missingHead), crypto.createHash("sha256").update(JSON.stringify(missingHead)).digest("hex"));
  });

  it("processes an identical synchronize intent once through the webhook route", async () => {
    const bountyId = 980000 + Math.floor(Math.random() * 10000);
    const issueUrl = `https://github.com/bountra/demo/issues/${bountyId}`;
    await createBountyRecord({
      bountyId,
      issueUrl,
      repoOwner: "bountra",
      repoName: "demo",
      issueNum: bountyId,
      creator: "0x1111111111111111111111111111111111111111",
      token: "0x2222222222222222222222222222222222222222",
      amount: "100000000000000000000",
      deadline: Math.floor(Date.now() / 1000) + 86400,
      status: "open",
      txHash: null
    });

    const countedClient = countedPassingGithubClient();
    const app = buildServer({ githubClient: countedClient.client });
    const first = pullRequestDelivery({ updatedAt: "2026-09-30T10:00:00Z", pushedAt: "2026-09-30T09:59:00Z" });
    const second = pullRequestDelivery({ updatedAt: "2026-09-30T10:05:00Z", pushedAt: "2026-09-30T10:04:00Z" });
    first.pull_request.body = `Closes ${issueUrl}\nWallet: ${DEV_WALLET}`;
    second.pull_request.body = `Closes ${issueUrl}\nWallet: ${DEV_WALLET}`;

    const firstResponse = await app.inject(signedWebhookRequest(first));
    const secondResponse = await app.inject(signedWebhookRequest(second));

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(firstResponse.json().status, "audited");
    assert.equal(secondResponse.statusCode, 200);
    assert.equal(secondResponse.json().status, "ignored");
    assert.equal(countedClient.pullRequestsFetched(), 1);
  });
});
