import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontmatter,
  checkRequired,
  checkDescription,
} from "../scripts/frontmatter.js";

// --- parseFrontmatter ------------------------------------------------------

test("parseFrontmatter returns null when no frontmatter present", () => {
  assert.strictEqual(parseFrontmatter("just a body, no frontmatter\n"), null);
});

test("parseFrontmatter returns null when opening --- has no closing ---", () => {
  assert.strictEqual(parseFrontmatter("---\nname: foo\nno closing\n"), null);
});

test("parseFrontmatter parses simple key: value pairs", () => {
  const result = parseFrontmatter("---\nname: foo\ndescription: bar\n---\n\nbody\n");
  assert.deepStrictEqual(result.fields, { name: "foo", description: "bar" });
});

test("parseFrontmatter handles CRLF line endings", () => {
  const result = parseFrontmatter("---\r\nname: foo\r\ndescription: bar\r\n---\r\n\r\nbody\r\n");
  assert.deepStrictEqual(result.fields, { name: "foo", description: "bar" });
});

test("parseFrontmatter returns body separately, preserving leading blank line", () => {
  const result = parseFrontmatter("---\nname: foo\n---\n\nbody line one\nbody line two\n");
  assert.strictEqual(result.body, "\nbody line one\nbody line two\n");
});

test("parseFrontmatter returns body without leading newline when source had no blank line", () => {
  const result = parseFrontmatter("---\nname: foo\n---\nbody\n");
  assert.strictEqual(result.body, "body\n");
});

test("parseFrontmatter returns empty body when content ends at closing ---", () => {
  const result = parseFrontmatter("---\nname: foo\n---");
  assert.strictEqual(result.body, "");
});

test("parseFrontmatter returns raw inner text without --- delimiters", () => {
  const result = parseFrontmatter("---\nname: foo\ndescription: bar\n---\nbody");
  assert.strictEqual(result.raw, "name: foo\ndescription: bar");
});

test("parseFrontmatter keeps array-shaped values as literal strings", () => {
  const result = parseFrontmatter("---\ntools: [Read, Grep, Bash]\n---\n");
  assert.strictEqual(result.fields.tools, "[Read, Grep, Bash]");
});

test("parseFrontmatter skips lines that aren't valid key: value pairs", () => {
  const result = parseFrontmatter(
    "---\nname: foo\nnot a kv pair\ndescription: bar\n---\n",
  );
  assert.deepStrictEqual(result.fields, { name: "foo", description: "bar" });
});

test("parseFrontmatter trims whitespace around values", () => {
  const result = parseFrontmatter("---\nname:    foo   \n---\n");
  assert.strictEqual(result.fields.name, "foo");
});

test("parseFrontmatter handles blank lines inside the frontmatter block", () => {
  const result = parseFrontmatter("---\nname: foo\n\ndescription: bar\n---\n");
  assert.deepStrictEqual(result.fields, { name: "foo", description: "bar" });
});

test("parseFrontmatter handles a description value containing a colon", () => {
  const content = "---\nname: foo\ndescription: Test-first: red-green-refactor\n---\n\nbody";
  const result = parseFrontmatter(content);
  assert.strictEqual(result.fields.description, "Test-first: red-green-refactor");
});

// --- checkRequired ---------------------------------------------------------

test("checkRequired returns empty array when all required keys are present", () => {
  const missing = checkRequired(
    { name: "foo", description: "bar" },
    ["name", "description"],
  );
  assert.deepStrictEqual(missing, []);
});

test("checkRequired returns missing keys when absent", () => {
  const missing = checkRequired({ name: "foo" }, ["name", "description"]);
  assert.deepStrictEqual(missing, ["description"]);
});

test("checkRequired reports keys present but empty as missing", () => {
  const missing = checkRequired(
    { name: "foo", description: "" },
    ["name", "description"],
  );
  assert.deepStrictEqual(missing, ["description"]);
});

test("checkRequired preserves the order of requiredKeys in the output", () => {
  const missing = checkRequired({}, ["b", "a", "c"]);
  assert.deepStrictEqual(missing, ["b", "a", "c"]);
});

test("checkRequired ignores extra fields not in requiredKeys", () => {
  const missing = checkRequired(
    { name: "foo", description: "bar", extra: "ok" },
    ["name", "description"],
  );
  assert.deepStrictEqual(missing, []);
});

// --- checkDescription ------------------------------------------------------

test("checkDescription returns null for descriptions >= 20 chars", () => {
  assert.strictEqual(checkDescription("this description is long enough"), null);
});

test("checkDescription returns null at exactly the minimum length", () => {
  assert.strictEqual(checkDescription("a".repeat(20)), null);
});

test("checkDescription returns 'too short' error for descriptions shorter than 20 chars", () => {
  const result = checkDescription("too short");
  assert.match(result, /too short/);
});

test("checkDescription returns 'missing or empty' for undefined", () => {
  assert.strictEqual(checkDescription(undefined), "missing or empty");
});

test("checkDescription returns 'missing or empty' for empty string", () => {
  assert.strictEqual(checkDescription(""), "missing or empty");
});

test("checkDescription respects custom minLength parameter", () => {
  assert.strictEqual(checkDescription("five!", 5), null);
  assert.match(checkDescription("four", 5), /too short/);
});
