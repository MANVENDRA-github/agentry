#!/usr/bin/env node
// agentry — sync source-of-truth content (agents/, skills/, ...) to harness-specific
// generated directories (.claude/, .cursor/). Idempotent: running twice produces the
// same tree. Never edit the generated directories directly — they are wiped on every run.
//
// Usage:
//   node scripts/sync-harnesses.js                    # sync all targets
//   node scripts/sync-harnesses.js --target claude    # sync one
//   node scripts/sync-harnesses.js --target=claude,cursor
//   node scripts/sync-harnesses.js --dry-run          # log without writing

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const SOURCES = {
  agents: path.join(REPO_ROOT, "agents"),
  skills: path.join(REPO_ROOT, "skills"),
  commands: path.join(REPO_ROOT, "commands"),
};

// --- CLI parsing -----------------------------------------------------------

const ALL_TARGETS = ["claude", "cursor"];
let DRY_RUN = false;
let TARGETS = [...ALL_TARGETS];
const UNKNOWN_TARGETS = [];

{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      DRY_RUN = true;
    } else if (arg === "--target" && i + 1 < argv.length) {
      TARGETS = parseTargets(argv[++i]);
    } else if (arg.startsWith("--target=")) {
      TARGETS = parseTargets(arg.slice("--target=".length));
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exitCode = 1;
    }
  }
}

function parseTargets(value) {
  const requested = value.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = [];
  for (const t of requested) {
    if (ALL_TARGETS.includes(t)) valid.push(t);
    else UNKNOWN_TARGETS.push(t);
  }
  return valid;
}

// --- File helpers ----------------------------------------------------------

function rel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join("/");
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readDirSafe(p) {
  try {
    return await fs.readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function copyFile(src, dest) {
  if (DRY_RUN) {
    console.log(`  [dry] ${rel(dest)}`);
    return;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  console.log(`  ✓ ${rel(dest)}`);
}

async function writeFile(dest, content) {
  if (DRY_RUN) {
    console.log(`  [dry] ${rel(dest)}`);
    return;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content);
  console.log(`  ✓ ${rel(dest)}`);
}

async function rmGenerated(dir) {
  if (DRY_RUN) {
    console.log(`  [dry] clean ${rel(dir)}`);
    return;
  }
  await fs.rm(dir, { recursive: true, force: true });
  console.log(`  clean ${rel(dir)}`);
}

async function copyTree(srcDir, destDir) {
  const entries = await readDirSafe(srcDir);
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(src, dest);
    } else if (entry.isFile()) {
      await copyFile(src, dest);
    }
  }
}

// --- Cursor skill transform ------------------------------------------------

// Source skills use Claude-style frontmatter (name, description). Cursor's
// closest primitive is a .mdc rule; we add `alwaysApply: false` so the rule
// is available on-demand but not auto-injected. This is a v0.1 approximation —
// Cursor has no first-class skill concept and the semantics differ slightly.
function toCursorRule(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!fmMatch) {
    return `---\nalwaysApply: false\n---\n\n${content}`;
  }
  const frontmatter = fmMatch[1];
  const body = content.slice(fmMatch[0].length);
  const hasAlwaysApply = /^\s*alwaysApply\s*:/m.test(frontmatter);
  const newFrontmatter = hasAlwaysApply
    ? frontmatter
    : `${frontmatter}\nalwaysApply: false`;
  return `---\n${newFrontmatter}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

// --- Adapters --------------------------------------------------------------

/**
 * Sync agents, skills, and commands into .claude/, plus write the plugin
 * manifest. Only the generated subdirectories of .claude/ are wiped — the
 * top-level .claude/ directory may also hold Claude Code's per-user state
 * (e.g. settings.local.json) which must be preserved.
 */
async function syncClaude() {
  console.log("\n[claude]");
  const claudeDir = path.join(REPO_ROOT, ".claude");

  await rmGenerated(path.join(claudeDir, "agents"));
  await rmGenerated(path.join(claudeDir, "skills"));
  await rmGenerated(path.join(claudeDir, "commands"));

  // agents/<name>.md -> .claude/agents/<name>.md
  for (const entry of await readDirSafe(SOURCES.agents)) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await copyFile(
        path.join(SOURCES.agents, entry.name),
        path.join(claudeDir, "agents", entry.name),
      );
    }
  }

  // skills/<name>/SKILL.md (and any sibling files) -> .claude/skills/<name>/
  for (const entry of await readDirSafe(SOURCES.skills)) {
    if (entry.isDirectory()) {
      await copyTree(
        path.join(SOURCES.skills, entry.name),
        path.join(claudeDir, "skills", entry.name),
      );
    }
  }

  // commands/<name>.md -> .claude/commands/<name>.md
  for (const entry of await readDirSafe(SOURCES.commands)) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await copyFile(
        path.join(SOURCES.commands, entry.name),
        path.join(claudeDir, "commands", entry.name),
      );
    }
  }

  const manifest = {
    name: "agentry",
    version: "0.2.0",
    description:
      "Author your AI coding agents and skills once. Sync them to every harness you use.",
    author: "MANVENDRA-github",
    license: "MIT",
  };
  await writeFile(
    path.join(REPO_ROOT, ".claude-plugin", "plugin.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}

/**
 * Sync into .cursor/. Agents are copied verbatim with an `agentry-` prefix to
 * avoid collisions with the user's own Cursor agents. Skills are translated to
 * .mdc rules with `alwaysApply: false` (see toCursorRule).
 */
async function syncCursor() {
  console.log("\n[cursor]");
  const cursorDir = path.join(REPO_ROOT, ".cursor");
  await rmGenerated(cursorDir);

  for (const entry of await readDirSafe(SOURCES.agents)) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await copyFile(
        path.join(SOURCES.agents, entry.name),
        path.join(cursorDir, "agents", `agentry-${entry.name}`),
      );
    }
  }

  for (const entry of await readDirSafe(SOURCES.skills)) {
    if (!entry.isDirectory()) continue;
    const srcSkill = path.join(SOURCES.skills, entry.name, "SKILL.md");
    if (!(await exists(srcSkill))) continue;
    const dest = path.join(cursorDir, "rules", `${entry.name}.mdc`);
    if (DRY_RUN) {
      console.log(`  [dry] ${rel(dest)}`);
      continue;
    }
    const source = await fs.readFile(srcSkill, "utf8");
    await writeFile(dest, toCursorRule(source));
  }
}

const ADAPTERS = { claude: syncClaude, cursor: syncCursor };

// --- main ------------------------------------------------------------------

async function main() {
  for (const t of UNKNOWN_TARGETS) {
    console.error(`Unknown target: ${t}`);
    process.exitCode = 1;
  }
  console.log(
    `agentry sync${DRY_RUN ? " (dry run)" : ""} — targets: ${TARGETS.join(", ") || "(none)"}`,
  );
  for (const target of TARGETS) {
    const adapter = ADAPTERS[target];
    if (adapter) await adapter();
  }
  console.log(`\n${DRY_RUN ? "Dry run complete." : "Sync complete."}`);
}

try {
  await main();
} catch (err) {
  console.error(`Fatal: ${err?.stack ?? err}`);
  process.exit(1);
}
