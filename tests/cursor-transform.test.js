import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toCursorRule,
  globsForLanguage,
  LANGUAGE_GLOBS,
} from "../scripts/cursor-transform.js";

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

// --- globs (Auto Attached rules) ------------------------------------------

test("toCursorRule with no opts behaves exactly as before (no globs)", () => {
  const input = "---\nname: foo\ndescription: bar\n---\n\nBody.\n";
  assert.strictEqual(toCursorRule(input), toCursorRule(input, {}));
  assert.doesNotMatch(toCursorRule(input), /globs/);
});

test("toCursorRule injects globs before alwaysApply when provided", () => {
  const input =
    "---\nname: strict-mode\ndescription: TS rule\nlanguage: typescript\n---\n\nBody.\n";
  const output = toCursorRule(input, { globs: "**/*.ts,**/*.tsx" });
  assert.match(
    output,
    /language: typescript\nglobs: \*\*\/\*\.ts,\*\*\/\*\.tsx\nalwaysApply: false\n---\n/,
  );
});

test("toCursorRule does not duplicate globs when already declared", () => {
  const input =
    "---\nname: foo\nglobs: **/*.go\n---\n\nBody.\n";
  const output = toCursorRule(input, { globs: "**/*.rs" });
  const occurrences = (output.match(/globs\s*:/g) || []).length;
  assert.strictEqual(occurrences, 1);
  assert.match(output, /globs: \*\*\/\*\.go/);
});

test("toCursorRule treats null globs as no globs", () => {
  const input = "---\nname: foo\n---\n\nBody.\n";
  const output = toCursorRule(input, { globs: null });
  assert.doesNotMatch(output, /globs/);
  assert.match(output, /alwaysApply: false/);
});

test("toCursorRule adds globs in the no-frontmatter case too", () => {
  const output = toCursorRule("plain body\n", { globs: "**/*.py" });
  assert.strictEqual(
    output,
    "---\nglobs: **/*.py\nalwaysApply: false\n---\n\nplain body\n",
  );
});

test("globsForLanguage maps known languages and is case-insensitive", () => {
  assert.strictEqual(globsForLanguage("typescript"), LANGUAGE_GLOBS.typescript);
  assert.strictEqual(globsForLanguage("TypeScript"), LANGUAGE_GLOBS.typescript);
  assert.strictEqual(globsForLanguage("go"), "**/*.go");
});

test("globsForLanguage returns null for unknown or missing language", () => {
  assert.strictEqual(globsForLanguage("cobol"), null);
  assert.strictEqual(globsForLanguage(undefined), null);
  assert.strictEqual(globsForLanguage(""), null);
});
