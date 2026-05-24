// agentry — frontmatter parsing and validation helpers.
//
// One implementation shared by three call sites:
//   - scripts/lint-frontmatter.js  (validation pass on agents and skills)
//   - scripts/doctor.js            (parser only; doctor has its own
//                                   validateFields with different output)
//   - scripts/cursor-transform.js  (parser only; uses raw + body to rebuild
//                                   the file with alwaysApply: false)
//
// Format: a single YAML-ish frontmatter block at the top of the file,
// delimited by `---` lines. Inside: one `key: value` per line. Arrays like
// `tools: [Read, Grep]` are kept as a literal string — agents and skills do
// not rely on structured array parsing.

const MIN_DESCRIPTION_LEN = 20;

/**
 * Parse a frontmatter block from the start of `content`.
 *
 * @param {string} content - File content with optional `---...---` block.
 * @returns {{ fields: Object, body: string, raw: string } | null}
 *   `null` if no frontmatter detected. Otherwise:
 *   - `fields`: map of key→trimmed-value strings.
 *   - `body`:   everything after the closing `---` (and its optional
 *               trailing newline).
 *   - `raw`:    the text between the delimiters, no leading or trailing
 *               newlines around the `---` markers.
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const raw = match[1];
  const body = content.slice(match[0].length);
  const fields = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    fields[m[1]] = m[2].trim();
  }
  return { fields, body, raw };
}

/**
 * Names of required keys missing from `fields` (absent or empty string).
 *
 * @param {Object} fields
 * @param {string[]} requiredKeys
 * @returns {string[]}
 */
export function checkRequired(fields, requiredKeys) {
  const missing = [];
  for (const key of requiredKeys) {
    if (!(key in fields) || fields[key] === "") missing.push(key);
  }
  return missing;
}

/**
 * Validate description length. Returns an error string or `null` if valid.
 *
 * @param {string | undefined} desc
 * @param {number} [minLength=20]
 * @returns {string | null}
 */
export function checkDescription(desc, minLength = MIN_DESCRIPTION_LEN) {
  if (!desc) return "missing or empty";
  if (desc.length < minLength) {
    return `too short (${desc.length} chars, minimum ${minLength})`;
  }
  return null;
}
