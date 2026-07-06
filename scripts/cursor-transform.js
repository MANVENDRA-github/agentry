// agentry — Cursor adapter transform.
//
// Source skills use Claude-style frontmatter (`name`, `description`). Cursor's
// closest primitive is a `.mdc` rule; we add `alwaysApply: false` so the rule
// is available on-demand but not auto-injected. This is a v0.1 approximation —
// Cursor has no first-class skill concept and the semantics differ slightly.
// See docs/decisions.md D4 for the rationale and trade-off.
//
// Language rules can additionally carry `globs`. A rule with `globs` and
// `alwaysApply: false` is "Auto Attached" in Cursor: it activates only when a
// file matching the globs is in context. That is the context-triggered
// auto-apply the README and CHANGELOG flagged as deferred — now wired up by
// deriving globs from the rule's `language` field (or its category directory).

import { parseFrontmatter } from "./frontmatter.js";

// Map a language identifier to the Cursor glob patterns that should auto-attach
// a rule for that language. Comma-separated, no brackets — the format Cursor's
// `.mdc` `globs` field expects. Extend this as new language rules are added.
export const LANGUAGE_GLOBS = {
  typescript: "**/*.ts,**/*.tsx",
  javascript: "**/*.js,**/*.jsx,**/*.mjs,**/*.cjs",
  python: "**/*.py",
  go: "**/*.go",
  rust: "**/*.rs",
  java: "**/*.java",
  ruby: "**/*.rb",
  php: "**/*.php",
  swift: "**/*.swift",
  kotlin: "**/*.kt,**/*.kts",
  csharp: "**/*.cs",
  cpp: "**/*.cpp,**/*.cc,**/*.hpp,**/*.h",
  sql: "**/*.sql",
  bash: "**/*.sh,**/*.bash,**/*.zsh",
  powershell: "**/*.ps1,**/*.psm1,**/*.psd1",
  c: "**/*.c",
  yaml: "**/*.yml,**/*.yaml",
  terraform: "**/*.tf,**/*.tfvars",
};

/**
 * Glob patterns for a language identifier, or `null` if the language is not
 * mapped (the rule then stays `alwaysApply: false` with no globs — opt-in).
 *
 * @param {string | undefined} language
 * @returns {string | null}
 */
export function globsForLanguage(language) {
  if (!language) return null;
  return LANGUAGE_GLOBS[language.toLowerCase()] ?? null;
}

/**
 * Translate source skill or rule content into a Cursor `.mdc` rule.
 *
 * Behavior:
 *  - If `content` has no frontmatter, wrap the entire content in a new
 *    block whose only fields are the optional `globs` and `alwaysApply: false`.
 *  - If `content` has frontmatter without `alwaysApply`, append `globs`
 *    (when provided and not already present) and `alwaysApply: false` to the
 *    existing block. Other fields and the body are preserved verbatim.
 *  - If `content` has frontmatter that already declares `alwaysApply` or
 *    `globs`, the existing declaration is preserved (no duplication).
 *  - The body is separated from the closing `---` by exactly one blank
 *    line, regardless of how the source was spaced or line-ended. The
 *    leading-newline test accepts CRLF as well as LF so a source with
 *    Windows line endings does not gain a spurious extra blank line.
 *
 * @param {string} content
 * @param {{ globs?: string | null }} [opts]
 * @returns {string}
 */
export function toCursorRule(content, opts = {}) {
  const globs = opts.globs ?? null;
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    const fields = [globs ? `globs: ${globs}` : null, "alwaysApply: false"]
      .filter(Boolean)
      .join("\n");
    return `---\n${fields}\n---\n\n${content}`;
  }
  const { raw, body } = parsed;
  const additions = [];
  if (globs && !/^\s*globs\s*:/m.test(raw)) additions.push(`globs: ${globs}`);
  if (!/^\s*alwaysApply\s*:/m.test(raw)) additions.push("alwaysApply: false");
  const newFrontmatter = [raw, ...additions].join("\n");
  return `---\n${newFrontmatter}\n---\n${/^\r?\n/.test(body) ? "" : "\n"}${body}`;
}
