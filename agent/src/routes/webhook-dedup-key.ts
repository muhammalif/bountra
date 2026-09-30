import * as crypto from "node:crypto";

const PULL_REQUEST_INTENT_NAMESPACE = "bountra:pull_request:intent:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isValidRepositoryName(value: unknown): value is string {
  return typeof value === "string" && /^[^/|=\s]+\/[^/|=\s]+$/.test(value);
}

function isValidAction(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value);
}

function isValidHeadSha(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function getPullRequestIdentity(pullRequest: Record<string, unknown>): string | null {
  if (typeof pullRequest.number === "number" && Number.isSafeInteger(pullRequest.number) && pullRequest.number > 0) {
    return `number:${pullRequest.number}`;
  }

  if (typeof pullRequest.id === "number" && Number.isSafeInteger(pullRequest.id) && pullRequest.id > 0) {
    return `id:${pullRequest.id}`;
  }

  return null;
}

export function buildWebhookDedupKey(event: string | undefined, body: Record<string, unknown>): string {
  const payloadHash = sha256(JSON.stringify(body));
  if (event !== "pull_request") return payloadHash;

  const repository = isRecord(body.repository) ? body.repository : null;
  const pullRequest = isRecord(body.pull_request) ? body.pull_request : null;
  const head = pullRequest && isRecord(pullRequest.head) ? pullRequest.head : null;
  const repositoryFullName = repository?.full_name;
  const action = body.action;
  const headSha = head?.sha;
  const pullRequestIdentity = pullRequest ? getPullRequestIdentity(pullRequest) : null;

  if (
    !isValidRepositoryName(repositoryFullName) ||
    !isValidAction(action) ||
    !isValidHeadSha(headSha) ||
    !pullRequestIdentity
  ) {
    return payloadHash;
  }

  const intent =
    `${PULL_REQUEST_INTENT_NAMESPACE}|repository=${repositoryFullName}|` +
    `pr=${pullRequestIdentity}|head=${headSha.toLowerCase()}|action=${action}`;
  return sha256(intent);
}
