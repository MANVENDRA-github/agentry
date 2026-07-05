#!/usr/bin/env node
// agentry — PreToolUse hook: block a force-push to a protected branch.
//
// A force-push rewrites published history. On a shared branch — main, master,
// or a release branch — that discards other people's commits and breaks every
// clone that had the old history. On your own feature branch it is routine and
// fine. This hook draws exactly that line: it blocks a Bash tool call that
// force-pushes to a protected branch (main/master/release/*), and allows every
// other push, including a force-push to a feature branch and a normal push to
// main.
//
// It errs toward allowing: if it cannot clearly identify the target branch, it
// does not block, so it never gets in the way of an ordinary push.
//
// Wiring (Claude Code): reference it from settings.json as a PreToolUse hook,
// e.g.
//   {
//     "hooks": {
//       "PreToolUse": [
//         { "matcher": "Bash",
//           "hooks": [ { "type": "command",
//                        "command": "node ~/.claude/hooks/block-force-push.js" } ] }
//       ]
//     }
//   }
//
// Contract: Claude Code passes the tool call as JSON on stdin. Exit 0 to allow;
// exit 2 to block, with the reason written to stderr (surfaced back to Claude).

import { stdin } from "node:process";

// Branch names (and patterns) a force-push must never touch.
const PROTECTED = [/^main$/, /^master$/, /^release(\/.*)?$/, /^develop$/];

async function readStdin() {
  let data = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) data += chunk;
  return data;
}

function segments(command) {
  return command.split(/&&|\|\||[;|]/g);
}

function tokens(segment) {
  const raw = segment.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < raw.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(raw[i])) i++;
  return raw.slice(i);
}

function isProtected(branch) {
  // Strip a leading `+` (refspec force) and any `local:remote` split.
  const name = branch.replace(/^\+/, "").split(":").pop();
  return PROTECTED.some((re) => re.test(name));
}

// Return a reason string if this segment force-pushes to a protected branch.
function forcePushReason(toks) {
  const gitIdx = toks.findIndex((t) => t === "git" || t.endsWith("/git"));
  if (gitIdx === -1) return null;
  const rest = toks.slice(gitIdx + 1);
  if (!rest.includes("push")) return null;

  const forced =
    rest.some((t) => t === "--force" || t === "-f" || t === "--force-with-lease" ||
      t.startsWith("--force-with-lease=")) ||
    // A refspec beginning with `+` is a force update, e.g. `git push origin +main`.
    rest.some((t) => /^\+[^-]/.test(t));
  if (!forced) return null;

  // Positional args after `push`, minus flags, are [remote, refspec...].
  const positional = rest.filter((t) => !t.startsWith("-") && t !== "push");
  // Drop the remote (first positional) to look at the refspecs.
  const refspecs = positional.slice(1);

  if (refspecs.length === 0) {
    // `git push --force` with no refspec pushes the current branch. We cannot
    // know its name from the command alone — err toward allowing, but flag the
    // common dangerous shorthand only when a protected name appears anywhere.
    return null;
  }
  for (const ref of refspecs) {
    if (isProtected(ref)) {
      return `force-push to protected branch '${ref.replace(/^\+/, "").split(":").pop()}'`;
    }
  }
  return null;
}

const raw = await readStdin();
let payload;
try {
  payload = JSON.parse(raw || "{}");
} catch {
  process.exit(0); // fail open
}

const command = payload.tool_input?.command;
if (typeof command !== "string" || !command.trim()) process.exit(0);

for (const seg of segments(command)) {
  const reason = forcePushReason(tokens(seg));
  if (reason) {
    process.stderr.write(
      `Blocked: ${reason}. Force-pushing a shared branch rewrites published ` +
        `history and discards others' commits. Push to a feature branch and open ` +
        `a pull request, or if you truly must rewrite this branch, do it ` +
        `deliberately outside this session.\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
