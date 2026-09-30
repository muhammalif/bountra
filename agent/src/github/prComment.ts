// FR-7 (docs/PRD.md): post the audit verdict back onto the pull request so the
// developer sees the gate result without opening Bountra. The formatter is kept
// separate from the GitHub call and takes only its inputs as arguments, so the
// text can be asserted in tests without a network client or a live PR.
import type { EvaluationResult } from "../evaluator/gemini.js";

export interface VerdictCommentInput {
  verdict: "passed" | "failed";
  score: number;
  summary: string;
  strengths?: string[];
  weaknesses?: string[];
  bountyId: number;
  amount?: string;
  commitHash: string;
}

const SIGNATURE = "🤖 Bountra AI Audit";

// Kept short on purpose: a wall of markdown on every push trains people to
// ignore the comment, which is the opposite of what the gate is for.
function bullets(items: string[], limit = 3): string {
  return items.slice(0, limit).map((item) => `- ${item}`).join("\n");
}

export function formatVerdictComment(input: VerdictCommentInput): string {
  const { verdict, score, summary, bountyId, amount, strengths, weaknesses, commitHash } = input;
  const lines: string[] = [];

  if (verdict === "passed") {
    lines.push(`${SIGNATURE} — **passed** with score **${score}/100**.`);
    lines.push("");
    lines.push("A claim signature has been issued for this commit. Submit it to claim the bounty on-chain.");
  } else {
    lines.push(`${SIGNATURE} — **failed** with score **${score}/100**.`);
    lines.push("");
    lines.push("No claim signature was issued. Fix the findings below and push again.");
  }

  lines.push("");
  lines.push(`Bounty #${bountyId}${amount ? ` · ${amount}` : ""} · commit \`${commitHash.slice(0, 7)}\``);

  if (summary) {
    lines.push("");
    lines.push(summary);
  }

  if (strengths?.length) {
    lines.push("");
    lines.push("**What worked**");
    lines.push(bullets(strengths));
  }

  if (weaknesses?.length) {
    lines.push("");
    lines.push("**Findings**");
    lines.push(bullets(weaknesses));
  }

  lines.push("");
  lines.push("<details><summary>Audit details</summary>");
  lines.push("");
  lines.push(`- Verdict: \`${verdict}\``);
  lines.push(`- Score: \`${score}/100\``);
  lines.push(`- Full commit: \`${commitHash}\``);
  lines.push("");
  lines.push("_Automated by Bountra. This comment is posted by a bot._");
  lines.push("");
  lines.push("</details>");

  return lines.join("\n");
}
