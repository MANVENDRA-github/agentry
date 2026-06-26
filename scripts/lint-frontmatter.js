#!/usr/bin/env node
// agentry — validate source content: frontmatter on every agent and skill,
// and the JSON shape of every MCP server.
//
// Checks (agents and skills):
//   - Frontmatter block is present and parseable.
//   - Required fields are present (agents: name, description, tools, model;
//     skills: name, description).
//   - `name` matches the filename (or skill directory name).
//   - `description` is non-empty and at least 20 characters.
//
// Checks (MCP servers):
//   - File is valid JSON.
//   - Server declares a transport: a non-empty `command` (stdio) or `url`
//     (remote); `args`/`env`, if present, have the right shape.
//
// Usage:
//   node scripts/lint-frontmatter.js
//
// Exits 0 if all checks pass, 1 if any file is invalid.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFrontmatter,
  checkRequired,
  checkDescription,
} from "./frontmatter.js";
import { validateServer } from "./mcp-transform.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const AGENT_REQUIRED = ["name", "description", "tools", "model"];
const SKILL_REQUIRED = ["name", "description"];

function rel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join("/");
}

async function readDirSafe(p) {
  try {
    return await fs.readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

const failures = [];

async function lintAgent(file) {
  const fullPath = path.join(REPO_ROOT, "agents", file);
  const expectedName = file.replace(/\.md$/, "");
  const content = await fs.readFile(fullPath, "utf8");
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    failures.push({ file: rel(fullPath), errors: ["no frontmatter block"] });
    console.log(`  ✗ ${rel(fullPath)} — no frontmatter`);
    return;
  }
  const { fields } = parsed;
  const errors = [];
  const missing = checkRequired(fields, AGENT_REQUIRED);
  if (missing.length) errors.push(`missing required: ${missing.join(", ")}`);
  if (fields.name && fields.name !== expectedName) {
    errors.push(`name '${fields.name}' does not match filename '${expectedName}'`);
  }
  const descErr = checkDescription(fields.description);
  if (descErr) errors.push(`description: ${descErr}`);
  if (errors.length) {
    failures.push({ file: rel(fullPath), errors });
    console.log(`  ✗ ${rel(fullPath)} — ${errors.join("; ")}`);
  } else {
    console.log(`  ✓ ${rel(fullPath)} — valid`);
  }
}

async function lintSkill(skillDir) {
  const fullPath = path.join(REPO_ROOT, "skills", skillDir, "SKILL.md");
  const content = await fs.readFile(fullPath, "utf8").catch(() => null);
  if (content === null) {
    failures.push({ file: rel(fullPath), errors: ["SKILL.md not found"] });
    console.log(`  ✗ ${rel(fullPath)} — SKILL.md not found`);
    return;
  }
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    failures.push({ file: rel(fullPath), errors: ["no frontmatter block"] });
    console.log(`  ✗ ${rel(fullPath)} — no frontmatter`);
    return;
  }
  const { fields } = parsed;
  const errors = [];
  const missing = checkRequired(fields, SKILL_REQUIRED);
  if (missing.length) errors.push(`missing required: ${missing.join(", ")}`);
  if (fields.name && fields.name !== skillDir) {
    errors.push(`name '${fields.name}' does not match directory '${skillDir}'`);
  }
  const descErr = checkDescription(fields.description);
  if (descErr) errors.push(`description: ${descErr}`);
  if (errors.length) {
    failures.push({ file: rel(fullPath), errors });
    console.log(`  ✗ ${rel(fullPath)} — ${errors.join("; ")}`);
  } else {
    console.log(`  ✓ ${rel(fullPath)} — valid`);
  }
}

async function lintMcpServer(file) {
  const fullPath = path.join(REPO_ROOT, "mcp", file);
  const raw = await fs.readFile(fullPath, "utf8").catch(() => null);
  if (raw === null) {
    failures.push({ file: rel(fullPath), errors: ["file not readable"] });
    console.log(`  ✗ ${rel(fullPath)} — not readable`);
    return;
  }
  let def;
  try {
    def = JSON.parse(raw);
  } catch (err) {
    failures.push({ file: rel(fullPath), errors: [`invalid JSON: ${err.message}`] });
    console.log(`  ✗ ${rel(fullPath)} — invalid JSON: ${err.message}`);
    return;
  }
  const errors = validateServer(def);
  if (errors.length) {
    failures.push({ file: rel(fullPath), errors });
    console.log(`  ✗ ${rel(fullPath)} — ${errors.join("; ")}`);
  } else {
    console.log(`  ✓ ${rel(fullPath)} — valid`);
  }
}

console.log("agentry lint — frontmatter validation\n");

console.log("Agents:");
const agentEntries = await readDirSafe(path.join(REPO_ROOT, "agents"));
for (const entry of agentEntries) {
  if (entry.isFile() && entry.name.endsWith(".md")) {
    await lintAgent(entry.name);
  }
}

console.log("\nSkills:");
const skillEntries = await readDirSafe(path.join(REPO_ROOT, "skills"));
for (const entry of skillEntries) {
  if (entry.isDirectory()) {
    await lintSkill(entry.name);
  }
}

// MCP servers are optional — only print the section when sources exist so a
// repo without MCP servers does not show an empty heading.
const mcpEntries = (await readDirSafe(path.join(REPO_ROOT, "mcp"))).filter(
  (entry) => entry.isFile() && entry.name.endsWith(".json"),
);
if (mcpEntries.length) {
  console.log("\nMCP servers:");
  for (const entry of mcpEntries) {
    await lintMcpServer(entry.name);
  }
}

if (failures.length) {
  console.log(`\n${failures.length} file(s) failed validation.`);
  process.exit(1);
}
console.log("\nAll frontmatter valid.");
