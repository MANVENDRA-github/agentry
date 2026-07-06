#!/usr/bin/env node
// agentry — PreToolUse hook: block a hand-edit of a package-manager lockfile.
//
// A lockfile is a generated artifact: it records the exact resolved dependency
// graph plus an integrity hash for every entry, and it is meant to change only
// when its package manager rewrites it. Editing one by hand silently corrupts
// it — the next install either fails hash verification or, worse, resolves a
// different tree than every other machine and CI. This hook blocks a
// Write/Edit/MultiEdit call whose target is a known lockfile and redirects the
// author to the command that regenerates it (npm/yarn/pnpm install, cargo,
// poetry lock, uv lock, and so on).
//
// It matches on the exact basename, so it never false-positives on a look-alike
// path (a doc named yarn.lock.md, a fixture dir, a template). On a malformed
// payload it fails open — a parse failure never blocks a tool call.
//
// Wiring (Claude Code): reference it from settings.json as a PreToolUse hook,
// e.g.
//   {
//     "hooks": {
//       "PreToolUse": [
//         { "matcher": "Write|Edit|MultiEdit",
//           "hooks": [ { "type": "command",
//                        "command": "node ~/.claude/hooks/protect-lockfile-edit.js" } ] }
//       ]
//     }
//   }
//
// Contract: Claude Code passes the tool call as JSON on stdin. Exit 0 to allow;
// exit 2 to block, with the reason written to stderr (surfaced back to Claude).

import { stdin } from "node:process";

// Lockfile basename -> the command that regenerates it. Keys are matched
// case-sensitively against the exact basename of the target path.
const LOCKFILES = {
  "package-lock.json": "npm install",
  "npm-shrinkwrap.json": "npm install",
  "yarn.lock": "yarn install",
  "pnpm-lock.yaml": "pnpm install",
  "bun.lockb": "bun install",
  "Cargo.lock": "cargo build (or cargo update to bump versions)",
  "poetry.lock": "poetry lock",
  "uv.lock": "uv lock",
  "Pipfile.lock": "pipenv lock",
  "go.sum": "go mod tidy",
  "Gemfile.lock": "bundle install",
  "composer.lock": "composer update",
};

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

// Exact basename match — never a substring, so foo-package-lock.json and
// package-lock.json.bak do not trip the guard.
const base = normalized.split("/").pop() ?? "";
const regen = LOCKFILES[base];

if (regen) {
  process.stderr.write(
    `Blocked: ${target} is a package-manager lockfile — a generated artifact. ` +
      `Editing it by hand corrupts its integrity hashes and resolved dependency ` +
      `graph; the next install fails verification or resolves a different tree ` +
      `than everyone else. Change the manifest instead and regenerate it with ` +
      `'${regen}', then commit the result.\n`,
  );
  process.exit(2);
}

process.exit(0);
