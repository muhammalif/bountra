// FR-7: the verdict comment is the only surface a developer sees on the PR, so
// the formatter is asserted directly. It takes plain data, so these need no
// GitHub client, no network, and no live PR — the failure mode this guards
// against is a malformed or misleading comment shipping to a real repository.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatVerdictComment } from "../src/github/prComment.js";

const BASE = {
  bountyId: 5,
  amount: "100 mockUSDT",
  commitHash: "a806b1bc769c32c889ec352ddfafbf4cd47138a1"
};

describe("formatVerdictComment", () => {
  it("tells the developer a signature was issued on pass", () => {
    const out = formatVerdictComment({
      ...BASE,
      verdict: "passed",
      score: 95,
      summary: "Implementation matches the acceptance criteria."
    });
    assert.match(out, /passed/);
    assert.match(out, /95\/100/);
    assert.match(out, /claim signature has been issued/i);
    assert.ok(!/No claim signature/.test(out), "passed comment must not claim a signature was withheld");
  });

  it("says no signature was issued on fail", () => {
    const out = formatVerdictComment({
      ...BASE,
      verdict: "failed",
      score: 40,
      summary: "Acceptance criteria not met."
    });
    assert.match(out, /failed/);
    assert.match(out, /40\/100/);
    assert.match(out, /No claim signature was issued/i);
  });

  it("includes the bounty id, amount and short commit", () => {
    const out = formatVerdictComment({ ...BASE, verdict: "passed", score: 80, summary: "ok" });
    assert.match(out, /Bounty #5/);
    assert.match(out, /100 mockUSDT/);
    assert.match(out, /a806b1b/);
  });

  it("renders strengths and weaknesses as bullets", () => {
    const out = formatVerdictComment({
      ...BASE,
      verdict: "failed",
      score: 55,
      summary: "Partial",
      strengths: ["Clear naming", "Focused diff"],
      weaknesses: ["Missing tests", "No error handling", "Docs stale", "Unused export"]
    });
    assert.match(out, /\*\*What worked\*\*/);
    assert.match(out, /\*\*Findings\*\*/);
    assert.match(out, /- Clear naming/);
    // Capped so a long list does not bury the verdict.
    assert.ok(!/Unused export/.test(out), "findings list should be capped at 3");
  });

  it("keeps the full commit hash in the collapsed details block", () => {
    const out = formatVerdictComment({ ...BASE, verdict: "passed", score: 90, summary: "ok" });
    assert.match(out, /<details>/);
    assert.match(out, new RegExp(BASE.commitHash));
  });

  it("omits sections that have no data instead of printing empty headings", () => {
    const out = formatVerdictComment({ ...BASE, verdict: "passed", score: 90, summary: "" });
    assert.ok(!/\*\*What worked\*\*/.test(out));
    assert.ok(!/\*\*Findings\*\*/.test(out));
  });

  it("works without an amount", () => {
    const out = formatVerdictComment({
      bountyId: 1,
      verdict: "passed",
      score: 70,
      summary: "ok",
      commitHash: "abc1234"
    });
    assert.match(out, /Bounty #1/);
    assert.ok(!/undefined/.test(out), "optional amount must not leak as 'undefined'");
    assert.ok(!/ · \n/.test(out));
  });
});
