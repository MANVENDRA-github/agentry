# Reference

This is the developer reference for the agentry repo — a per-file, per-module, per-flow map of what the codebase does. Read this when you need to know *exactly* what a given script does, where a given file lives, or what the sync engine touches in what order.

For the why behind the shape, see [`decisions.md`](./decisions.md). For high-level design, see [`architecture.md`](./architecture.md). For how to write new content, see [`authoring.md`](./authoring.md). This document does not restate any of that — it cross-references.

## Repo file inventory

| Path | Kind | What it is |
|---|---|---|
| `agents/<name>.md` | source | Authored agents (Claude-style frontmatter + body). Edit here. |
| `skills/<name>/SKILL.md` | source | Authored skills (frontmatter + body, may bundle siblings). Edit here. |
| `commands/<name>.md` | source | Authored slash commands. Edit here. |
| `rules/<category>/<name>.md` | source | Authored rules, namespaced by category (language identifier or topic). Edit here. |
| `hooks/<name>.{sh,js}` | source | Authored harness hooks (scripts). Edit here. |
| `scripts/sync-harnesses.js` | tool | Sync engine. Generates `.claude/`, `.cursor/`, `.codex/`, `.opencode/` from sources. |
| `scripts/frontmatter.js` | tool | Shared YAML-ish frontmatter parser and validation helpers. |
| `scripts/cursor-transform.js` | tool | `toCursorRule`, `globsForLanguage` — Cursor `.mdc` rule transform and language-glob mapping. |
| `scripts/codex-transform.js` | tool | `renameSkill`, `agentToSkill`, `ruleToSkill` — Codex adapter transforms. |
| `scripts/opencode-transform.js` | tool | `agentToOpenCodeAgent`, `commandToOpenCode` — OpenCode adapter transforms. |
| `scripts/lint-frontmatter.js` | tool | `npm run lint` — fail-on-invalid frontmatter check. |
| `scripts/doctor.js` | tool | `npm run doctor` — installation health check. |
| `scripts/install.sh` | installer | POSIX installer (Unix/macOS). |
| `scripts/install.ps1` | installer | PowerShell installer (Windows). |
| `tests/*.test.js` | test | Unit tests run by `npm test` using Node's `node:test` runner. |
| `docs/architecture.md` | doc | High-level design and adapter pattern. |
| `docs/authoring.md` | doc | How to author new agents, skills, rules. |
| `docs/decisions.md` | doc | Numbered design decisions with rationale. |
| `docs/reference.md` | doc | This document. |
| `.claude/` | generated | Claude Code adapter output. **Do not edit.** Wiped on sync. |
| `.cursor/` | generated | Cursor adapter output. **Do not edit.** Wiped on sync. |
| `.codex/` | generated | Codex adapter output. **Do not edit.** Wiped on sync. |
| `.opencode/` | generated | OpenCode adapter output. **Do not edit.** Wiped on sync. |
| `.claude-plugin/plugin.json` | generated | Claude Code plugin manifest. Written by `syncClaude`. |
| `.github/workflows/sync-check.yml` | ci | Three-job CI workflow (sync determinism, lint, tests). |
| `.gitignore` | config | Tracks generated harness dirs; ignores Claude Code per-user state. |
| `package.json` | config | npm scripts, Node engine requirement, project metadata. |
| `README.md` | doc | Project overview and install. End-user entry point. |
| `CONTRIBUTING.md` | doc | Contributor workflow and rejection criteria. |
| `CLAUDE.md` | doc | AI assistant operating guidance for this repo. |
| `CHANGELOG.md` | doc | Per-version changes. |

## Source-of-truth content types

Four content types ship today. Each lives in a separate top-level directory and has its own frontmatter contract. For the how-to-author flow, see [`authoring.md`](./authoring.md); this section documents the contract only.

### Agent

- **Location:** `agents/<name>.md`. Filename without `.md` must equal the `name:` field.
- **Required frontmatter:** `name` (kebab-case), `description` (≥ 20 chars), `tools` (literal string, typically a bracketed list like `[Read, Grep, Bash]`), `model` (typically `sonnet`).
- **Optional frontmatter:** none recognized today. Extra fields are preserved by the sync engine for Claude Code and Cursor; dropped by Codex.
- **Body:** Markdown. Becomes the agent's system prompt in Claude Code, copied verbatim to Cursor, converted to a skill body for Codex.

### Skill

- **Location:** `skills/<name>/SKILL.md`. Directory name must equal the `name:` field. Siblings of `SKILL.md` (e.g. `scripts/`, `references/`) are copied through to Claude Code and Codex.
- **Required frontmatter:** `name`, `description` (≥ 20 chars).
- **Optional frontmatter:** none recognized today. Extra fields pass through.
- **Body:** Procedural markdown. Loaded into context when the skill matches.

### Command

- **Location:** `commands/<name>.md`. Filename becomes the slash-command name (`/<name>`).
- **Required frontmatter:** `description`. (Claude Code does not require `name` for commands.)
- **Optional frontmatter:** `argument-hint` (string shown in the command prompt UI).
- **Body:** Markdown instructions that run when the user invokes `/<name>`. `$ARGUMENTS` is substituted at invocation time.
- **Harness support:** Claude Code only. Cursor and Codex skip commands — see [`decisions.md`](./decisions.md) D8.

### Rule

- **Location:** `rules/<category>/<rule-name>.md`. Category is a language identifier (`typescript`, `python`, `go`) or topic (`security`, `performance`).
- **Required frontmatter:** `name` (matches filename without `.md`), `description` (≥ 20 chars).
- **Optional frontmatter:** `language` (forward-compatible field; not yet used to derive Cursor globs).
- **Body:** Tight, single-concern guidance. No code samples.
- **Harness support:** Claude Code (verbatim copy), Cursor (`.mdc` with `alwaysApply: false`). Codex deferred to v0.4.

## Module reference (`scripts/`)

### `sync-harnesses.js`

The sync entry point. Parses CLI flags, dispatches to one or more adapters, and writes the harness-specific tree.

- **No exports.** Side-effect-only script invoked by `npm run sync`.
- **Internal structure:**
  - `SOURCES` — map of source directory absolute paths (agents, skills, commands, rules).
  - `ALL_TARGETS` — `["claude", "cursor", "codex"]`.
  - `parseTargets(value)` — splits a comma list of targets, separates valid from unknown.
  - File helpers — `rel`, `exists`, `readDirSafe`, `copyFile`, `writeFile`, `rmGenerated`, `copyTree`. All respect `--dry-run`.
  - Adapters — `syncClaude`, `syncCursor`, `syncCodex` (documented inline with JSDoc).
  - `ADAPTERS` — dispatch map from target name to adapter function.
- **Imports:** `node:fs/promises`, `node:path`, `node:url`, and the two transform modules. No third-party deps.

### `frontmatter.js`

Shared frontmatter parser and validation helpers. Three call sites: `lint-frontmatter.js`, `doctor.js`, and `cursor-transform.js` (via `codex-transform.js` too).

- **`parseFrontmatter(content)`** — Parses the leading `---...---` block. Returns `{ fields, body, raw }` or `null` if no block is detected. Accepts CRLF. Treats array-shaped values (`tools: [Read, Grep]`) as literal strings — no structured array parsing.
- **`checkRequired(fields, requiredKeys)`** — Returns the subset of `requiredKeys` absent or empty in `fields`. Preserves input key order.
- **`checkDescription(desc, minLength = 20)`** — Returns `"missing or empty"`, `"too short (N chars, minimum M)"`, or `null` when valid.

### `cursor-transform.js`

- **`toCursorRule(content, opts = {})`** — Translates source skill or rule content to a Cursor `.mdc` rule. Behaviors:
  - No frontmatter in source → wraps content in a new block with the optional `globs` and `alwaysApply: false`.
  - Frontmatter without `alwaysApply` → appends `globs` (when provided and absent) and `alwaysApply: false` to the existing block.
  - Frontmatter already declaring `alwaysApply` or `globs` → preserved as-is (no duplication).
  - Body is separated from the closing `---` by exactly one blank line, regardless of source spacing.
- **`globsForLanguage(language)`** — Returns the comma-separated Cursor glob patterns for a language identifier (from `LANGUAGE_GLOBS`), or `null` if unmapped. Case-insensitive.
- **`LANGUAGE_GLOBS`** — The language → globs map (TypeScript, Python, Go, Rust, and others).
- **Imports:** `parseFrontmatter` from `frontmatter.js`.

### `codex-transform.js`

- **`renameSkill(content, newName)`** — Rewrites only the `name:` line. All other fields and body preserved verbatim. Returns `null` if source has no frontmatter.
- **`agentToSkill(content, newName)`** — Strips an agent's frontmatter down to `name` (set to `newName`) and `description`. Drops `tools`, `model`, and any other fields. Body preserved verbatim. Returns `null` if source has no frontmatter.
- **`ruleToSkill(content, newName)`** — Converts a rule to a Codex skill: `name` (set to `newName`) and `description`, dropping rule-specific fields like `language`. Description falls back to the first `# ` heading, then a generic label, so a rule with no frontmatter still produces a described skill. Never returns `null`.
- **Imports:** `parseFrontmatter` from `frontmatter.js`.

### `opencode-transform.js`

- **`agentToOpenCodeAgent(content)`** — Translates an agent to OpenCode's shape: keeps `description`, adds `mode: subagent`, drops `name` (filename-derived), `tools`, and `model`. Body preserved verbatim. Returns `null` if source has no frontmatter.
- **`commandToOpenCode(content)`** — Keeps `description`, drops `argument-hint`. Body — including `$ARGUMENTS` — preserved verbatim. Returns `null` if source has no frontmatter.
- **Imports:** `parseFrontmatter` from `frontmatter.js`.

### `lint-frontmatter.js`

The `npm run lint` script. Iterates every `agents/*.md` and `skills/<name>/SKILL.md`, validates the frontmatter, exits 0 if all pass and 1 if any fail.

- **No exports.**
- **Internal functions:** `lintAgent(file)`, `lintSkill(skillDir)`, plus a local `rel`/`readDirSafe` pair.
- **Coverage caveat:** lints agents and skills only. Commands and rules are not linted by this script today.

### `doctor.js`

The `npm run doctor` script. Reports the health of sources, generated dirs, frontmatter, and the user's Claude Code install.

- **No exports.**
- **Checks performed:**
  - Source directories — agents and skills exist and are non-empty.
  - Generated `.claude/` and `.cursor/` contain the expected file per source. (Note: this script predates v0.3 and does not check `.codex/` output or the rules directory.)
  - Frontmatter on every agent and skill — own `validateFields` helper, not `frontmatter.js`'s `checkRequired`.
  - User install at `~/.claude/` — lists installed agents and skills, flags missing ones. (Does not check Cursor or Codex installs.)
- **Exit:** 0 if every required check passes, 1 on failure.

## Sync flow walkthrough

What happens when you run `npm run sync` (or `node scripts/sync-harnesses.js`).

### CLI parsing

Flags recognized:

- `--dry-run` — log every operation as `[dry]` without touching the filesystem.
- `--target <name>` or `--target=<name>` — restrict to one target. Comma lists are supported (`--target claude,cursor`).
- Unknown flags set `process.exitCode = 1` and are reported to stderr but do not abort.
- Unknown targets are collected and reported at the start of `main()` but do not abort the run.

Default behavior with no `--target` flag runs all four adapters in order: `claude`, `cursor`, `codex`, `opencode`.

### Per-adapter steps

**`syncClaude()`** — runs in this order:

1. Wipe `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/rules/`. Does **not** wipe the parent `.claude/` (Claude Code stores per-user state there — see [`decisions.md`](./decisions.md) D5).
2. Copy each `agents/<name>.md` to `.claude/agents/<name>.md` verbatim.
3. Copy each `skills/<name>/` directory tree (including siblings of `SKILL.md`) to `.claude/skills/<name>/`.
4. Copy each `commands/<name>.md` to `.claude/commands/<name>.md` verbatim.
5. For each `rules/<category>/<name>.md`, copy to `.claude/rules/<category>/<name>.md` verbatim.
6. Write `.claude-plugin/plugin.json` with the inline manifest (name, version, description, author, license).

**`syncCursor()`** — runs in this order:

1. Wipe the entire `.cursor/` directory. Cursor stores no per-user state in this tree.
2. Copy each `agents/<name>.md` to `.cursor/agents/agentry-<name>.md` (prefix avoids collisions with the user's own Cursor agents — see [`decisions.md`](./decisions.md) D6).
3. For each `skills/<name>/SKILL.md`, run `toCursorRule` and write to `.cursor/rules/<name>.mdc`.
4. For each `rules/<category>/<name>.md`, run `toCursorRule` and write to `.cursor/rules/<category>/<name>.mdc` (the category subdirectory is preserved).

**`syncCodex()`** — runs in this order:

1. Wipe `.codex/agents/skills/` only. Does **not** wipe the parent `.codex/` (Codex stores `config.toml` there).
2. For each `skills/<name>/SKILL.md`, run `renameSkill(content, "agentry-<name>")` and write to `.codex/agents/skills/agentry-<name>/SKILL.md`. Copy any sibling files/directories alongside `SKILL.md` verbatim into the same target directory.
3. For each `agents/<name>.md`, run `agentToSkill(content, "agentry-<name>")` and write to `.codex/agents/skills/agentry-<name>/SKILL.md`.
4. Commands and rules are skipped — see [`decisions.md`](./decisions.md) D8 and the CHANGELOG entry for v0.3.

### Dry-run vs real-run

In `--dry-run` mode, each file-helper logs `  [dry] <relative-path>` and returns without touching the filesystem. The wipe step logs `  [dry] clean <relative-path>`. Final line is `Dry run complete.` instead of `Sync complete.`. The sync flow is otherwise identical — directory iteration, frontmatter transforms, and target dispatching all run normally.

### Idempotence

Running `npm run sync` twice produces a byte-identical tree. CI enforces this via `git diff --exit-code` after sync — see "CI" below.

## Install flow walkthrough

Installers are POSIX shell (`scripts/install.sh`) and PowerShell (`scripts/install.ps1`). They are intentionally parallel: same flags, same logic, same source→destination mapping.

### Flag matrix

| Target | Scopes supported | Default scope | Source dir | Subdirs copied |
|---|---|---|---|---|
| `claude` | `--user`, `--project` | `--user` | `.claude/` | `agents`, `skills`, `commands`, `rules` |
| `cursor` | `--project` only | `--project` | `.cursor/` | `agents`, `rules` |
| `codex` | `--user`, `--project` | `--user` | `.codex/agents/` | `skills` |

### Destination per scope

| Target + scope | Destination |
|---|---|
| `claude --user` | `$HOME/.claude/` (Unix) or `$env:USERPROFILE\.claude\` (Windows) |
| `claude --project` | `$PWD/.claude/` |
| `cursor --project` | `$PWD/.cursor/` |
| `codex --user` | `$HOME/.agents/` (Unix) or `$env:USERPROFILE\.agents\` (Windows) |
| `codex --project` | `$PWD/.agents/` |
| `cursor --user` | Rejected with an explicit error: Cursor has no user-level config dir. |

### Install algorithm

For each subdir in the target's subdir list:

1. Skip if the source subdir does not exist in the repo.
2. Create the destination subdir (`mkdir -p` / `New-Item -Force`).
3. For each entry in the source subdir, copy to the destination, overwriting if it already exists. Subdirectories are removed first then copied recursively so stale files do not survive.
4. Log each created path.

The script aborts if the generated source directory is missing — it prompts the user to run `npm run sync` first.

### Uninstall algorithm

`--uninstall` (or `-Uninstall` on PowerShell) removes only entries whose names match entries currently in the repo's generated dir. User-authored files in the destination are preserved. This is name-based, not content-based: a file the user wrote that shares a name with an agentry file would be removed. Practically rare given the `agentry-` prefix on Cursor and Codex outputs, but worth knowing.

## Frontmatter validation rules (lint)

`npm run lint` validates every agent and skill. The lint script's behavior is:

### Per-agent checks (`agents/<file>.md`)

- Frontmatter block must be present (lines opening with `---` and closing with `---`).
- All of `name`, `description`, `tools`, `model` must be present and non-empty.
- `name` must equal the filename without `.md`.
- `description` must be ≥ 20 characters.

### Per-skill checks (`skills/<dir>/SKILL.md`)

- `SKILL.md` must exist inside the skill directory.
- Frontmatter block must be present.
- All of `name`, `description` must be present and non-empty.
- `name` must equal the skill directory name.
- `description` must be ≥ 20 characters.

### What lint does not check today

- Commands frontmatter.
- Rules frontmatter.
- Body content rules (length, voice, marketing tone).
- Frontmatter on generated harness files — only sources are linted.

## Test inventory

Tests are run by `npm test` using Node's built-in `node:test` runner. No external test framework is installed.

### `tests/frontmatter.test.js` — 23 cases

Covers `parseFrontmatter`, `checkRequired`, `checkDescription`:

- `parseFrontmatter` — null when no frontmatter present; null when opening `---` has no closing; simple key/value pairs; CRLF line endings; body preserved with and without a leading blank line; empty body when content ends at closing `---`; `raw` returns inner text without delimiters; array-shaped values preserved as literal strings; non-kv lines skipped; whitespace trimmed; blank lines inside the block tolerated; description value containing a colon parses correctly.
- `checkRequired` — all-present returns `[]`; missing keys reported; empty string treated as missing; output order matches `requiredKeys`; extra fields ignored.
- `checkDescription` — null for ≥ 20 chars; null at exactly 20; `too short` for shorter; `missing or empty` for `undefined`/empty; custom `minLength` honored.

### `tests/cursor-transform.test.js` — 16 cases

Covers `toCursorRule`, `globsForLanguage`:

- No-frontmatter input → wrapped with new `alwaysApply: false` block.
- Frontmatter without `alwaysApply` → field appended.
- Frontmatter with `alwaysApply: true` → preserved unchanged.
- Frontmatter with `alwaysApply: false` → no duplicate added.
- Indented `alwaysApply` detected (the detector uses `/^\s*alwaysApply\s*:/m`).
- Blank line inserted between closing `---` and body when source has none.
- Existing blank line preserved.
- With-blank-line and no-blank-line sources produce identical output (normalization).
- Additional frontmatter fields (`tags`, etc.) preserved verbatim.
- `globs` injected before `alwaysApply` when provided; not duplicated when already declared; null globs ignored; added in the no-frontmatter case; absent when no opts passed (skills unaffected).
- `globsForLanguage` maps known languages case-insensitively and returns `null` for unknown or missing.

### `tests/codex-transform.test.js` — 19 cases

Covers `renameSkill`, `agentToSkill`, `ruleToSkill`:

- `renameSkill` — name field updated; description and extra fields preserved; body verbatim; CRLF tolerated; null on no-frontmatter input; fields starting with `name` (e.g. `namespace`) untouched.
- `agentToSkill` — `tools` dropped; `model` dropped; `name` set to new value; description preserved; body verbatim including code blocks and headings; output is a valid SKILL.md structure; extra agent-only fields dropped; null on no-frontmatter input.
- `ruleToSkill` — `language` dropped, name/description kept; body verbatim; description falls back to the first heading, then a generic label; never returns `null`.

### `tests/opencode-transform.test.js` — 8 cases

Covers `agentToOpenCodeAgent`, `commandToOpenCode`:

- `agentToOpenCodeAgent` — `mode: subagent` set and `description` kept; `name`/`tools`/`model` dropped; body verbatim including code blocks; a colon-containing description preserved; null on no-frontmatter input.
- `commandToOpenCode` — `description` kept and `argument-hint` dropped; `$ARGUMENTS` preserved in the body; null on no-frontmatter input.

## Configuration reference

### `package.json` scripts

| Script | Command | Purpose |
|---|---|---|
| `sync` | `node scripts/sync-harnesses.js` | Regenerate all harness directories from source. |
| `sync:dry` | `node scripts/sync-harnesses.js --dry-run` | Log what sync would do without touching the filesystem. |
| `doctor` | `node scripts/doctor.js` | Report installation health. |
| `lint` | `node scripts/lint-frontmatter.js` | Validate frontmatter on agents and skills. |
| `test` | `node --test tests/` | Run unit tests. |

Node engine requirement: `>=18.0.0`. No runtime dependencies; no devDependencies.

### `.gitignore`

Patterns and rationale:

- `node_modules/`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*` — standard Node ignores (project has no deps, but contributor environments may install one transiently).
- `.DS_Store`, `Thumbs.db` — OS metadata.
- `.vscode/`, `.idea/` — editor settings.
- `.claude/settings.local.json` — Claude Code per-user state (permissions cache). The rest of `.claude/` is tracked; this single file is not.

Generated directories `.claude/`, `.cursor/`, `.codex/`, `.claude-plugin/` are tracked deliberately — contributors browsing the repo on GitHub should see what sync produces. The cardinal rule "do not edit generated dirs" is enforced by convention, not by `.gitignore`.

### CI workflow (`.github/workflows/sync-check.yml`)

Three jobs, all on `ubuntu-latest` with Node 20, running on pushes and PRs to `main` and `dev`:

1. **`sync-determinism`** — `npm run sync`, then `git status --porcelain` fails the build if sync produced uncommitted changes. Catches the common contribution mistake of editing source without committing regenerated harness files.
2. **`frontmatter-lint`** — `npm run lint`. Catches malformed agent/skill frontmatter.
3. **`tests`** — `npm test`. Runs the 67 unit tests.

Tests do not block sync-determinism or lint; the three jobs run in parallel. There is no functionality test that exercises the actual sync output against a fixture — sync is verified only by its determinism and by the lint pass on its input.

### Environment variables

None. The scripts read no environment configuration beyond what their CLI flags specify.

## Cross-references

- [`README.md`](../README.md) — project overview, installation, status, roadmap.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — contribution workflow, conventional commits, rejection criteria.
- [`CLAUDE.md`](../CLAUDE.md) — AI assistant operating guidance for the repo.
- [`architecture.md`](./architecture.md) — adapter pattern, sync engine design, source-of-truth layout, settings preservation, Codex adapter narrative.
- [`authoring.md`](./authoring.md) — step-by-step authoring of agents, skills, and rules.
- [`decisions.md`](./decisions.md) — numbered design decisions (D1–D19) with rationale, alternatives, and revisit triggers.
- [`../CHANGELOG.md`](../CHANGELOG.md) — release history and deferred work.
