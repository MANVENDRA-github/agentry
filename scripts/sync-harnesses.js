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
import { parseFrontmatter } from "./frontmatter.js";
import { toCursorRule, globsForLanguage } from "./cursor-transform.js";
import { renameSkill, agentToSkill, ruleToSkill } from "./codex-transform.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const SOURCES = {
  agents: path.join(REPO_ROOT, "agents"),
  skills: path.join(REPO_ROOT, "skills"),
  commands: path.join(REPO_ROOT, "commands"),
  rules: path.join(REPO_ROOT, "rules"),
  hooks: path.join(REPO_ROOT, "hooks"),
};

// --- CLI parsing -----------------------------------------------------------

const ALL_TARGETS = ["claude", "cursor", "codex"];
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

/**
 * Split a comma-separated `--target` value into known targets, pushing any
 * unrecognized names onto the module-level `UNKNOWN_TARGETS` array so they
 * can be reported once at the start of `main()`.
 *
 * @param {string} value
 * @returns {string[]} the valid subset of requested targets
 */
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

// --- Adapters --------------------------------------------------------------

/**
 * Sync agents, skills, commands, rules, and hooks into .claude/, plus write the
 * plugin manifest. Only the generated subdirectories of .claude/ are wiped —
 * the top-level .claude/ directory may also hold Claude Code's per-user state
 * (e.g. settings.local.json) which must be preserved.
 */
async function syncClaude() {
  console.log("\n[claude]");
  const claudeDir = path.join(REPO_ROOT, ".claude");

  await rmGenerated(path.join(claudeDir, "agents"));
  await rmGenerated(path.join(claudeDir, "skills"));
  await rmGenerated(path.join(claudeDir, "commands"));
  await rmGenerated(path.join(claudeDir, "rules"));
  await rmGenerated(path.join(claudeDir, "hooks"));

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

  // rules/<category>/<name>.md -> .claude/rules/<category>/<name>.md
  // Copied verbatim. Claude Code does not yet auto-apply rules by context;
  // they are made available in the install location for users (or for
  // CLAUDE.md to reference) and will work cleanly if auto-application lands.
  for (const category of await readDirSafe(SOURCES.rules)) {
    if (!category.isDirectory()) continue;
    const srcCategoryDir = path.join(SOURCES.rules, category.name);
    for (const entry of await readDirSafe(srcCategoryDir)) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        await copyFile(
          path.join(srcCategoryDir, entry.name),
          path.join(claudeDir, "rules", category.name, entry.name),
        );
      }
    }
  }

  // hooks/<name>.{sh,js,...} (and any subdirectories) -> .claude/hooks/
  // Hook scripts are copied verbatim into the install location. Claude Code
  // runs hooks that the user references from settings.json — agentry ships the
  // scripts; wiring them into settings is the user's step (the same "wipe what
  // you own, leave user state alone" discipline keeps us out of settings.json).
  await copyTree(SOURCES.hooks, path.join(claudeDir, "hooks"));

  const manifest = {
    name: "agentry",
    version: "0.6.0",
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

  // rules/<category>/<name>.md -> .cursor/rules/<category>/<name>.mdc
  // Language rules nest under their category. They use the same toCursorRule
  // transform as skills. When the rule's `language` field (falling back to the
  // category directory name) maps to known globs, the rule is written with
  // `globs` + `alwaysApply: false` — Cursor's "Auto Attached" mode, so the rule
  // activates only when a matching file is in context. Unmapped languages stay
  // opt-in (`alwaysApply: false`, no globs). Cursor discovers .mdc files
  // recursively inside .cursor/rules/.
  for (const category of await readDirSafe(SOURCES.rules)) {
    if (!category.isDirectory()) continue;
    const srcCategoryDir = path.join(SOURCES.rules, category.name);
    for (const entry of await readDirSafe(srcCategoryDir)) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const destName = entry.name.replace(/\.md$/, ".mdc");
      const dest = path.join(cursorDir, "rules", category.name, destName);
      if (DRY_RUN) {
        console.log(`  [dry] ${rel(dest)}`);
        continue;
      }
      const source = await fs.readFile(path.join(srcCategoryDir, entry.name), "utf8");
      const language = parseFrontmatter(source)?.fields.language || category.name;
      await writeFile(dest, toCursorRule(source, { globs: globsForLanguage(language) }));
    }
  }
}

/**
 * Sync into .codex/. Source skills are copied near-verbatim (only the `name`
 * field is rewritten to `agentry-<name>` for collision avoidance). Source
 * agents are converted into Codex skills — Codex has no markdown-agent
 * primitive that matches Claude Code's, so each agent becomes a skill with
 * `tools` and `model` dropped (see codex-transform.js).
 *
 * Rules are converted to Codex skills too. Codex has no rules primitive
 * distinct from skills, so each rule becomes a skill (`ruleToSkill`) named
 * `agentry-<category>-<name>` — the category in the name keeps language rules
 * from colliding with each other or with converted skills/agents. This is the
 * same approximation pattern as the agent->skill conversion.
 *
 * Commands are skipped. Codex does not support user-extensible slash
 * commands; the closest equivalent is `$skill-name` invocation, which the
 * converted skills already provide. Hooks are skipped too — Codex's
 * notification model differs and has no drop-in hooks directory.
 *
 * Only .codex/agents/skills/ is wiped on sync. The parent .codex/ directory
 * may hold Codex's per-user state (e.g. config.toml) and must be preserved —
 * same pattern as syncClaude's partial wipe.
 */
async function syncCodex() {
  console.log("\n[codex]");
  const codexSkillsDir = path.join(REPO_ROOT, ".codex", "agents", "skills");
  await rmGenerated(codexSkillsDir);

  // skills/<name>/SKILL.md -> .codex/agents/skills/agentry-<name>/SKILL.md
  // (plus any sibling files/dirs the source skill bundles).
  for (const entry of await readDirSafe(SOURCES.skills)) {
    if (!entry.isDirectory()) continue;
    const srcSkillDir = path.join(SOURCES.skills, entry.name);
    const srcSkillFile = path.join(srcSkillDir, "SKILL.md");
    if (!(await exists(srcSkillFile))) continue;
    const prefixed = `agentry-${entry.name}`;
    const destSkillDir = path.join(codexSkillsDir, prefixed);
    const destSkillFile = path.join(destSkillDir, "SKILL.md");
    if (DRY_RUN) {
      console.log(`  [dry] ${rel(destSkillFile)}`);
    } else {
      const source = await fs.readFile(srcSkillFile, "utf8");
      await writeFile(destSkillFile, renameSkill(source, prefixed));
    }
    // Copy any sibling files/directories alongside SKILL.md verbatim.
    for (const sibling of await readDirSafe(srcSkillDir)) {
      if (sibling.name === "SKILL.md") continue;
      const src = path.join(srcSkillDir, sibling.name);
      const dest = path.join(destSkillDir, sibling.name);
      if (sibling.isDirectory()) {
        await copyTree(src, dest);
      } else if (sibling.isFile()) {
        await copyFile(src, dest);
      }
    }
  }

  // agents/<name>.md -> .codex/agents/skills/agentry-<name>/SKILL.md
  for (const entry of await readDirSafe(SOURCES.agents)) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const prefixed = `agentry-${entry.name.replace(/\.md$/, "")}`;
    const destSkillFile = path.join(codexSkillsDir, prefixed, "SKILL.md");
    if (DRY_RUN) {
      console.log(`  [dry] ${rel(destSkillFile)}`);
      continue;
    }
    const source = await fs.readFile(path.join(SOURCES.agents, entry.name), "utf8");
    await writeFile(destSkillFile, agentToSkill(source, prefixed));
  }

  // rules/<category>/<name>.md -> .codex/agents/skills/agentry-<category>-<name>/SKILL.md
  for (const category of await readDirSafe(SOURCES.rules)) {
    if (!category.isDirectory()) continue;
    const srcCategoryDir = path.join(SOURCES.rules, category.name);
    for (const entry of await readDirSafe(srcCategoryDir)) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const prefixed = `agentry-${category.name}-${entry.name.replace(/\.md$/, "")}`;
      const destSkillFile = path.join(codexSkillsDir, prefixed, "SKILL.md");
      if (DRY_RUN) {
        console.log(`  [dry] ${rel(destSkillFile)}`);
        continue;
      }
      const source = await fs.readFile(path.join(srcCategoryDir, entry.name), "utf8");
      await writeFile(destSkillFile, ruleToSkill(source, prefixed));
    }
  }
}

const ADAPTERS = { claude: syncClaude, cursor: syncCursor, codex: syncCodex };

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
