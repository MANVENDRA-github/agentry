#!/usr/bin/env node
// agentry — diagnostic script. Reports the health of:
//   - source-of-truth directories
//   - generated harness directories (.claude/, .cursor/)
//   - frontmatter on every agent and skill
//   - the user's Claude Code install at ~/.claude/ (informational)
//
// Usage:
//   node scripts/doctor.js
//
// Exits 0 if every required check passes, 1 if any check fails.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./frontmatter.js";
import { validateServer } from "./mcp-transform.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const USER_CLAUDE = path.join(os.homedir(), ".claude");

const AGENT_REQUIRED = ["name", "description", "tools", "model"];
const SKILL_REQUIRED = ["name", "description"];
const MIN_DESCRIPTION_LEN = 20;

let failed = false;

function rel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join("/");
}

function ok(msg) { console.log(`  ✓ ${msg}`); }
function bad(msg) { console.log(`  ✗ ${msg}`); failed = true; }
function info(msg) { console.log(`  ? ${msg}`); }

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readDirSafe(p) {
  try { return await fs.readdir(p, { withFileTypes: true }); }
  catch { return []; }
}

/**
 * Check one generated MCP output file. Claude/Cursor key servers under
 * `mcpServers`; OpenCode keys them under `mcp` in opencode.json. Unlike
 * agents/skills (one generated file per source), MCP servers merge into a
 * single file, so the check parses it and confirms every source server is
 * present under the given top-level key.
 *
 * @param {string} outPath - absolute path to the generated file.
 * @param {Array<{ name: string }>} servers - source servers expected present.
 * @param {string} key - "mcpServers" (Claude/Cursor) or "mcp" (OpenCode).
 */
async function checkMcpOutput(outPath, servers, key) {
  const raw = await fs.readFile(outPath, "utf8").catch(() => null);
  if (raw === null) {
    bad(`${rel(outPath)} missing — run 'npm run sync'`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    bad(`${rel(outPath)} is not valid JSON — run 'npm run sync'`);
    return;
  }
  const map = (parsed && parsed[key]) || {};
  const missing = servers.filter((s) => !(s.name in map)).map((s) => s.name);
  if (missing.length) {
    bad(`${rel(outPath)} missing server(s): ${missing.join(", ")} — run 'npm run sync'`);
  } else {
    ok(`${rel(outPath)} — ${servers.length} server(s)`);
  }
}

/**
 * Validate parsed frontmatter against doctor's checks: required fields present,
 * `name` matches the expected value (filename or directory name), description
 * present and ≥ MIN_DESCRIPTION_LEN. Doctor has its own validator (rather than
 * reusing frontmatter.js's checkRequired/checkDescription) so the output format
 * matches the doctor report style.
 *
 * @param {Object | null} fields - parseFrontmatter's `fields`, or null if no block.
 * @param {string[]} required - field names that must be present and non-empty.
 * @param {string} expectedName - the value `fields.name` must equal.
 * @returns {string[]} error messages, one per problem; empty if valid.
 */
function validateFields(fields, required, expectedName) {
  if (!fields) return ["no frontmatter block"];
  const errors = [];
  const missing = required.filter((k) => !(k in fields) || fields[k] === "");
  if (missing.length) errors.push(`missing: ${missing.join(", ")}`);
  if (fields.name && fields.name !== expectedName) {
    errors.push(`name '${fields.name}' != '${expectedName}'`);
  }
  if (!fields.description) errors.push("description empty");
  else if (fields.description.length < MIN_DESCRIPTION_LEN) {
    errors.push(`description too short (${fields.description.length})`);
  }
  return errors;
}

console.log("agentry doctor — checking installation health\n");

// --- Sources ---------------------------------------------------------------

console.log("Sources:");
const agentFiles = (await readDirSafe(path.join(REPO_ROOT, "agents")))
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => e.name);
const skillDirs = (await readDirSafe(path.join(REPO_ROOT, "skills")))
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
const hookFiles = (await readDirSafe(path.join(REPO_ROOT, "hooks")))
  .filter((e) => e.isFile())
  .map((e) => e.name);

if (agentFiles.length) ok(`agents/ — ${agentFiles.length} file(s)`);
else bad("agents/ — no agent files found");

if (skillDirs.length) ok(`skills/ — ${skillDirs.length} skill(s)`);
else bad("skills/ — no skills found");

if (hookFiles.length) ok(`hooks/ — ${hookFiles.length} file(s)`);
else info("hooks/ — no hook files (optional)");

const mcpFiles = (await readDirSafe(path.join(REPO_ROOT, "mcp")))
  .filter((e) => e.isFile() && e.name.endsWith(".json"))
  .map((e) => e.name);

// Parse MCP sources once — reused by the Generated and MCP validation sections.
const mcpServers = [];
for (const file of mcpFiles) {
  const name = file.replace(/\.json$/, "");
  const raw = await fs.readFile(path.join(REPO_ROOT, "mcp", file), "utf8").catch(() => null);
  if (raw === null) {
    mcpServers.push({ name, file, def: null, error: "not readable" });
  } else {
    try {
      mcpServers.push({ name, file, def: JSON.parse(raw), error: null });
    } catch (err) {
      mcpServers.push({ name, file, def: null, error: `invalid JSON: ${err.message}` });
    }
  }
}

// MCP is optional content — its absence is informational, not a failure.
if (mcpFiles.length) ok(`mcp/ — ${mcpFiles.length} server(s)`);
else info("mcp/ — no MCP servers (optional)");

// --- Generated -------------------------------------------------------------

console.log("\nGenerated:");
let claudeMissing = [];
let cursorMissing = [];
let opencodeMissing = [];

for (const file of agentFiles) {
  if (!(await exists(path.join(REPO_ROOT, ".claude/agents", file)))) {
    claudeMissing.push(`.claude/agents/${file}`);
  }
  if (!(await exists(path.join(REPO_ROOT, ".cursor/agents", `agentry-${file}`)))) {
    cursorMissing.push(`.cursor/agents/agentry-${file}`);
  }
  if (!(await exists(path.join(REPO_ROOT, ".opencode/agents", file)))) {
    opencodeMissing.push(`.opencode/agents/${file}`);
  }
}

for (const skill of skillDirs) {
  if (!(await exists(path.join(REPO_ROOT, ".claude/skills", skill, "SKILL.md")))) {
    claudeMissing.push(`.claude/skills/${skill}/SKILL.md`);
  }
  if (!(await exists(path.join(REPO_ROOT, ".cursor/rules", `${skill}.mdc`)))) {
    cursorMissing.push(`.cursor/rules/${skill}.mdc`);
  }
  if (!(await exists(path.join(REPO_ROOT, ".opencode/skills", skill, "SKILL.md")))) {
    opencodeMissing.push(`.opencode/skills/${skill}/SKILL.md`);
  }
}

// Hooks sync to Claude Code only (Cursor and Codex have no drop-in hooks dir).
for (const hook of hookFiles) {
  if (!(await exists(path.join(REPO_ROOT, ".claude/hooks", hook)))) {
    claudeMissing.push(`.claude/hooks/${hook}`);
  }
}

if (claudeMissing.length === 0) ok(".claude/ matches sources");
else bad(`.claude/ missing: ${claudeMissing.join(", ")} — run 'npm run sync'`);

if (cursorMissing.length === 0) ok(".cursor/ matches sources");
else bad(`.cursor/ missing: ${cursorMissing.join(", ")} — run 'npm run sync'`);

if (opencodeMissing.length === 0) ok(".opencode/ matches sources");
else bad(`.opencode/ missing: ${opencodeMissing.join(", ")} — run 'npm run sync'`);

// MCP outputs are merged single files (keyed by server name), checked on their
// own rather than via the per-source arrays above. Claude/Cursor use the
// `mcpServers` key; OpenCode uses `mcp` in opencode.json.
if (mcpServers.length) {
  await checkMcpOutput(path.join(REPO_ROOT, ".mcp.json"), mcpServers, "mcpServers");
  await checkMcpOutput(path.join(REPO_ROOT, ".cursor", "mcp.json"), mcpServers, "mcpServers");
  await checkMcpOutput(path.join(REPO_ROOT, "opencode.json"), mcpServers, "mcp");
}

// --- Frontmatter -----------------------------------------------------------

console.log("\nFrontmatter:");
for (const file of agentFiles) {
  const full = path.join(REPO_ROOT, "agents", file);
  const content = await fs.readFile(full, "utf8");
  const parsed = parseFrontmatter(content);
  const errors = validateFields(parsed?.fields ?? null, AGENT_REQUIRED, file.replace(/\.md$/, ""));
  if (errors.length) bad(`${rel(full)} — ${errors.join("; ")}`);
  else ok(`${rel(full)} — valid`);
}

for (const skill of skillDirs) {
  const full = path.join(REPO_ROOT, "skills", skill, "SKILL.md");
  const content = await fs.readFile(full, "utf8").catch(() => null);
  if (content === null) {
    bad(`${rel(full)} — SKILL.md not found`);
    continue;
  }
  const parsed = parseFrontmatter(content);
  const errors = validateFields(parsed?.fields ?? null, SKILL_REQUIRED, skill);
  if (errors.length) bad(`${rel(full)} — ${errors.join("; ")}`);
  else ok(`${rel(full)} — valid`);
}

// --- MCP servers -----------------------------------------------------------

if (mcpServers.length) {
  console.log("\nMCP servers:");
  for (const server of mcpServers) {
    const full = path.join(REPO_ROOT, "mcp", server.file);
    if (server.error) {
      bad(`${rel(full)} — ${server.error}`);
      continue;
    }
    const errors = validateServer(server.def);
    if (errors.length) bad(`${rel(full)} — ${errors.join("; ")}`);
    else ok(`${rel(full)} — valid`);
  }
}

// --- User install (informational) ------------------------------------------

console.log(`\nUser install at ${USER_CLAUDE}:`);
if (!(await exists(USER_CLAUDE))) {
  info("no ~/.claude/ directory — run scripts/install for your platform");
} else {
  const installedAgents = [];
  const installedSkills = [];
  for (const file of agentFiles) {
    if (await exists(path.join(USER_CLAUDE, "agents", file))) {
      installedAgents.push(file.replace(/\.md$/, ""));
    }
  }
  for (const skill of skillDirs) {
    if (await exists(path.join(USER_CLAUDE, "skills", skill, "SKILL.md"))) {
      installedSkills.push(skill);
    }
  }
  if (installedAgents.length === 0 && installedSkills.length === 0) {
    info("no agentry content installed — run scripts/install for your platform");
  } else {
    for (const name of installedAgents) ok(`${name} (agent)`);
    for (const name of installedSkills) ok(`${name} (skill)`);
    const missingAgents = agentFiles
      .map((f) => f.replace(/\.md$/, ""))
      .filter((n) => !installedAgents.includes(n));
    const missingSkills = skillDirs.filter((n) => !installedSkills.includes(n));
    for (const name of missingAgents) info(`${name} (agent) not installed`);
    for (const name of missingSkills) info(`${name} (skill) not installed`);
  }
}

console.log("");
if (failed) {
  console.log("One or more checks failed.");
  process.exit(1);
}
console.log("All checks passed.");
