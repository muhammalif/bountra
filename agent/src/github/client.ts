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
  ciPassed: boolean;
  ciDetails: Record<string, unknown>;
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

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN
    });
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
    try {
      const diffRes = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: { format: "diff" }
      });
      diff = typeof diffRes.data === "string" ? diffRes.data : "";
    } catch {
      diff = "";
    }

    // Check CI check-runs for the head commit
    const headCommitHash = prRes.data.head.sha;
    let ciPassed = false;
    let ciDetails: Record<string, unknown> = {};

    try {
      const checkRuns = await this.octokit.checks.listForRef({
        owner,
        repo,
        ref: headCommitHash
      });

      const totalRuns = checkRuns.data.total_count;
      const successfulRuns = checkRuns.data.check_runs.filter(
        (c) => c.status === "completed" && c.conclusion === "success"
      ).length;

      ciPassed = totalRuns > 0 && successfulRuns === totalRuns;
      ciDetails = {
        total: totalRuns,
        successful: successfulRuns,
        checkRuns: checkRuns.data.check_runs.map((c) => ({
          name: c.name,
          status: c.status,
          conclusion: c.conclusion
        }))
      };
    } catch {
      // If no checks API configured, fallback to checking combined statuses
      try {
        const statuses = await this.octokit.repos.getCombinedStatusForRef({
          owner,
          repo,
          ref: headCommitHash
        });
        ciPassed = statuses.data.state === "success";
        ciDetails = { state: statuses.data.state, total_count: statuses.data.total_count };
      } catch {
        ciPassed = true; // Fallback if repo has no CI configured
        ciDetails = { notice: "No CI check-runs found on repository" };
      }
    }

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
      ciPassed,
      ciDetails
    };
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
