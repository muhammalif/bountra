import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Octokit } from "@octokit/rest";
import { buildServer } from "../src/index.js";
import { createBountyRecord, getLatestAuditForBounty } from "../src/db/index.js";
import { GithubAuditClient } from "../src/github/client.js";
import { signGithubPayload } from "../src/security/webhookSignature.js";

const SECRET = process.env.GITHUB_WEBHOOK_SECRET as string;
const DEV_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const HEAD_SHA = "a".repeat(40);
const RUN = Date.now();
let bountyOffset = 0;

function nextBountyId() {
  bountyOffset += 1;
  return RUN + bountyOffset;
}

async function seedBounty(bountyId: number, issueUrl: string) {
  await createBountyRecord({
    bountyId,
    issueUrl,
    repoOwner: "bountra",
    repoName: "demo",
    issueNum: 1,
    creator: "0x1111111111111111111111111111111111111111",
    token: "0x2222222222222222222222222222222222222222",
    amount: "100000000000000000000",
    deadline: Math.floor(Date.now() / 1000) + 86400,
    status: "open",
    txHash: null
  });
}

function webhookRequest(issueUrl: string, prNumber: number, headSha = HEAD_SHA) {
  const body = {
    action: "opened",
    pull_request: {
      html_url: `https://github.com/bountra/demo/pull/${prNumber}`,
      body: `Closes ${issueUrl}\nWallet: ${DEV_WALLET}`,
      title: "fix: test gate",
      number: prNumber,
      head: { sha: headSha }
    },
    sender: { login: "octocat" }
  };

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

function ciOnlyClient(checkRuns: () => Promise<unknown>, statuses: () => Promise<unknown>) {
  const octokit = {
    checks: { listForRef: checkRuns },
    repos: { getCombinedStatusForRef: statuses }
  } as unknown as Octokit;
  return new GithubAuditClient("test-token", octokit);
}

function diffFailureClient() {
  const octokit = {
    pulls: {
      get: async (params: { mediaType?: { format: string } }) => {
        if (params.mediaType) throw new Error("diff endpoint unavailable");
        return {
          data: {
            head: { sha: HEAD_SHA },
            html_url: "https://github.com/bountra/demo/pull/1",
            title: "fix: diff failure",
            body: "Closes issue",
            user: { login: "octocat" }
          }
        };
      },
      listFiles: async () => ({ data: [{ filename: "src/index.ts", status: "modified" }] })
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

  return new GithubAuditClient("test-token", octokit);
}

function retryableFetchClient() {
  let pullRequestsFetched = 0;
  const octokit = {
    pulls: {
      get: async (params: { mediaType?: { format: string } }) => {
        if (params.mediaType) return { data: "+const fetched = true;" };
        pullRequestsFetched += 1;
        if (pullRequestsFetched === 1) throw new Error("GitHub 500");
        return {
          data: {
            head: { sha: HEAD_SHA },
            html_url: "https://github.com/bountra/demo/pull/2",
            title: "fix: retry",
            body: "Closes issue",
            user: { login: "octocat" }
          }
        };
      },
      listFiles: async () => ({ data: [{ filename: "src/index.ts", status: "modified" }] })
    },
    checks: {
      listForRef: async () => ({
        data: {
          total_count: 1,
          check_runs: [{ name: "test", status: "completed", conclusion: "failure" }]
        }
      })
    },
    repos: {
      getCombinedStatusForRef: async () => ({ data: { state: "failure", total_count: 1 } })
    },
    issues: {
      get: async () => ({ data: { title: "Issue", body: "Acceptance criteria" } }),
      createComment: async () => ({ data: {} })
    }
  } as unknown as Octokit;

  return {
    client: new GithubAuditClient("test-token", octokit),
    getPullRequestsFetched: () => pullRequestsFetched
  };
}

function unavailableClient() {
  return ciOnlyClient(
    async () => {
      throw new Error("checks unavailable");
    },
    async () => {
      throw new Error("statuses unavailable");
    }
  );
}

describe("fail-closed evidence gates", () => {
  it("rejects a webhook when the PR diff cannot be fetched", async () => {
    const bountyId = nextBountyId();
    const issueUrl = `https://github.com/bountra/demo/issues/${bountyId}`;
    await seedBounty(bountyId, issueUrl);

    const app = buildServer({ githubClient: diffFailureClient() });
    const response = await app.inject(webhookRequest(issueUrl, 1));
    const body = response.json();
    const audit = await getLatestAuditForBounty(bountyId);

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, "rejected_diff");
    assert.equal(body.signature, null);
    assert.equal(audit?.status, "failed");
    assert.equal(audit?.signature, null);
    assert.equal(JSON.parse(audit?.ciDetail || "{}").diffAvailable, false);
  });

  it("does not treat unavailable CI evidence as passed", async () => {
    const result = await unavailableClient().fetchCiStatus("bountra", "demo", HEAD_SHA);

    assert.equal(result.ciPassed, false);
    assert.equal(result.ciDetails.evidence, "unavailable");
  });

  it("passes when both CI evidence sources are genuinely empty", async () => {
    const client = ciOnlyClient(
      async () => ({ data: { total_count: 0, check_runs: [] } }),
      async () => ({ data: { state: "pending", total_count: 0 } })
    );
    const result = await client.fetchCiStatus("bountra", "demo", HEAD_SHA);

    assert.equal(result.ciPassed, true);
    assert.equal(result.ciDetails.evidence, "none");
  });

  it("leaves a failed GitHub fetch retryable for redelivery", async () => {
    const bountyId = nextBountyId();
    const issueUrl = `https://github.com/bountra/demo/issues/${bountyId}`;
    await seedBounty(bountyId, issueUrl);
    const retryable = retryableFetchClient();
    const app = buildServer({ githubClient: retryable.client });
    const request = webhookRequest(issueUrl, 2);

    const first = await app.inject(request);
    const second = await app.inject(request);

    assert.equal(first.statusCode, 502);
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().status, "rejected_ci");
    assert.equal(retryable.getPullRequestsFetched(), 2);
  });

  it("records unknown CI and does not sign a manual audit without evidence", async () => {
    const bountyId = nextBountyId();
    await seedBounty(bountyId, `https://github.com/bountra/demo/issues/${bountyId}`);
    const app = buildServer({ githubClient: unavailableClient() });

    const response = await app.inject({
      method: "POST",
      url: "/api/audit/evaluate",
      payload: {
        bountyId,
        prUrl: `https://github.com/bountra/demo/pull/${bountyId}`,
        commitHash: HEAD_SHA,
        devWallet: DEV_WALLET,
        diff: "+const fixed = true;"
      }
    });
    const body = response.json();
    const audit = await getLatestAuditForBounty(bountyId);

    assert.equal(response.statusCode, 503);
    assert.equal(body.success, false);
    assert.equal(body.verdict, "error");
    assert.equal(body.signature, null);
    assert.equal(audit?.ciStatus, "unknown");
    assert.equal(JSON.parse(audit?.ciDetail || "{}").evidence, "unavailable");
    assert.equal(audit?.signature, null);
  });
});
