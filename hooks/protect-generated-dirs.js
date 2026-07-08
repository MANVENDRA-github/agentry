#!/usr/bin/env node
// agentry — PreToolUse hook: protect generated harness directories.
//
// agentry's cardinal rule is "never edit the generated directories — they are
// wiped and rewritten on every sync." This hook enforces that rule at the tool
// layer: it blocks Write/Edit-class tool calls whose target path lives inside a
// generated directory (.claude/agents|skills|commands|rules|hooks/,
// .claude-plugin/, .cursor/agents|rules/, .codex/agents/skills/,
// .opencode/agents|skills|commands/), and points the author back at the source
// file under agents/, skills/, commands/, or rules/.
//
// The list names the wiped subdirectories exactly, never a parent harness
// directory, so the guard and the sync engine agree on what "generated" means.
// It therefore does NOT block what each harness keeps as per-user state at that
// top level — `.claude/settings.local.json`, `.cursor/environment.json`,
// `.codex/config.toml` — nor the three MCP config files (`.mcp.json`,
// `.cursor/mcp.json`, `opencode.json`), which sync writes when MCP sources exist
// but never deletes (D20). Sync preserves all of these, so a hand-edit is
// legitimate and must not be refused.
//
// This is agentry's pattern-proof hook — it demonstrates the hooks pipeline the
// same way rules/typescript/strict-mode.md demonstrates the rules pipeline.
//
// Wiring (Claude Code): reference it from settings.json as a PreToolUse hook,
// e.g.
//   {
//     "hooks": {
//       "PreToolUse": [
//         { "matcher": "Write|Edit|MultiEdit",
//           "hooks": [ { "type": "command",
//                        "command": "node ~/.claude/hooks/protect-generated-dirs.js" } ] }
//       ]
//     }
//   }
//
// Contract: Claude Code passes the tool call as JSON on stdin. Exit 0 to allow;
// exit 2 to block, with the reason written to stderr (surfaced back to Claude).

import { stdin } from "node:process";

// Path fragments that identify a generated, never-hand-edit location. The
// .opencode/ entries name the three wiped subdirectories rather than the parent,
// because syncOpenCode() only removes those (the "wipe what you own" rule) and
// the parent may hold the user's own OpenCode state.
const GENERATED = [
  ".claude/agents/",
  ".claude/skills/",
  ".claude/commands/",
  ".claude/rules/",
  ".claude/hooks/",
  ".claude-plugin/",
  ".cursor/agents/",
  ".cursor/rules/",
  ".codex/agents/skills/",
  ".opencode/agents/",
  ".opencode/skills/",
  ".opencode/commands/",
];

// Map a generated path back to the source directory the author should edit.
function sourceHint(p) {
  if (/\.cursor\/agents\//.test(p)) return "agents/";
  if (/\.cursor\/rules\/[^/]+\//.test(p)) return "rules/<category>/";
  if (/\.cursor\/rules\//.test(p)) return "skills/<name>/SKILL.md";
  if (/\.codex\/.*skills\/agentry-/.test(p)) return "skills/<name>/ or agents/";
  if (/\.claude\/agents\//.test(p)) return "agents/";
  if (/\.claude\/skills\//.test(p)) return "skills/<name>/SKILL.md";
  if (/\.claude\/commands\//.test(p)) return "commands/";
  if (/\.claude\/rules\//.test(p)) return "rules/<category>/";
  if (/\.claude\/hooks\//.test(p)) return "hooks/";
  if (/\.claude-plugin\//.test(p)) return "scripts/sync-harnesses.js (manifest)";
  if (/\.opencode\/agents\//.test(p)) return "agents/";
  if (/\.opencode\/skills\//.test(p)) return "skills/<name>/SKILL.md";
  if (/\.opencode\/commands\//.test(p)) return "commands/";
  return "the source directory (agents/, skills/, commands/, rules/, hooks/)";
}

async function readStdin() {
  let data = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) data += chunk;
  return data;
}

const raw = await readStdin();
let payload;
try {
  payload = JSON.parse(raw || "{}");
} catch {
  // Malformed payload: do not block on a parse failure — fail open.
  process.exit(0);
}

const input = payload.tool_input ?? {};
// Write/Edit/MultiEdit/NotebookEdit all carry the target as file_path/notebook_path.
const target = input.file_path ?? input.notebook_path ?? "";
const normalized = String(target).split("\\").join("/");

if (normalized && GENERATED.some((frag) => normalized.includes(frag))) {
  process.stderr.write(
    `Blocked: ${target} is a generated agentry file. Edit the source under ` +
      `${sourceHint(normalized)} and run 'npm run sync' — edits here are wiped ` +
      `on the next sync.\n`,
  );
  process.exit(2);
}

process.exit(0);
