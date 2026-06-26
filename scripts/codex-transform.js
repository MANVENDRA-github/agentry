// agentry — Codex adapter transforms.
//
// Codex's skill format is close to agentry's source format: a directory with
// SKILL.md (frontmatter + body), optional scripts/, references/, assets/
// subdirectories. The mapping for source skills is therefore near-verbatim —
// only the `name` field is rewritten to add the `agentry-` prefix that
// prevents collision with user-authored Codex skills.
//
// Codex does NOT have an analog to Claude Code's `agents/<name>.md`. Subagents
// are role-based and configured inline in `config.toml`. To make agentry's
// agents reachable from Codex, we convert each agent file into a Codex skill:
// the agent's `name` and `description` are kept, `tools` and `model` are
// dropped (Codex skills do not understand them), and the body becomes the
// skill's instructions. This is an approximation — same pattern as the Cursor
// skill→rule transform. See docs/decisions.md for the rationale.

import { parseFrontmatter } from "./frontmatter.js";

/**
 * Rewrite the `name:` field of a source SKILL.md to `newName`, preserving
 * every other frontmatter field and the body verbatim.
 *
 * @param {string} content - Raw SKILL.md content.
 * @param {string} newName - Prefixed name to set (e.g. "agentry-tdd-workflow").
 * @returns {string | null} New content, or null if the source has no frontmatter.
 */
export function renameSkill(content, newName) {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;
  const { raw, body } = parsed;
  const newRaw = raw.replace(/^name\s*:.*$/m, `name: ${newName}`);
  return `---\n${newRaw}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

/**
 * Convert an agentry agent file into a Codex SKILL.md. The resulting
 * frontmatter has only `name` (set to `newName`) and `description`; `tools`,
 * `model`, and any other agent-specific fields are dropped. The body is
 * preserved verbatim.
 *
 * @param {string} content - Raw agent .md content.
 * @param {string} newName - Prefixed name to set (e.g. "agentry-planner").
 * @returns {string | null} New SKILL.md content, or null if the source has
 *   no frontmatter.
 */
export function agentToSkill(content, newName) {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;
  const { fields, body } = parsed;
  const description = fields.description ?? "";
  const newRaw = `name: ${newName}\ndescription: ${description}`;
  return `---\n${newRaw}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

/**
 * Convert an agentry rule into a Codex SKILL.md. Codex has no rules primitive
 * distinct from skills, so a rule becomes a skill — the same approximation
 * pattern as agentToSkill. The resulting frontmatter keeps only `name` (set to
 * `newName`) and `description`; rule-specific fields such as `language` are
 * dropped. The body is preserved verbatim.
 *
 * Unlike agents and skills, a rule may have no frontmatter at all (a plain
 * markdown guideline). In that case the whole content becomes the body and the
 * description falls back to the first `# ` heading, then to a generic label —
 * so the conversion never produces an emptily-described skill.
 *
 * @param {string} content - Raw rule .md content.
 * @param {string} newName - Prefixed name to set (e.g. "agentry-typescript-strict-mode").
 * @returns {string} New SKILL.md content.
 */
export function ruleToSkill(content, newName) {
  const parsed = parseFrontmatter(content);
  const body = parsed ? parsed.body : content;
  const heading = body.match(/^#\s+(.+)$/m);
  const description =
    parsed?.fields.description || (heading ? heading[1].trim() : "") || `${newName} rule`;
  const newRaw = `name: ${newName}\ndescription: ${description}`;
  return `---\n${newRaw}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}
