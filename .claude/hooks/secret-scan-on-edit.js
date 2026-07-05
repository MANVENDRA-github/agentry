#!/usr/bin/env node
// agentry — PreToolUse hook: stop a secret from being written into a source file.
//
// The cheapest place to catch a leaked credential is before it ever lands on
// disk — once it is committed it must be treated as compromised and rotated,
// even if the commit is later removed. This hook inspects the content a
// Write/Edit/MultiEdit call is about to write and blocks it when the content
// carries a high-signal secret (a cloud key, a private key, a provider token,
// or a long secret assigned to an obviously-named field). It never echoes the
// secret value back; it reports only which pattern matched and the path.
//
// This is a fast, high-signal net for the common self-inflicted leak — a key
// pasted into a config or a test. It is NOT a replacement for a real secret
// scanner (gitleaks, trufflehog) in CI; run one of those as the backstop.
//
// Wiring (Claude Code): reference it from settings.json as a PreToolUse hook,
// e.g.
//   {
//     "hooks": {
//       "PreToolUse": [
//         { "matcher": "Write|Edit|MultiEdit",
//           "hooks": [ { "type": "command",
//                        "command": "node ~/.claude/hooks/secret-scan-on-edit.js" } ] }
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

// Files whose whole purpose is to hold example/placeholder values. We skip
// generic-assignment scanning for these, but still catch a real private-key
// header, which should never appear even in an example.
const PLACEHOLDER_FILE = /\.(example|sample|template|dist)$|(^|\/)\.env\.example$/i;

// A value is an obvious placeholder, not a real secret.
function isPlaceholder(value) {
  const v = value.toLowerCase();
  if (/[<>]/.test(value)) return true;
  if (/(x{4,}|\*{4,}|\.{3,})/.test(v)) return true;
  if (/change[\s_-]?me|your[\s_-]|example|placeholder|dummy|redacted|sample|todo|xxxx/.test(v)) {
    return true;
  }
  // All one repeated character (e.g. "aaaaaaaaaaaaaaaa").
  if (/^(.)\1+$/.test(value)) return true;
  return false;
}

// High-signal patterns that are a secret regardless of the field name.
const STRUCTURAL = [
  { name: "AWS access key id", re: /AKIA[0-9A-Z]{16}/ },
  { name: "private key header", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "Slack token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z_\-]{35}/ },
];

// A long secret assigned to an obviously-named field:
//   API_KEY = "abcdef....", token: 'xyz...', private_key => "...."
const ASSIGNMENT =
  /\b[A-Za-z0-9_]*(?:api[_-]?key|secret|token|password|passwd|private[_-]?key|access[_-]?key)[A-Za-z0-9_]*\b\s*[:=]{1,2}>?\s*['"]([^'"]{16,})['"]/gi;

function scan(content, filePath) {
  const hits = new Set();
  const placeholderFile = PLACEHOLDER_FILE.test(filePath);
  const docFile = /\.md$/i.test(filePath);

  for (const { name, re } of STRUCTURAL) {
    // A private-key header is never acceptable, even in an example or a doc.
    const headerOnly = name === "private key header";
    if ((placeholderFile || docFile) && !headerOnly) continue;
    if (re.test(content)) hits.add(name);
  }

  // Generic assignment scanning is noisy in placeholder files and docs — skip
  // there; the structural patterns above still run.
  if (!placeholderFile && !docFile) {
    let m;
    while ((m = ASSIGNMENT.exec(content)) !== null) {
      if (!isPlaceholder(m[1])) hits.add("hardcoded secret assignment");
    }
  }

  return [...hits];
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
const filePath = String(input.file_path ?? input.notebook_path ?? "");

// Assemble the text this call will write: Write -> content, Edit -> new_string,
// MultiEdit -> every edits[].new_string.
let content = "";
if (typeof input.content === "string") content = input.content;
else if (typeof input.new_string === "string") content = input.new_string;
else if (Array.isArray(input.edits)) {
  content = input.edits.map((e) => (e && typeof e.new_string === "string" ? e.new_string : "")).join("\n");
}

if (!content) process.exit(0);

const found = scan(content, filePath);
if (found.length) {
  process.stderr.write(
    `Blocked: ${filePath || "this file"} appears to contain a secret ` +
      `(${found.join(", ")}). Do not commit credentials to source. Move it to an ` +
      `environment variable or a secret store the deployment expands, and ` +
      `reference that instead. If this is a false positive, rename the field or ` +
      `use a clearly-marked placeholder.\n`,
  );
  process.exit(2);
}

process.exit(0);
