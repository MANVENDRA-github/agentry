#!/usr/bin/env node
// agentry — PreToolUse hook: block git hook- and signing-bypass flags.
//
// Project quality gates live in git hooks (pre-commit, commit-msg, pre-push)
// and in commit signing. Skipping them with `--no-verify` / `-n` or
// `--no-gpg-sign` silently defeats the checks the repo relies on, and the
// standard tool guidance is to never skip hooks or bypass signing unless the
// user explicitly asked. This hook enforces that at the tool layer: it blocks a
// Bash tool call whose command runs `git commit`/`git push` with a bypass flag,
// and tells the author to fix the failing hook instead of routing around it.
//
// It is deliberately narrow: `git push -n` means --dry-run and is allowed;
// `-n` is only treated as --no-verify for `git commit`. A bare substring like a
// filename containing "no-verify" in an unrelated command will not trip it,
// because it only inspects segments that actually invoke `git`.
//
// Wiring (Claude Code): reference it from settings.json as a PreToolUse hook,
// e.g.
//   {
//     "hooks": {
//       "PreToolUse": [
//         { "matcher": "Bash",
//           "hooks": [ { "type": "command",
//                        "command": "node ~/.claude/hooks/block-no-verify.js" } ] }
//       ]
//     }
//   }
//
// Contract: Claude Code passes the tool call as JSON on stdin. Exit 0 to allow;
// exit 2 to block, with the reason written to stderr (surfaced back to Claude).

import { stdin } from "node:process";

async function readStdin() {
  let data = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) data += chunk;
  return data;
}

// Split a shell command into the individual invocations a `git ...` could hide
// in: `a && b`, `a; b`, `a | b`, `a || b`. Good enough to isolate the git call
// from surrounding `cd`, env assignments, and pipes without a full shell parse.
function segments(command) {
  return command.split(/&&|\|\||[;|]/g);
}

// Tokenize a segment, dropping leading `ENV=VALUE` assignments so
// `HUSKY=0 git commit ...` still resolves to a git invocation.
function tokens(segment) {
  const raw = segment.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < raw.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(raw[i])) i++;
  return raw.slice(i);
}

// Given the tokens of a single segment, return a bypass reason string if it is a
// git commit/push that skips hooks or signing, else null.
function bypassReason(toks) {
  const gitIdx = toks.findIndex((t) => t === "git" || t.endsWith("/git"));
  if (gitIdx === -1) return null;

  const rest = toks.slice(gitIdx + 1);
  // The subcommand is the first token that is not a global `-c key=val` / `-C dir`
  // style flag or its argument.
  let sub = null;
  const flags = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (sub === null) {
      if (t === "-c" || t === "-C") {
        // `-c key=val` and `-C dir` consume the next token; keep the pair so we
        // can still inspect `-c commit.gpgsign=false`.
        flags.push(`${t} ${rest[i + 1] ?? ""}`);
        i++;
        continue;
      }
      if (t.startsWith("-")) {
        flags.push(t);
        continue;
      }
      sub = t;
      continue;
    }
    flags.push(t);
  }
  if (sub !== "commit" && sub !== "push") return null;

  const joined = flags.join(" ");
  if (/(^|\s)--no-verify(\s|$)/.test(joined)) {
    return `git ${sub} --no-verify skips the project's git hooks`;
  }
  if (/--no-gpg-sign(\s|$)/.test(joined) || /-c\s+commit\.gpgsign\s*=\s*false/i.test(joined)) {
    return `git ${sub} bypasses commit signing`;
  }
  // `-n` means --no-verify for commit, but --dry-run for push. Only block on commit.
  // Match a standalone `-n` or an `n` inside a short-flag cluster like `-nm`.
  if (sub === "commit") {
    const short = flags.filter((f) => /^-[A-Za-z]+$/.test(f) && !f.startsWith("--"));
    if (short.some((f) => f.includes("n"))) {
      return "git commit -n skips the project's git hooks";
    }
  }
  return null;
}

const raw = await readStdin();
let payload;
try {
  payload = JSON.parse(raw || "{}");
} catch {
  // Malformed payload: do not block on a parse failure — fail open.
  process.exit(0);
}

const command = payload.tool_input?.command;
if (typeof command !== "string" || !command.trim()) process.exit(0);

for (const seg of segments(command)) {
  const reason = bypassReason(tokens(seg));
  if (reason) {
    process.stderr.write(
      `Blocked: ${reason}. The project's hooks and signing are quality gates — ` +
        `do not skip them unless the user explicitly asked. Fix the failing hook ` +
        `(read its output and resolve the real problem), or re-run the command ` +
        `without the bypass flag.\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
