import { test } from "node:test";
import assert from "node:assert/strict";
import { toCursorRule } from "../scripts/cursor-transform.js";

test("toCursorRule wraps content with no frontmatter in a new frontmatter block", () => {
  const input = "just a body, no frontmatter at all\n";
  const output = toCursorRule(input);
  assert.strictEqual(
    output,
    "---\nalwaysApply: false\n---\n\njust a body, no frontmatter at all\n",
  );
});

test("toCursorRule appends alwaysApply: false to frontmatter that lacks it", () => {
  const input =
    "---\nname: tone-check\ndescription: example skill\n---\n\nBody text.\n";
  const output = toCursorRule(input);
  assert.strictEqual(
    output,
    "---\nname: tone-check\ndescription: example skill\nalwaysApply: false\n---\n\nBody text.\n",
  );
});

test("toCursorRule leaves frontmatter unchanged when alwaysApply: true is already declared", () => {
  const input = "---\nname: tone-check\nalwaysApply: true\n---\n\nBody.\n";
  const output = toCursorRule(input);
  assert.strictEqual(
    output,
    "---\nname: tone-check\nalwaysApply: true\n---\n\nBody.\n",
  );
});

test("toCursorRule does not add a duplicate when alwaysApply: false is already declared", () => {
  const input = "---\nname: tone-check\nalwaysApply: false\n---\n\nBody.\n";
  const output = toCursorRule(input);
  const occurrences = (output.match(/alwaysApply\s*:/g) || []).length;
  assert.strictEqual(occurrences, 1);
});

test("toCursorRule detects alwaysApply even with leading whitespace", () => {
  // The detector uses /^\s*alwaysApply\s*:/m so indented declarations still match.
  const input = "---\nname: foo\n  alwaysApply: false\n---\n\nBody.\n";
  const output = toCursorRule(input);
  const occurrences = (output.match(/alwaysApply\s*:/g) || []).length;
  assert.strictEqual(occurrences, 1);
});

test("toCursorRule inserts blank line between closing --- and body when source has none", () => {
  const input = "---\nname: foo\n---\nBody on next line.\n";
  const output = toCursorRule(input);
  assert.strictEqual(
    output,
    "---\nname: foo\nalwaysApply: false\n---\n\nBody on next line.\n",
  );
});

test("toCursorRule preserves existing blank line between closing --- and body", () => {
  const input = "---\nname: foo\n---\n\nBody after blank.\n";
  const output = toCursorRule(input);
  assert.strictEqual(
    output,
    "---\nname: foo\nalwaysApply: false\n---\n\nBody after blank.\n",
  );
});

test("toCursorRule normalizes spacing — with-blank-line and no-blank-line sources produce identical output", () => {
  const a = toCursorRule("---\nname: foo\n---\nBody.\n");
  const b = toCursorRule("---\nname: foo\n---\n\nBody.\n");
  assert.strictEqual(a, b);
});

test("toCursorRule preserves additional frontmatter fields verbatim", () => {
  const input =
    "---\nname: tone-check\ndescription: example\ntags: [docs, tone]\n---\n\nBody.\n";
  const output = toCursorRule(input);
  assert.match(output, /^---\nname: tone-check\ndescription: example\ntags: \[docs, tone\]\nalwaysApply: false\n---\n/);
});
