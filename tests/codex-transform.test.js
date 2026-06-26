import { test } from "node:test";
import assert from "node:assert/strict";
import { renameSkill, agentToSkill, ruleToSkill } from "../scripts/codex-transform.js";

// --- renameSkill ----------------------------------------------------------

test("renameSkill updates the name field when present in frontmatter", () => {
  const input = "---\nname: tdd-workflow\ndescription: Test-first development.\n---\n\nBody.\n";
  const output = renameSkill(input, "agentry-tdd-workflow");
  assert.match(output, /^---\nname: agentry-tdd-workflow\n/);
});

test("renameSkill preserves the description and other frontmatter fields", () => {
  const input =
    "---\nname: tdd-workflow\ndescription: Test-first development.\nextra: keep-me\n---\n\nBody.\n";
  const output = renameSkill(input, "agentry-tdd-workflow");
  assert.match(output, /description: Test-first development\./);
  assert.match(output, /extra: keep-me/);
});

test("renameSkill preserves the body verbatim", () => {
  const input =
    "---\nname: tdd-workflow\ndescription: Test-first development.\n---\n\n# Heading\n\nParagraph.\n\n```\ncode\n```\n";
  const output = renameSkill(input, "agentry-tdd-workflow");
  assert.match(output, /# Heading\n\nParagraph\.\n\n```\ncode\n```\n$/);
});

test("renameSkill handles CRLF line endings", () => {
  const input =
    "---\r\nname: tdd-workflow\r\ndescription: Test-first development.\r\n---\r\n\r\nBody.\r\n";
  const output = renameSkill(input, "agentry-tdd-workflow");
  assert.match(output, /name: agentry-tdd-workflow/);
  assert.match(output, /description: Test-first development\./);
});

test("renameSkill returns null when source has no frontmatter", () => {
  const input = "No frontmatter here.\n";
  assert.strictEqual(renameSkill(input, "agentry-anything"), null);
});

test("renameSkill only rewrites the name field — does not touch fields whose names start with 'name'", () => {
  const input =
    "---\nname: original\ndescription: keep me.\nnamespace: also-keep\n---\n\nBody.\n";
  const output = renameSkill(input, "agentry-renamed");
  assert.match(output, /name: agentry-renamed\n/);
  assert.match(output, /namespace: also-keep/);
});

// --- agentToSkill ---------------------------------------------------------

test("agentToSkill drops the tools field", () => {
  const input =
    "---\nname: planner\ndescription: Plans implementations.\ntools: [Read, Grep]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToSkill(input, "agentry-planner");
  assert.doesNotMatch(output, /tools\s*:/);
});

test("agentToSkill drops the model field", () => {
  const input =
    "---\nname: planner\ndescription: Plans implementations.\ntools: [Read, Grep]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToSkill(input, "agentry-planner");
  assert.doesNotMatch(output, /model\s*:/);
});

test("agentToSkill sets the name field to the new prefixed value", () => {
  const input =
    "---\nname: planner\ndescription: Plans implementations.\ntools: [Read]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToSkill(input, "agentry-planner");
  assert.match(output, /^---\nname: agentry-planner\n/);
});

test("agentToSkill preserves the description verbatim", () => {
  const input =
    "---\nname: planner\ndescription: Hypothesis-driven: plans before code.\ntools: [Read]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToSkill(input, "agentry-planner");
  assert.match(output, /description: Hypothesis-driven: plans before code\./);
});

test("agentToSkill preserves the body verbatim, including code blocks and headings", () => {
  const body = "# Planner\n\n- Step one\n- Step two\n\n```\nexample code\n```\n";
  const input =
    "---\nname: planner\ndescription: Plans implementations.\ntools: [Read]\nmodel: sonnet\n---\n\n" + body;
  const output = agentToSkill(input, "agentry-planner");
  assert.ok(output.endsWith(body), "body should be preserved at end of output");
});

test("agentToSkill produces a valid SKILL.md structure (frontmatter delimiters, then body)", () => {
  const input =
    "---\nname: planner\ndescription: Plans implementations.\ntools: [Read]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToSkill(input, "agentry-planner");
  assert.match(
    output,
    /^---\nname: agentry-planner\ndescription: Plans implementations\.\n---\n\nBody\.\n$/,
  );
});

test("agentToSkill drops fields beyond name/description/tools/model too", () => {
  const input =
    "---\nname: planner\ndescription: Plans.\ntools: [Read]\nmodel: sonnet\nextra-agent-field: drop-me\n---\n\nBody.\n";
  const output = agentToSkill(input, "agentry-planner");
  assert.doesNotMatch(output, /extra-agent-field/);
});

test("agentToSkill returns null when source has no frontmatter", () => {
  const input = "No frontmatter here.\n";
  assert.strictEqual(agentToSkill(input, "agentry-anything"), null);
});

// --- ruleToSkill ----------------------------------------------------------

test("ruleToSkill keeps name and description, drops rule-specific fields like language", () => {
  const input =
    "---\nname: strict-mode\ndescription: Strict mode discipline.\nlanguage: typescript\n---\n\nBody.\n";
  const output = ruleToSkill(input, "agentry-typescript-strict-mode");
  assert.match(
    output,
    /^---\nname: agentry-typescript-strict-mode\ndescription: Strict mode discipline\.\n---\n\nBody\.\n$/,
  );
  assert.doesNotMatch(output, /language\s*:/);
});

test("ruleToSkill preserves the body verbatim", () => {
  const body = "# Heading\n\nParagraph.\n\n```\ncode\n```\n";
  const input = "---\nname: r\ndescription: d here long enough.\nlanguage: go\n---\n\n" + body;
  const output = ruleToSkill(input, "agentry-go-r");
  assert.ok(output.endsWith(body), "body should be preserved at end of output");
});

test("ruleToSkill falls back to the first heading when frontmatter has no description", () => {
  const input = "# TypeScript strict mode\n\nNo frontmatter at all.\n";
  const output = ruleToSkill(input, "agentry-typescript-strict-mode");
  assert.match(output, /description: TypeScript strict mode\n/);
  // The whole content becomes the body when there is no frontmatter.
  assert.match(output, /# TypeScript strict mode\n\nNo frontmatter at all\.\n$/);
});

test("ruleToSkill uses a generic description when there is neither frontmatter nor a heading", () => {
  const output = ruleToSkill("just prose, no heading.\n", "agentry-x-y");
  assert.match(output, /description: agentry-x-y rule\n/);
});

test("ruleToSkill never returns null (rules may be plain markdown)", () => {
  assert.notStrictEqual(ruleToSkill("anything\n", "agentry-x"), null);
});
