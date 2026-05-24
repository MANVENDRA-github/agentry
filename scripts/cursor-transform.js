// agentry — Cursor adapter transform.
//
// Source skills use Claude-style frontmatter (`name`, `description`). Cursor's
// closest primitive is a `.mdc` rule; we add `alwaysApply: false` so the rule
// is available on-demand but not auto-injected. This is a v0.1 approximation —
// Cursor has no first-class skill concept and the semantics differ slightly.
// See docs/decisions.md D4 for the rationale and trade-off.

import { parseFrontmatter } from "./frontmatter.js";

/**
 * Translate source skill content into a Cursor `.mdc` rule.
 *
 * Behavior:
 *  - If `content` has no frontmatter, wrap the entire content in a new
 *    block whose only field is `alwaysApply: false`.
 *  - If `content` has frontmatter without `alwaysApply`, append the field
 *    to the existing block. Other fields and body are preserved verbatim.
 *  - If `content` has frontmatter that already declares `alwaysApply`,
 *    the existing declaration is preserved (no duplication).
 *  - The body is separated from the closing `---` by exactly one blank
 *    line, regardless of how the source was spaced.
 *
 * @param {string} content
 * @returns {string}
 */
export function toCursorRule(content) {
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    return `---\nalwaysApply: false\n---\n\n${content}`;
  }
  const { raw, body } = parsed;
  const hasAlwaysApply = /^\s*alwaysApply\s*:/m.test(raw);
  const newFrontmatter = hasAlwaysApply ? raw : `${raw}\nalwaysApply: false`;
  return `---\n${newFrontmatter}\n---\n${body.startsWith("\n") ? "" : "\n"}${body}`;
}
