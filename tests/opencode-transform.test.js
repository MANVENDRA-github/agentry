import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentToOpenCodeAgent,
  commandToOpenCode,
} from "../scripts/opencode-transform.js";

// --- agentToOpenCodeAgent --------------------------------------------------

test("agentToOpenCodeAgent sets mode: subagent and keeps description", () => {
  const input =
    "---\nname: code-reviewer\ndescription: Reviews code.\ntools: [Read, Grep]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToOpenCodeAgent(input);
  assert.match(
    output,
    /^---\ndescription: Reviews code\.\nmode: subagent\n---\n\nBody\.\n$/,
  );
});

test("agentToOpenCodeAgent drops name, tools, and model", () => {
  const input =
    "---\nname: code-reviewer\ndescription: Reviews code.\ntools: [Read, Grep]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToOpenCodeAgent(input);
  assert.doesNotMatch(output, /^name\s*:/m);
  assert.doesNotMatch(output, /tools\s*:/);
  assert.doesNotMatch(output, /model\s*:/);
});

test("agentToOpenCodeAgent preserves the body verbatim, including code blocks", () => {
  const body = "# Reviewer\n\n- one\n- two\n\n```\ncode\n```\n";
  const input =
    "---\nname: r\ndescription: d.\ntools: [Read]\nmodel: sonnet\n---\n\n" + body;
  const output = agentToOpenCodeAgent(input);
  assert.ok(output.endsWith(body), "body should be preserved at end of output");
});

test("agentToOpenCodeAgent preserves a description containing a colon", () => {
  const input =
    "---\nname: r\ndescription: Reviews code: correctness and security.\ntools: [Read]\nmodel: sonnet\n---\n\nBody.\n";
  const output = agentToOpenCodeAgent(input);
  assert.match(output, /description: Reviews code: correctness and security\./);
});

test("agentToOpenCodeAgent returns null when source has no frontmatter", () => {
  assert.strictEqual(agentToOpenCodeAgent("No frontmatter.\n"), null);
});

// --- commandToOpenCode -----------------------------------------------------

test("commandToOpenCode keeps description and drops argument-hint", () => {
  const input =
    "---\ndescription: Run a review.\nargument-hint: [file | diff]\n---\n\nInvoke the `code-reviewer` agent: $ARGUMENTS\n";
  const output = commandToOpenCode(input);
  assert.match(
    output,
    /^---\ndescription: Run a review\.\n---\n\nInvoke the `code-reviewer` agent: \$ARGUMENTS\n$/,
  );
  assert.doesNotMatch(output, /argument-hint/);
});

test("commandToOpenCode preserves the $ARGUMENTS placeholder in the body", () => {
  const input =
    "---\ndescription: d.\nargument-hint: [x]\n---\n\nDo the thing with $ARGUMENTS now.\n";
  const output = commandToOpenCode(input);
  assert.match(output, /\$ARGUMENTS/);
});

test("commandToOpenCode returns null when source has no frontmatter", () => {
  assert.strictEqual(commandToOpenCode("No frontmatter.\n"), null);
});
