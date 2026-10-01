import { Octokit } from "@octokit/rest";
import type { ChangedFile } from "../evaluator/security.js";

export interface ParsedGithubUrl {
  owner: string;
  repo: string;
  issueOrPrNumber: number;
}

export function parseGithubIssueOrPrUrl(url: string): ParsedGithubUrl | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(?:issues|pull)\/(\d+)/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    issueOrPrNumber: parseInt(match[3], 10)
  };
}

export interface PrData {
  owner: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  prTitle: string;
  prBody: string;
  sender: string;
  headCommitHash: string;
  changedFiles: ChangedFile[];
  diff: string;
  diffAvailable: boolean;
  ciPassed: boolean;
  ciDetails: Record<string, unknown>;
}

export type CiEvidence =
  | "check-runs"
  | "combined-status"
  | "ci-not-reported"
  | "no-ci-configured"
  | "unavailable";

export interface CiData {
  ciPassed: boolean;
  ciDetails: Record<string, unknown> & { evidence: CiEvidence };
}

export interface IssueData {
  owner: string;
  repo: string;
  issueNumber: number;
  title: string;
  body: string;
}

export class GithubAuditClient {
  private octokit: Octokit;

  constructor(token?: string, octokit?: Octokit) {
    this.octokit = octokit || new Octokit({ auth: token || process.env.GITHUB_TOKEN });
  }

  async fetchIssue(owner: string, repo: string, issueNumber: number): Promise<IssueData> {
    const res = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });
    return {
      owner,
      repo,
      issueNumber,
      title: res.data.title,
      body: res.data.body || ""
    };
  }

  async fetchPullRequest(owner: string, repo: string, prNumber: number): Promise<PrData> {
    const prRes = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    const filesRes = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    });

    const changedFiles: ChangedFile[] = filesRes.data.map((f) => ({
      filename: f.filename,
      status: f.status
    }));

    // Fetch unified diff
    let diff = "";
    let diffAvailable = false;
    try {
      const diffRes = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: { format: "diff" }
      });
      if (typeof diffRes.data === "string") {
        diff = diffRes.data;
        diffAvailable = true;
      } else {
        console.error("GitHub returned a non-string PR diff", { owner, repo, prNumber });
      }
    } catch (err) {
      console.error("Failed to fetch PR diff from GitHub", {
        owner,
        repo,
        prNumber,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    const headCommitHash = prRes.data.head.sha;
    const ci = await this.fetchCiStatus(owner, repo, headCommitHash);

    return {
      owner,
      repo,
      prNumber,
      prUrl: prRes.data.html_url,
      prTitle: prRes.data.title,
      prBody: prRes.data.body || "",
      sender: prRes.data.user?.login || "unknown",
      headCommitHash,
      changedFiles,
      diff,
      diffAvailable,
      ciPassed: ci.ciPassed,
      ciDetails: ci.ciDetails
    };
  }

  async fetchCiStatus(owner: string, repo: string, ref: string): Promise<CiData> {
    let checkRunsError: string | undefined;

    try {
      const checkRuns = await this.octokit.checks.listForRef({ owner, repo, ref });
      const totalRuns = checkRuns.data.total_count;

      if (totalRuns > 0) {
        const incompleteRuns = checkRuns.data.check_runs.filter((c) => c.status !== "completed");
        const successfulRuns = checkRuns.data.check_runs.filter(
          (c) => c.status === "completed" && c.conclusion === "success"
        ).length;

        return {
          ciPassed: incompleteRuns.length === 0 && successfulRuns === totalRuns,
          ciDetails: {
            evidence: "check-runs",
            total: totalRuns,
            successful: successfulRuns,
            ...(incompleteRuns.length > 0
              ? { incomplete: incompleteRuns.length, reason: "ci-not-reported" }
              : {}),
            checkRuns: checkRuns.data.check_runs.map((c) => ({
              name: c.name,
              status: c.status,
              conclusion: c.conclusion
            }))
          }
        };
      }
    } catch (err) {
      checkRunsError = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch GitHub check-runs", { owner, repo, ref, error: checkRunsError });
    }

    try {
      const statuses = await this.octokit.repos.getCombinedStatusForRef({ owner, repo, ref });
      const totalStatuses = statuses.data.total_count;

      if (totalStatuses === 0) {
        if (checkRunsError) {
          return {
            ciPassed: false,
            ciDetails: {
              evidence: "unavailable",
              errors: {
                checkRuns: checkRunsError,
                combinedStatus: "No combined statuses found to confirm absent CI"
              }
            }
          };
        }

        const evidence: CiEvidence = statuses.data.state === "pending" ? "ci-not-reported" : "no-ci-configured";

        return {
          ciPassed: false,
          ciDetails: {
            evidence,
            reason: evidence === "ci-not-reported" ? "CI has not reported for this commit" : "No CI is configured",
            state: statuses.data.state,
            total_count: 0
          }
        };
      }

      return {
        ciPassed: statuses.data.state === "success",
        ciDetails: {
          evidence: "combined-status",
          state: statuses.data.state,
          total_count: totalStatuses,
          ...(checkRunsError ? { checkRunsError } : {})
        }
      };
    } catch (err) {
      const combinedStatusError = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch GitHub combined status", {
        owner,
        repo,
        ref,
        error: combinedStatusError
      });
      return {
        ciPassed: false,
        ciDetails: {
          evidence: "unavailable",
          errors: {
            checkRuns: checkRunsError || null,
            combinedStatus: combinedStatusError
          }
        }
      };
    }
  }

  async postPrComment(owner: string, repo: string, prNumber: number, comment: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment
    });
  }
}
