#!/usr/bin/env node
// agentry — PreToolUse hook: block a git command from staging a credential file.
//
// The single most common self-inflicted leak is not a key pasted into code — it
// is `git add .` sweeping an existing `.env` or private-key file that was never
// opened this session. Once that file lands in history the secret is compromised
// and must be rotated even after the file is removed. This hook blocks a Bash
// tool call whose `git add` / `git commit -a` would stage a credential file:
// `.env` and `.env.*` (except `.env.example`), `*.pem` / `*.key`, `id_rsa` /
// `id_ed25519`, `*.p12` / `*.pfx`, `service-account*.json`, or a token-bearing
// `.npmrc` / `.pypirc`. It directs the author to gitignore the file instead.
//
// It resolves the command's pathspecs — including the sweeping `git add .`,
// `-A`, and `-u` forms and `git commit -a` — against the working tree by asking
// git itself (`git add --dry-run`), so a broad add is caught, not just an
// explicitly named path. Because the dry run respects `.gitignore`, a file that
// is already ignored is never flagged (it cannot be staged), which is exactly
// the state this hook is steering you toward.
//
// It complements secret-scan-on-edit, which inspects the content a Write/Edit
// is about to write and never sees a file already on disk being staged. This one
// covers the opposite gap: an existing credential file swept into a commit. It
// is a fast, high-signal net, not a replacement for gitleaks/trufflehog in CI.
//
// It errs toward allowing: if git is unavailable or the command's target cannot
// be resolved, it does not block, so ordinary work is never interrupted.
//
// Wiring (Claude Code): reference it from settings.json as a PreToolUse hook,
// e.g.
//   {
//     "hooks": {
//       "PreToolUse": [
//         { "matcher": "Bash",
//           "hooks": [ { "type": "command",
//                        "command": "node ~/.claude/hooks/block-secret-file-stage.js" } ] }
//       ]
//     }
//   }
//
// Contract: Claude Code passes the tool call as JSON on stdin. Exit 0 to allow;
// exit 2 to block, with the reason written to stderr (surfaced back to Claude).

import { stdin } from "node:process";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

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
// `GIT_DIR=... git add .` still resolves to a git invocation. Whitespace-only
// splitting means a quoted pathspec containing a space is mis-tokenized — a
// known limitation shared with the other git hooks; the sweeping forms this hook
// targets are resolved by git itself and are unaffected.
function tokens(segment) {
  const raw = segment.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < raw.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(raw[i])) i++;
  return raw.slice(i);
}

function unquote(s) {
  return s.replace(/^['"]/, "").replace(/['"]$/, "");
}

// Locate the git invocation in a segment's tokens and return its working-dir
// override (`-C <dir>`), subcommand, and the tokens after it — or null.
function parseGit(toks) {
  const gitIdx = toks.findIndex((t) => t === "git" || t.endsWith("/git"));
  if (gitIdx === -1) return null;
  let i = gitIdx + 1;
  let cDir = null;
  while (i < toks.length) {
    const t = toks[i];
    if (t === "-C" || t === "--git-dir" || t === "--work-tree") {
      if (t === "-C") cDir = toks[i + 1] ?? null;
      i += 2;
      continue;
    }
    if (t === "-c") {
      i += 2; // `-c key=value` consumes its argument
      continue;
    }
    if (t.startsWith("-")) {
      i += 1; // another global flag (e.g. --no-pager, --git-dir=...)
      continue;
    }
    break;
  }
  if (i >= toks.length) return null;
  return { cDir, sub: toks[i], rest: toks.slice(i + 1) };
}

// Parse the flags/pathspecs of a `git add` invocation.
function parseAdd(rest) {
  let hasAll = false;
  let hasUpdate = false;
  let force = false;
  let dryRun = false;
  const pathspecs = [];
  let sawSep = false;
  for (const t of rest) {
    if (sawSep) {
      pathspecs.push(unquote(t));
      continue;
    }
    if (t === "--") {
      sawSep = true;
      continue;
    }
    if (t.startsWith("--")) {
      if (t === "--all" || t === "--no-ignore-removal") hasAll = true;
      else if (t === "--update") hasUpdate = true;
      else if (t === "--force") force = true;
      else if (t === "--dry-run") dryRun = true;
      continue;
    }
    if (t.length > 1 && t.startsWith("-")) {
      // Short-flag cluster like `-Af` or `-nu`.
      if (t.includes("A")) hasAll = true;
      if (t.includes("u")) hasUpdate = true;
      if (t.includes("f")) force = true;
      if (t.includes("n")) dryRun = true;
      continue;
    }
    pathspecs.push(unquote(t));
  }
  return { hasAll, hasUpdate, force, dryRun, pathspecs };
}

// Does a `git commit` stage everything (`-a` / `--all`)? That is the only commit
// form that stages files on its own; a plain `git commit` only records what is
// already staged, which the add path above has already vetted.
function commitStagesAll(rest) {
  for (const t of rest) {
    if (t === "--") break;
    if (t === "--all") return true;
    if (t.length > 1 && /^-[A-Za-z]+$/.test(t) && t.includes("a")) return true;
  }
  return false;
}

// A `.npmrc` / `.pypirc` is only a secret when it actually carries a literal
// credential — a project `.npmrc` that just sets a registry is fine. Read the
// file and look for an auth line whose value is a real token, not an env-var
// reference (`${NPM_TOKEN}`) the tool expands at runtime.
function carriesLiteralCredential(fullPath, kind) {
  let text;
  try {
    text = readFileSync(fullPath, "utf8");
  } catch {
    return false; // can't read it — don't guess; fail open
  }
  const keyRe =
    kind === "npmrc"
      ? /_(?:authToken|auth|password)\s*=\s*(.+)$/i
      : /(?:password|token)\s*=\s*(.+)$/i;
  for (const line of text.split(/\r?\n/)) {
    const m = keyRe.exec(line.trim());
    if (!m) continue;
    const val = m[1].trim();
    if (!val) continue;
    if (/^\$\{?[A-Za-z_]/.test(val)) continue; // env-var reference, not a literal
    return true;
  }
  // A PyPI API token is unmistakable even without a `password =` line.
  if (kind === "pypirc" && /pypi-[A-Za-z0-9_-]{16,}/.test(text)) return true;
  return false;
}

// Classify a repo-relative path. Returns a human-readable label of what kind of
// credential it is, or null if it is not one we block.
function classify(relPath, baseDir) {
  const base = relPath.split(/[\\/]/).filter(Boolean).pop() || relPath;
  if (/^\.env(\..+)?$/i.test(base) && !/^\.env\.example$/i.test(base)) return "environment file";
  if (/\.pem$/i.test(base)) return "PEM certificate/key";
  if (/\.key$/i.test(base)) return "private key";
  if (/^id_(?:rsa|ed25519)$/i.test(base)) return "SSH private key";
  if (/\.(?:p12|pfx)$/i.test(base)) return "PKCS#12 keystore";
  if (/^service-account.*\.json$/i.test(base)) return "service-account key";
  if (/^\.npmrc$/i.test(base)) {
    return carriesLiteralCredential(path.resolve(baseDir, relPath), "npmrc") ? "npmrc auth token" : null;
  }
  if (/^\.pypirc$/i.test(base)) {
    return carriesLiteralCredential(path.resolve(baseDir, relPath), "pypirc") ? "pypirc credentials" : null;
  }
  return null;
}

// Parse the `add 'path'` lines git prints for a `--dry-run`.
function parseDryRun(out) {
  const files = [];
  for (const line of out.split(/\r?\n/)) {
    const m = /^add '(.+)'$/.exec(line) || /^add "(.+)"$/.exec(line);
    if (m) files.push(m[1]);
  }
  return files;
}

// Ask git which files the given add-equivalent flags/pathspecs would stage,
// resolved against the working tree at baseDir and respecting .gitignore. On a
// missing git binary, fall back to the explicitly named literal pathspecs so a
// `git add id_rsa` is still caught; on any other git failure (not a repo, no
// match) nothing would be staged, so report nothing.
function resolveStaged(baseDir, addArgs, explicitSpecs) {
  try {
    const out = execFileSync("git", ["-C", baseDir, ...addArgs], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseDryRun(out);
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return explicitSpecs.filter((s) => s !== "." && s !== "./" && !/[*?[]/.test(s));
    }
    return [];
  }
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

const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();

// path -> credential label. A Map dedupes a file named across multiple segments.
const findings = new Map();

for (const seg of segments(command)) {
  const g = parseGit(tokens(seg));
  if (!g) continue;
  const baseDir = g.cDir ? path.resolve(cwd, g.cDir) : cwd;

  let addArgs = null;
  let explicitSpecs = [];

  if (g.sub === "add") {
    const a = parseAdd(g.rest);
    if (a.dryRun) continue; // the user's own command stages nothing
    if (a.pathspecs.length === 0 && !a.hasAll && !a.hasUpdate) continue; // bare `git add` is a no-op
    addArgs = ["add", "--dry-run"];
    if (a.force) addArgs.push("--force");
    if (a.hasAll) addArgs.push("-A");
    if (a.hasUpdate) addArgs.push("-u");
    addArgs.push("--", ...a.pathspecs);
    explicitSpecs = a.pathspecs;
  } else if (g.sub === "commit") {
    if (!commitStagesAll(g.rest)) continue;
    // `commit -a` stages tracked modifications/deletions — the `add -u` set.
    addArgs = ["add", "--dry-run", "-u"];
  } else {
    continue;
  }

  for (const file of resolveStaged(baseDir, addArgs, explicitSpecs)) {
    if (findings.has(file)) continue;
    const label = classify(file, baseDir);
    if (label) findings.set(file, label);
  }
}

if (findings.size) {
  const list = [...findings].map(([p, l]) => `${p} (${l})`).join("; ");
  process.stderr.write(
    `Blocked: this command would stage a credential file — ${list}. A secret ` +
      `committed to git is compromised the moment it lands and must be rotated ` +
      `even after it is removed from history. Add the file to .gitignore instead ` +
      `of staging it (keep only a redacted placeholder like .env.example in the ` +
      `repo), then re-run the add. If the file is genuinely safe to commit, move ` +
      `the secret out of it or rename it.\n`,
  );
  process.exit(2);
}

process.exit(0);
