// agentry — OpenCode adapter transforms.
//
// OpenCode is the closest harness to Claude Code: it has native `agents`,
// `commands`, and `skills` primitives, all authored as markdown with
// frontmatter, read from `.opencode/<kind>/` (project) and
// `~/.config/opencode/<kind>/` (global). The subdirectory names are plural
// (`agents/`, `commands/`, `skills/`) in current OpenCode; singular forms are
// kept only for backwards compatibility, so agentry emits the plural form.
//
// Because the primitives line up, the mapping is near-verbatim — like Claude
// Code, and unlike Cursor (skills -> rules) or Codex (agents -> skills). Two
// small frontmatter translations are still needed:
//
//   - Agents: OpenCode derives the agent name from the filename and expects a
//     `mode` (all | primary | subagent). agentry's agents are subagents, so we
//     emit `mode: subagent` and keep `description`. The `name` field is dropped
//     (filename-derived), and `tools` / `model` are dropped because their
//     shapes differ from OpenCode's: Claude Code's `tools` is an allow-list
//     array while OpenCode's is a permission map, and `model: sonnet` is a
//     Claude Code shorthand, not an OpenCode `provider/model` id. Dropping both
//     lets the subagent inherit safe defaults rather than emit invalid config.
//     (Deriving an OpenCode permission map from the allow-list is a possible
//     future enhancement.)
//
//   - Commands: OpenCode commands are markdown with a `description` and a body
//     prompt that supports `$ARGUMENTS` — the same convention agentry uses. We
//     keep `description` and drop `argument-hint` (a Claude Code-only field).
//
// Skills need no transform: OpenCode uses the same Agent Skills format
// (`name` + `description` frontmatter, body, bundled sibling files), so the
// sync engine copies them verbatim.

import { parseFrontmatter } from "./frontmatter.js";

/**
 * Convert an agentry agent file into an OpenCode agent markdown file. The
 * resulting frontmatter has `description` and `mode: subagent`; `name`,
 * `tools`, `model`, and any other fields are dropped (see module header). The
 * body is preserved verbatim as the agent's system prompt.
 *
 * @param {string} content - Raw agent .md content.
 * @returns {string | null} New agent content, or null if the source has no
 *   frontmatter.
 */
export function agentToOpenCodeAgent(content) {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;
  const { fields, body } = parsed;
  const description = fields.description ?? "";
  const newRaw = `description: ${description}\nmode: subagent`;
  return `---\n${newRaw}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}

/**
 * Convert an agentry command file into an OpenCode command markdown file. Keeps
 * `description`; drops `argument-hint` (Claude Code-only) and any other fields.
 * The body — including `$ARGUMENTS`, which OpenCode also supports — is
 * preserved verbatim.
 *
 * @param {string} content - Raw command .md content.
 * @returns {string | null} New command content, or null if the source has no
 *   frontmatter.
 */
export function commandToOpenCode(content) {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;
  const { fields, body } = parsed;
  const description = fields.description ?? "";
  const newRaw = `description: ${description}`;
  return `---\n${newRaw}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}
