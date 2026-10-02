const PROTECTED_FILE_PATTERNS = [
  /^\.github\/workflows\//i,
  /^contracts\/test\//i,
  /^test\//i,
  /^tests\//i,
  /\.t\.sol$/i,
  /\.spec\.(ts|js|jsx|tsx)$/i,
  /\.test\.(ts|js|jsx|tsx)$/i,
  /^foundry\.toml$/i,
  /^hardhat\.config\./i,
  /^jest\.config\./i,
  /^vitest\.config\./i
];

export interface ChangedFile {
  filename: string;
  status: string; // 'added' | 'modified' | 'deleted' | 'renamed'
}

/**
 * Validates that PR does not tamper with test suites or CI configurations.
 */
export function checkTestTampering(
  files: ChangedFile[],
  allowTestModifications = false
): { ok: boolean; reason?: string; violations?: string[] } {
  if (allowTestModifications) {
    return { ok: true };
  }

  const violations: string[] = [];

  for (const file of files) {
    for (const pattern of PROTECTED_FILE_PATTERNS) {
      if (pattern.test(file.filename)) {
        violations.push(file.filename);
        break;
      }
    }
  }

  if (violations.length > 0) {
    return {
      ok: false,
      reason: `Unauthorized test/CI modification detected: ${violations.join(", ")}`,
      violations
    };
  }

  return { ok: true };
}

/**
 * Escapes XML-like boundaries to prevent closing tag breakout attacks in prompts.
 */
export function sanitizeUntrustedContent(input: string): string {
  if (!input) return "";
  return input
    .replace(
      /<\s*\/\s*(?:assigned_issue|specification|untrusted_pr_submission|pr_title|pr_description|untrusted_git_diff)(?=\s|\/|>)[^>]*>/gi,
      "[TAG_STRIPPED]"
    )
    .replace(
      /<\s*\/?\s*[a-zA-Z_:][a-zA-Z0-9._:-]*(?:(?:\s+\/?\s*|\/\s*)[a-zA-Z_:][a-zA-Z0-9._:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>]+))?)*\s*\/?\s*>/g,
      "[TAG_STRIPPED]"
    )
    .replace(/```/g, "'''");
}

/**
 * Encapsulates untrusted PR diff and metadata within secure XML delimiters.
 */
export function buildSandboxedPromptContext(params: {
  issueTitle: string;
  issueBody: string;
  prTitle: string;
  prBody: string;
  diff: string;
}): string {
  return `
<assigned_issue>
<title>${sanitizeUntrustedContent(params.issueTitle)}</title>
<specification>
${sanitizeUntrustedContent(params.issueBody)}
</specification>
</assigned_issue>

<untrusted_pr_submission>
<pr_title>${sanitizeUntrustedContent(params.prTitle)}</pr_title>
<pr_description>
${sanitizeUntrustedContent(params.prBody)}
</pr_description>
<untrusted_git_diff>
${sanitizeUntrustedContent(params.diff)}
</untrusted_git_diff>
</untrusted_pr_submission>
`.trim();
}
