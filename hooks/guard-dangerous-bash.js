#!/usr/bin/env node
// agentry — PreToolUse hook: guard against catastrophic shell commands.
//
// Some shell commands have no legitimate use inside a normal development
// session and a catastrophic failure mode: wiping the filesystem, recursively
// world-writable permissions, piping a downloaded script straight into a shell,
// overwriting a raw device, a fork bomb. This hook is a last line of defense —
// it blocks a Bash tool call matching one of those high-signal destructive
// patterns and explains why, so an accidental or malformed command cannot
// quietly run.
//
// It is intentionally narrow: it targets a short list of unambiguously
// dangerous shapes, not "commands that touch files." A false block here is far
// cheaper than the incident it prevents, but the list is kept tight so ordinary
// work is never interrupted. It is a safety net, not a substitute for reading
// what you run.
//
// Wiring (Claude Code): reference it from settings.json as a PreToolUse hook,
// e.g.
//   {
//     "hooks": {
//       "PreToolUse": [
//         { "matcher": "Bash",
//           "hooks": [ { "type": "command",
//                        "command": "node ~/.claude/hooks/guard-dangerous-bash.js" } ] }
//       ]
//     }
//   }
//
// Contract: Claude Code passes the tool call as JSON on stdin. Exit 0 to allow;
// exit 2 to block, with the reason written to stderr (surfaced back to Claude).

import { stdin } from "node:process";

// Each entry: a human-readable name and a regex matching the dangerous shape.
// Kept deliberately specific so ordinary commands don't trip them.
const DANGEROUS = [
  {
    name: "recursive delete of a root / system path",
    // rm -rf / , rm -rf /*, rm -rf ~ , rm --recursive --force /  (with optional flags order)
    re: /\brm\s+(?:-[a-zA-Z]*\s+|--[a-z-]+\s+)*-?[a-zA-Z]*[rf][a-zA-Z]*[rf]?[a-zA-Z]*\s+(?:--\s+)?(?:\/|\/\*|~|\$HOME)(?:\s|$)/,
  },
  {
    name: "world-writable recursive chmod",
    re: /\bchmod\s+(?:-[a-zA-Z]*\s+|--[a-z-]+\s+)*-R[a-zA-Z]*\s+0*777\b/,
  },
  {
    name: "pipe a downloaded script directly into a shell",
    // curl ... | sh  /  wget ... | bash   (the classic remote-exec footgun)
    re: /\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z|d)?sh\b/,
  },
  {
    name: "overwrite a raw block device",
    re: /\bdd\b[^\n]*\bof=\/dev\/(?:sd|nvme|hd|disk|mmcblk)/,
  },
  {
    name: "format a filesystem",
    re: /\bmkfs(\.[a-z0-9]+)?\s+\/dev\//,
  },
  {
    name: "fork bomb",
    re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
  },
  {
    name: "write directly to a raw block device",
    re: />\s*\/dev\/(?:sd|nvme|hd|disk|mmcblk)/,
  },
];

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
  process.exit(0); // fail open
}

const command = payload.tool_input?.command;
if (typeof command !== "string" || !command.trim()) process.exit(0);

for (const { name, re } of DANGEROUS) {
  if (re.test(command)) {
    process.stderr.write(
      `Blocked: this command matches a known-catastrophic pattern (${name}). ` +
        `If this was not what you intended, rewrite it. If you genuinely need to ` +
        `run it, do so deliberately outside this session where the safety net ` +
        `does not apply.\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
