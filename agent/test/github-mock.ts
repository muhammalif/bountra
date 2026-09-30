import type { Octokit } from "@octokit/rest";
import { GithubAuditClient } from "../src/github/client.js";

const HEAD_SHA = "a".repeat(40);

export function createPassingGithubClient(): GithubAuditClient {
  const octokit = {
    pulls: {
      get: async (params: { mediaType?: { format: string } }) =>
        params.mediaType
          ? { data: "+const fetched = true;" }
          : {
              data: {
                head: { sha: HEAD_SHA },
                html_url: "https://github.com/bountra/demo/pull/1",
                title: "fix: test",
                body: "Resolves the issue",
                user: { login: "octocat" }
              }
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
      get: async () => ({ data: { title: "Test issue", body: "Acceptance criteria" } }),
      createComment: async () => ({ data: {} })
    }
  } as unknown as Octokit;

  return new GithubAuditClient("test-token", octokit);
}
