// agentry — tests for the protect-generated-dirs PreToolUse hook.
//
// Unlike the transform tests, which import a pure function, a hook is a script
// with a process contract: JSON on stdin, exit 0 to allow, exit 2 to block. So
// these tests run the real script as a child process and assert on its exit
// code. That contract is the thing Claude Code depends on; asserting anything
// less would not prove the hook works.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "hooks",
  "protect-generated-dirs.js",
);

const ALLOW = 0;
const BLOCK = 2;

/** Run the hook with `payload` on stdin and return its exit code. */
function run(payload) {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  const r = spawnSync(process.execPath, [HOOK], { input, encoding: "utf8" });
  return r.status;
}

/** Run the hook against a Write targeting `file_path` and return its exit code. */
function edit(file_path) {
  return run({ tool_name: "Write", tool_input: { file_path } });
}

/** Run the hook and return what it wrote to stderr. */
function reason(file_path) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { file_path } }),
    encoding: "utf8",
  });
  return r.stderr;
}

describe("protect-generated-dirs: blocks every generated location", () => {
  const generated = [
    ".claude/agents/debugger.md",
    ".claude/skills/tdd-workflow/SKILL.md",
    ".claude/commands/plan.md",
    ".claude/rules/python/type-safety.md",
    ".claude/hooks/block-no-verify.js",
    ".claude-plugin/plugin.json",
    ".cursor/rules/tdd-workflow.mdc",
    ".cursor/agents/agentry-debugger.md",
    ".codex/agents/skills/agentry-debugger/SKILL.md",
    // Regression: the OpenCode adapter shipped in v0.7.0 and these three wiped
    // subdirectories went unprotected until they were added here.
    ".opencode/agents/debugger.md",
    ".opencode/skills/caching/SKILL.md",
    ".opencode/commands/plan.md",
  ];

  for (const file of generated) {
    test(`blocks ${file}`, () => {
      assert.equal(edit(file), BLOCK);
    });
  }
});

describe("protect-generated-dirs: allows what is not generated", () => {
  const allowed = [
    // Source of truth — the whole point is to send the author here.
    "agents/debugger.md",
    "skills/tdd-workflow/SKILL.md",
    "commands/plan.md",
    "rules/python/type-safety.md",
    "hooks/block-no-verify.js",
    "mcp/git.json",
    "README.md",
    "scripts/sync-harnesses.js",
    // D20: sync writes these when MCP sources exist but never deletes them, and
    // they may carry the user's own configuration. A hand-edit is legitimate.
    ".mcp.json",
    "opencode.json",
    // The parent .opencode/ is not wiped — only its three generated subdirs are.
    ".opencode/some-user-state.json",
  ];

  for (const file of allowed) {
    test(`allows ${file}`, () => {
      assert.equal(edit(file), ALLOW);
    });
  }
});

describe("protect-generated-dirs: path handling", () => {
  test("normalizes Windows separators", () => {
    assert.equal(edit(".claude\\agents\\debugger.md"), BLOCK);
    assert.equal(edit(".opencode\\skills\\caching\\SKILL.md"), BLOCK);
  });

  test("blocks an absolute path into a generated directory", () => {
    assert.equal(edit("/home/u/repo/.claude/agents/debugger.md"), BLOCK);
    assert.equal(edit("D:/agentry/.opencode/agents/debugger.md"), BLOCK);
  });

  test("reads notebook_path as well as file_path", () => {
    const r = run({ tool_input: { notebook_path: ".claude/skills/x/SKILL.md" } });
    assert.equal(r, BLOCK);
  });
});

describe("protect-generated-dirs: fails open, never crashes", () => {
  // A hook that throws is a hook that blocks every tool call in the session.
  test("empty stdin allows", () => assert.equal(run(""), ALLOW));
  test("malformed JSON allows", () => assert.equal(run("not json"), ALLOW));
  test("empty object allows", () => assert.equal(run({}), ALLOW));
  test("no tool_input allows", () => assert.equal(run({ tool_name: "Write" }), ALLOW));
  test("empty tool_input allows", () => assert.equal(run({ tool_input: {} }), ALLOW));
  test("null file_path allows", () =>
    assert.equal(run({ tool_input: { file_path: null } }), ALLOW));
});

describe("protect-generated-dirs: the block message points at the source", () => {
  const cases = [
    [".claude/agents/debugger.md", "agents/"],
    [".claude/skills/x/SKILL.md", "skills/<name>/SKILL.md"],
    [".claude/commands/plan.md", "commands/"],
    [".claude/rules/python/type-safety.md", "rules/<category>/"],
    [".claude/hooks/x.js", "hooks/"],
    [".claude-plugin/plugin.json", "scripts/sync-harnesses.js (manifest)"],
    [".cursor/agents/agentry-debugger.md", "agents/"],
    [".cursor/rules/tdd-workflow.mdc", "skills/<name>/SKILL.md"],
    [".cursor/rules/python/type-safety.mdc", "rules/<category>/"],
    [".codex/agents/skills/agentry-debugger/SKILL.md", "skills/<name>/ or agents/"],
    [".opencode/agents/debugger.md", "agents/"],
    [".opencode/skills/caching/SKILL.md", "skills/<name>/SKILL.md"],
    [".opencode/commands/plan.md", "commands/"],
  ];

  for (const [file, hint] of cases) {
    test(`${file} -> ${hint}`, () => {
      const stderr = reason(file);
      assert.match(stderr, /^Blocked:/);
      assert.ok(
        stderr.includes(hint),
        `expected hint ${JSON.stringify(hint)} in: ${stderr}`,
      );
    });
  }
});
