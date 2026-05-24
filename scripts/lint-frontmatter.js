#!/usr/bin/env node
// agentry — validate frontmatter on every agent and skill.
//
// Checks:
//   - Frontmatter block is present and parseable.
//   - Required fields are present (agents: name, description, tools, model;
//     skills: name, description).
//   - `name` matches the filename (or skill directory name).
//   - `description` is non-empty and at least 20 characters.
//
// Usage:
//   node scripts/lint-frontmatter.js
//
// Exits 0 if all checks pass, 1 if any file is invalid.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const AGENT_REQUIRED = ["name", "description", "tools", "model"];
const SKILL_REQUIRED = ["name", "description"];
const MIN_DESCRIPTION_LEN = 20;

function rel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join("/");
}

// Minimal line-based frontmatter parser. Handles `key: value` pairs and
// `key: [a, b, c]` arrays. Does not handle multi-line YAML — descriptions
// are kept on a single line by convention.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    fields[m[1]] = m[2].trim();
  }
  return fields;
}

async function readDirSafe(p) {
  try {
    return await fs.readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

function checkRequired(fields, required) {
  const missing = [];
  for (const key of required) {
    if (!(key in fields) || fields[key] === "") missing.push(key);
  }
  return missing;
}

function checkDescription(desc) {
  if (!desc) return "missing or empty";
  if (desc.length < MIN_DESCRIPTION_LEN) {
    return `too short (${desc.length} chars, minimum ${MIN_DESCRIPTION_LEN})`;
  }
  return null;
}

const failures = [];

async function lintAgent(file) {
  const fullPath = path.join(REPO_ROOT, "agents", file);
  const expectedName = file.replace(/\.md$/, "");
  const content = await fs.readFile(fullPath, "utf8");
  const fields = parseFrontmatter(content);
  if (!fields) {
    failures.push({ file: rel(fullPath), errors: ["no frontmatter block"] });
    console.log(`  ✗ ${rel(fullPath)} — no frontmatter`);
    return;
  }
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
  const fields = parseFrontmatter(content);
  if (!fields) {
    failures.push({ file: rel(fullPath), errors: ["no frontmatter block"] });
    console.log(`  ✗ ${rel(fullPath)} — no frontmatter`);
    return;
  }
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

if (failures.length) {
  console.log(`\n${failures.length} file(s) failed validation.`);
  process.exit(1);
}
console.log("\nAll frontmatter valid.");
