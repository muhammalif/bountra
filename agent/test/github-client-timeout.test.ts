import { test } from "node:test";
import assert from "node:assert/strict";
import type { Octokit } from "@octokit/rest";
import { GithubAuditClient } from "../src/github/client.js";

test("a hanging GitHub request times out and retries without waiting 10 seconds", async () => {
  let calls = 0;
  let aborted = false;
  const octokit = {
    issues: {
      get: async (params: { request?: { signal?: AbortSignal } }) => {
        calls += 1;
        params.request?.signal?.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise<never>(() => undefined);
      }
    }
  } as unknown as Octokit;
  const client = new GithubAuditClient("test-token", octokit, {
    requestTimeoutMs: 15,
    retryDelayMs: 0
  });

  let deadline: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    client.fetchIssue("bountra", "demo", 1).then(
      () => ({ status: "resolved" as const }),
      (error) => ({ status: "rejected" as const, error })
    ),
    new Promise<{ status: "hung" }>((resolve) => {
      deadline = setTimeout(() => resolve({ status: "hung" }), 250);
    })
  ]);
  if (deadline) clearTimeout(deadline);

  assert.equal(result.status, "rejected");
  if (result.status === "rejected") {
    assert.match(String(result.error), /GitHub issues\.get timed out after 15ms/);
  }
  assert.equal(calls, 2);
  assert.equal(aborted, true);
});
