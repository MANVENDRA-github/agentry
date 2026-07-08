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
| `hooks/<name>.js` | source | Authored harness hooks (Node scripts, seven of them). Edit here. See [Hook reference](#hook-reference). |
| `mcp/<name>.json` | source | Authored MCP server definitions, one per file; filename is the server name. Edit here. |
| `scripts/sync-harnesses.js` | tool | Sync engine. Generates `.claude/`, `.cursor/`, `.codex/`, `.opencode/`, and the MCP config files from sources. |
| `scripts/frontmatter.js` | tool | Shared YAML-ish frontmatter parser and validation helpers. |
| `scripts/cursor-transform.js` | tool | `toCursorRule`, `globsForLanguage` — Cursor `.mdc` rule transform and language-glob mapping. |
| `scripts/codex-transform.js` | tool | `renameSkill`, `agentToSkill`, `ruleToSkill` — Codex adapter transforms. |
| `scripts/opencode-transform.js` | tool | `agentToOpenCodeAgent`, `commandToOpenCode` — OpenCode adapter transforms. |
| `scripts/mcp-transform.js` | tool | `validateServer`, `toMcpServersJson`, `toOpenCodeMcpConfig` — MCP adapter transforms. |
| `scripts/lint-frontmatter.js` | tool | `npm run lint` — frontmatter (agents/skills) and MCP server validation. |
| `scripts/doctor.js` | tool | `npm run doctor` — installation health check. |
| `scripts/install.sh` | installer | POSIX installer (Unix/macOS). |
| `scripts/install.ps1` | installer | PowerShell installer (Windows). |
| `tests/*.test.js` | test | Unit tests run by `npm test` using Node's `node:test` runner. |
| `docs/architecture.md` | doc | High-level design and adapter pattern. |
| `docs/authoring.md` | doc | How to author new agents, skills, rules. |
| `docs/decisions.md` | doc | Numbered design decisions with rationale. |
| `docs/reference.md` | doc | This document. |
| `.claude/{agents,skills,commands,rules,hooks}/` | generated | Claude Code adapter output. **Do not edit.** Wiped on sync. |
| `.cursor/{agents,rules}/` | generated | Cursor adapter output. **Do not edit.** Wiped on sync. |
| `.codex/agents/skills/` | generated | Codex adapter output. **Do not edit.** Wiped on sync. |
| `.opencode/{agents,skills,commands}/` | generated | OpenCode adapter output. **Do not edit.** Wiped on sync. |
| `.claude-plugin/plugin.json` | generated | Claude Code plugin manifest. Written by `syncClaude`; every field read from `package.json`. **Do not edit.** |
| `.mcp.json` | written | Merged MCP server map for Claude Code (project scope, repo root). Written by `syncClaude` when `mcp/` sources exist, **never deleted** — may carry your own servers (D20). |
| `.cursor/mcp.json` | written | Merged MCP server map for Cursor. Written by `syncCursor` when `mcp/` sources exist, **never deleted** — may carry your own servers (D20). |
| `opencode.json` | written | MCP config for OpenCode (repo root, `mcp` key, translated shape). Written by `syncOpenCode` when `mcp/` sources exist, **never deleted** — may carry your own OpenCode config (D20). |
| `.claude/settings.local.json`, `.cursor/environment.json`, `.codex/config.toml` | user state | Per-user harness state at the top of a harness directory. Sync never touches it: an adapter wipes only the subdirectories it generates, never the parent. |
| `.gitattributes` | config | Forces LF line endings (`* text=auto eol=lf`) so sync output is byte-identical across platforms. |
| `.github/workflows/sync-check.yml` | ci | Three-job CI workflow (sync determinism, lint, tests). Scoped to `contents: read`. |
| `.github/workflows/release.yml` | ci | On a `v*` tag push, gates on the same three checks and cuts a GitHub Release from the matching CHANGELOG section (D21). Needs `contents: write`. |
| `.github/dependabot.yml` | ci | Weekly grouped updates for the npm manifest and the GitHub Actions used by the workflows. |
| `.github/PULL_REQUEST_TEMPLATE.md` | doc | Surfaces CONTRIBUTING's three hard PR requirements at the moment a PR is opened. |
| `.github/ISSUE_TEMPLATE/` | doc | `bug_report.yml`, `feature_request.yml` (a proposal form), and `config.yml`, which disables blank issues and routes security reports to a private advisory. |
| `.gitignore` | config | Tracks generated harness dirs; ignores Claude Code per-user state. |
| `package.json` | config | npm scripts, Node engine requirement, and the single source of the project metadata `syncClaude` writes into the plugin manifest. Marked `private` — agentry installs by clone, never from a registry. |
| `README.md` | doc | Project overview and install. End-user entry point. |
| `CONTRIBUTING.md` | doc | Contributor workflow and rejection criteria. |
| `CLAUDE.md` | doc | AI assistant operating guidance for this repo. |
| `CHANGELOG.md` | doc | Per-version changes. |
| `LICENSE` | legal | MIT. |
| `SECURITY.md` | doc | Threat model for a config generator, and the private advisory flow for reporting a vulnerability. |
| `CODE_OF_CONDUCT.md` | doc | Contributor Covenant 2.1. |

## Source-of-truth content types

These content types ship today. Each lives in a separate top-level directory and has its own contract. For the how-to-author flow, see [`authoring.md`](./authoring.md); this section documents the contract only.

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
- **Harness support:** Claude Code and OpenCode. Cursor and Codex skip commands — see [`decisions.md`](./decisions.md) D8.

### Rule

- **Location:** `rules/<category>/<rule-name>.md`. Category is a language identifier (`typescript`, `python`, `go`) or topic (`security`, `performance`).
- **Required frontmatter:** `name` (matches filename without `.md`), `description` (≥ 20 chars).
- **Optional frontmatter:** `language` (used since v0.6 to derive Cursor auto-attach globs — see `globsForLanguage` in `scripts/cursor-transform.js`).
- **Body:** Tight, single-concern guidance. No code samples.
- **Harness support:** Claude Code (verbatim copy); Cursor (`.mdc`, auto-attached via `language`-derived globs since v0.6, otherwise `alwaysApply: false`); Codex (converted to a skill via `ruleToSkill` since v0.6). OpenCode deferred — its rules model is `AGENTS.md` plus the `instructions` config.

### MCP server

- **Location:** `mcp/<name>.json`. Filename without `.json` is the server name (the map key in the harness); there is no name field in the file.
- **Format:** JSON, not frontmatter. The file is the server *definition* object as it appears inside Claude Code / Cursor's `mcpServers` map.
- **Required:** exactly one transport — a non-empty `command` (stdio) or a non-empty `url` (remote).
- **Optional:** `args` (array) and `env` (object) for stdio servers; `type`, auth `headers`, and any other harness-recognized fields for remote servers.
- **Harness support:** Claude Code (`.mcp.json`) and Cursor (`.cursor/mcp.json`) take the `mcpServers` map verbatim; OpenCode (`opencode.json`, `mcp` key) takes a translated shape (`type: local|remote`, `command` array, `environment`, `enabled`). Codex deferred — see [`decisions.md`](./decisions.md) D20.
- **Secrets:** do not inline tokens; reference an environment variable the harness expands (`"env": { "API_KEY": "${TOKEN}" }`).

## Module reference (`scripts/`)

### `sync-harnesses.js`

The sync entry point. Parses CLI flags, dispatches to one or more adapters, and writes the harness-specific tree.

- **No exports.** Side-effect-only script invoked by `npm run sync`.
- **Internal structure:**
  - `SOURCES` — map of source directory absolute paths (agents, skills, commands, rules, hooks, mcp).
  - `ALL_TARGETS` — `["claude", "cursor", "codex", "opencode"]`.
  - `parseTargets(value)` — splits a comma list of targets, separates valid from unknown.
  - File helpers — `rel`, `exists`, `readDirSafe`, `copyFile`, `writeFile`, `rmGenerated`, `copyTree`. All respect `--dry-run`.
  - Adapters — `syncClaude`, `syncCursor`, `syncCodex`, `syncOpenCode` (documented inline with JSDoc).
  - `ADAPTERS` — dispatch map from target name to adapter function.
- **Imports:** `node:fs/promises`, `node:path`, `node:url`, and the four transform modules (`cursor-transform`, `codex-transform`, `opencode-transform`, `mcp-transform`). No third-party deps.

### `frontmatter.js`

Shared frontmatter parser and validation helpers. Call sites: `lint-frontmatter.js`, `doctor.js`, and the `cursor-transform.js`, `codex-transform.js`, and `opencode-transform.js` transforms.

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

### `mcp-transform.js`

- **`validateServer(def)`** — Semantic check for one parsed MCP server definition. Returns an array of error strings (empty if valid): rejects non-objects, requires a non-empty `command` or `url`, and rejects a non-array `args` or non-object `env`. Used by `lint` and `doctor`, not by sync.
- **`toMcpServersJson(servers)`** — Builds `{ "mcpServers": { <name>: def } }` (Claude Code `.mcp.json` and Cursor `.cursor/mcp.json`) from an array of `{ name, def }`. Sorts by name; does not mutate the input. Trailing newline.
- **`toOpenCodeMcpConfig(servers)`** — Builds `{ "$schema": ..., "mcp": { <name>: openCodeDef } }` (OpenCode `opencode.json`), translating each server to OpenCode's shape (`type: local|remote`, `command` array, `environment`, `enabled`). Sorts by name.
- **Imports:** none. Pure functions over plain objects.

### `lint-frontmatter.js`

The `npm run lint` script. Iterates every `agents/*.md`, `skills/<name>/SKILL.md`, and `mcp/<name>.json`, validates each, exits 0 if all pass and 1 if any fail.

- **No exports.**
- **Internal functions:** `lintAgent(file)`, `lintSkill(skillDir)`, `lintMcpServer(file)` (JSON parse + `validateServer`), plus a local `rel`/`readDirSafe` pair.
- **Coverage caveat:** lints agents, skills, and MCP servers. Commands and rules are not linted by this script today. The MCP section header prints only when `mcp/` has sources.

### `doctor.js`

The `npm run doctor` script. Reports the health of sources, generated dirs, frontmatter, and the user's Claude Code install.

- **No exports.**
- **Checks performed:**
  - Source directories — agents and skills exist and are non-empty; hook and MCP-server counts reported (both optional, so absence is informational).
  - Generated `.claude/`, `.cursor/`, and `.opencode/` contain the expected file per source.
  - Generated MCP outputs — `.mcp.json`, `.cursor/mcp.json` (`mcpServers` key), and `opencode.json` (`mcp` key) parse and contain every source server (via `checkMcpOutput`).
  - Frontmatter on every agent and skill — own `validateFields` helper, not `frontmatter.js`'s `checkRequired`.
  - MCP server JSON — each `mcp/<name>.json` parses and passes `validateServer`.
  - User install at `~/.claude/` — lists installed agents and skills, flags missing ones. (Does not check Cursor, Codex, or OpenCode installs.)
- **Exit:** 0 if every required check passes, 1 on failure.

## Hook reference

Seven Node scripts under `hooks/`, copied verbatim into `.claude/hooks/` by `syncClaude`. They sync to Claude Code only; no other harness has a drop-in hooks directory.

**Nothing enables them.** Sync copies the files; you wire each one into `settings.json` yourself as a `PreToolUse` hook with the appropriate `matcher`. Read a hook before you turn it on — each carries its own wiring snippet in its header comment.

**The contract is a process contract**, not a function signature: Claude Code passes the tool call as JSON on stdin; the hook exits `0` to allow and `2` to block, writing the reason to stderr, which Claude sees. Every hook **fails open** — an empty, malformed, or unexpected payload exits `0`. A hook that throws returns non-zero and would block every tool call in the session.

None of them inspects `tool_name`; the `matcher` in `settings.json` is what routes the right calls to them.

| Hook | `matcher` | Blocks |
|---|---|---|
| `protect-generated-dirs` | `Write\|Edit\|MultiEdit` | A write into a generated subdirectory. Names the source file to edit instead. Deliberately allows the per-user state and MCP config files listed in the inventory above. |
| `secret-scan-on-edit` | `Write\|Edit` | Content carrying a credential (AWS key id, GitHub PAT, private-key header). Reads an Edit's `new_string` as well as a Write's `content`. Allows a `process.env` reference and a placeholder in `.env.example`. |
| `block-secret-file-stage` | `Bash` | A `git add` / `git commit -a` that would stage a credential *file*. Resolves pathspecs by asking git (`git add --dry-run`), so the sweeping `git add .` is caught, not just an explicitly named path. Respects `.gitignore`. |
| `block-no-verify` | `Bash` | `--no-verify`, `-n`, `--no-gpg-sign`, `-c commit.gpgsign=false` on a git invocation. |
| `block-force-push` | `Bash` | A force-push to `main`/`master`, including `--force-with-lease`. A feature branch is yours to rewrite. |
| `guard-dangerous-bash` | `Bash` | `rm -rf` of `/`, `/*`, `~`, `$HOME`; `chmod -R 777 /`; `curl \| sh`; `dd of=/dev/sd*`; `mkfs`; the fork bomb. Intentionally narrow — `rm -rf ./build` and `sudo rm -rf /var` are *not* blocked. |
| `protect-lockfile-edit` | `Write\|Edit` | A hand-edit to a dependency lockfile across twelve ecosystems (npm, yarn, pnpm, bun, Cargo, poetry, uv, Pipfile, Gemfile, composer, `go.sum`, npm-shrinkwrap). |

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

1. Wipe `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/rules/`, `.claude/hooks/`. Does **not** wipe the parent `.claude/` (Claude Code stores per-user state there, e.g. `settings.local.json` — see [`decisions.md`](./decisions.md) D5).
2. Copy each `agents/<name>.md` to `.claude/agents/<name>.md` verbatim.
3. Copy each `skills/<name>/` directory tree (including siblings of `SKILL.md`) to `.claude/skills/<name>/`.
4. Copy each `commands/<name>.md` to `.claude/commands/<name>.md` verbatim.
5. For each `rules/<category>/<name>.md`, copy to `.claude/rules/<category>/<name>.md` verbatim. Then copy the `hooks/` tree to `.claude/hooks/`.
6. If `mcp/` has sources, merge them via `loadMcpServers` + `toMcpServersJson` and write `.mcp.json` at the repo root (`mcpServers` map). Written only when sources exist; never deleted.
7. Write `.claude-plugin/plugin.json` with the inline manifest (name, version, description, author, license).

**`syncCursor()`** — runs in this order:

1. Wipe `.cursor/agents/` and `.cursor/rules/`. Does **not** wipe the parent `.cursor/` — Cursor stores per-user state there, notably `environment.json`. (This adapter used to remove the whole tree, which deleted that state on every sync and made the `agentry-` prefix in step 2 pointless: there was nothing left to collide with.)
2. Copy each `agents/<name>.md` to `.cursor/agents/agentry-<name>.md` (prefix avoids collisions with the user's own Cursor agents — see [`decisions.md`](./decisions.md) D6).
3. For each `skills/<name>/SKILL.md`, run `toCursorRule` and write to `.cursor/rules/<name>.mdc`.
4. For each `rules/<category>/<name>.md`, run `toCursorRule` (with `language`-derived globs) and write to `.cursor/rules/<category>/<name>.mdc` (the category subdirectory is preserved).
5. If `mcp/` has sources, write the same `mcpServers` map to `.cursor/mcp.json`. It sits outside the wiped `agents/` and `rules/` namespaces and is never deleted — the same contract as `.mcp.json` and `opencode.json` (D20).

**`syncCodex()`** — runs in this order:

1. Wipe `.codex/agents/skills/` only. Does **not** wipe the parent `.codex/` (Codex stores `config.toml` there).
2. For each `skills/<name>/SKILL.md`, run `renameSkill(content, "agentry-<name>")` and write to `.codex/agents/skills/agentry-<name>/SKILL.md`. Copy any sibling files/directories alongside `SKILL.md` verbatim into the same target directory.
3. For each `agents/<name>.md`, run `agentToSkill(content, "agentry-<name>")`; for each rule, run `ruleToSkill(...)` (since v0.6). Both write to `.codex/agents/skills/agentry-<name>/SKILL.md`.
4. Commands, hooks, and MCP are skipped — see [`decisions.md`](./decisions.md) D8 (commands) and D20 (MCP).

**`syncOpenCode()`** — runs in this order:

1. Wipe `.opencode/agents/`, `.opencode/commands/`, `.opencode/skills/`. Does **not** wipe the parent `.opencode/` (it may hold the user's `opencode.json`).
2. For each `agents/<name>.md`, run `agentToOpenCodeAgent` and write to `.opencode/agents/<name>.md` (no prefix — primitives map 1:1).
3. Copy each `skills/<name>/` tree verbatim to `.opencode/skills/<name>/`.
4. For each `commands/<name>.md`, run `commandToOpenCode` and write to `.opencode/commands/<name>.md`.
5. If `mcp/` has sources, run `toOpenCodeMcpConfig` and write `opencode.json` at the repo root (`mcp` key, translated shape). Written only when sources exist; never deleted. Rules and hooks are deferred.

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
| `opencode` | `--user`, `--project` | `--user` | `.opencode/` | `agents`, `commands`, `skills` |

### Destination per scope

| Target + scope | Destination |
|---|---|
| `claude --user` | `$HOME/.claude/` (Unix) or `$env:USERPROFILE\.claude\` (Windows) |
| `claude --project` | `$PWD/.claude/` |
| `cursor --project` | `$PWD/.cursor/` |
| `codex --user` | `$HOME/.agents/` (Unix) or `$env:USERPROFILE\.agents\` (Windows) |
| `codex --project` | `$PWD/.agents/` |
| `opencode --user` | `$HOME/.config/opencode/` (Unix) or `$env:USERPROFILE\.config\opencode\` (Windows) |
| `opencode --project` | `$PWD/.opencode/` |
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

Tests are run by `npm test` using Node's built-in `node:test` runner. No external test framework is installed. **243 cases across seven files.**

Five of the seven test the transform layer by importing a pure function. The two hook files cannot: a hook is a script whose contract is a process exit code, so those tests spawn the real script as a child process and assert on its status. Importing a function would not prove the hook works.

### `tests/frontmatter.test.js` — 24 cases

Covers `parseFrontmatter`, `checkRequired`, `checkDescription`:

- `parseFrontmatter` — null when no frontmatter present; null when opening `---` has no closing; simple key/value pairs; CRLF line endings; body preserved with and without a leading blank line; empty body when content ends at closing `---`; `raw` returns inner text without delimiters; array-shaped values preserved as literal strings; non-kv lines skipped; whitespace trimmed; blank lines inside the block tolerated; description value containing a colon parses correctly.
- `checkRequired` — all-present returns `[]`; missing keys reported; empty string treated as missing; output order matches `requiredKeys`; extra fields ignored.
- `checkDescription` — null for ≥ 20 chars; null at exactly 20; `too short` for shorter; `missing or empty` for `undefined`/empty; custom `minLength` honored.

### `tests/cursor-transform.test.js` — 17 cases

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
- CRLF invariance — a CRLF source produces the same logical output as its LF twin (no spurious blank line).

### `tests/codex-transform.test.js` — 22 cases

Covers `renameSkill`, `agentToSkill`, `ruleToSkill`:

- `renameSkill` — name field updated; description and extra fields preserved; body verbatim; CRLF tolerated; null on no-frontmatter input; fields starting with `name` (e.g. `namespace`) untouched.
- `agentToSkill` — `tools` dropped; `model` dropped; `name` set to new value; description preserved; body verbatim including code blocks and headings; output is a valid SKILL.md structure; extra agent-only fields dropped; null on no-frontmatter input.
- `ruleToSkill` — `language` dropped, name/description kept; body verbatim; description falls back to the first heading, then a generic label; never returns `null`.
- CRLF invariance — `renameSkill`, `agentToSkill`, and `ruleToSkill` produce the same logical output for a CRLF source as its LF twin (no spurious blank line).

### `tests/opencode-transform.test.js` — 10 cases

Covers `agentToOpenCodeAgent`, `commandToOpenCode`:

- `agentToOpenCodeAgent` — `mode: subagent` set and `description` kept; `name`/`tools`/`model` dropped; body verbatim including code blocks; a colon-containing description preserved; null on no-frontmatter input.
- `commandToOpenCode` — `description` kept and `argument-hint` dropped; `$ARGUMENTS` preserved in the body; null on no-frontmatter input.
- CRLF invariance — both transforms produce the same logical output for a CRLF source as its LF twin.

### `tests/mcp-transform.test.js` — 25 cases

Covers `validateServer`, `toMcpServersJson`, `toOpenCodeMcpConfig`:

- `validateServer` — accepts stdio (command + args), remote (url), and command-plus-env servers; rejects no-transport, empty command, non-array args, non-object env, null, array, and primitive inputs; reports multiple problems at once.
- `toMcpServersJson` — wraps under `mcpServers`; preserves the definition verbatim; sorts by name; output independent of input order; does not mutate the caller's array; 2-space indent with trailing newline; empty list yields an empty map.
- `toOpenCodeMcpConfig` — wraps under `$schema` + `mcp`; maps stdio to `type: local` with a `command` array and folds `env` into `environment`; maps remote to `type: remote` with `url` + `headers`; sorts by name; trailing newline.

### `tests/protect-generated-dirs.test.js` — 49 cases

Spawns `hooks/protect-generated-dirs.js` and asserts on its exit code (`0` allow, `2` block).

- Every generated subdirectory blocks — including the three `.opencode/` ones, which went unprotected from v0.7.0 until the hook was corrected.
- Source files, the three MCP config files, and per-user harness state (`.claude/settings.local.json`, `.cursor/environment.json`, `.codex/config.toml`) are allowed — sync preserves them, so a hand-edit is legitimate.
- Windows separators and absolute paths normalize; `notebook_path` is read alongside `file_path`.
- Each block message names the correct source file to edit instead.
- Empty stdin, malformed JSON, `{}`, a missing `tool_input`, and a null `file_path` all exit `0` — fail open.

### `tests/hooks.test.js` — 96 cases

Characterizes the other six guards, pinning both what they block *and* what they deliberately do not, so a later edit to a regex or a pathspec parser cannot silently widen or narrow a guard.

- `block-no-verify`, `block-force-push`, `guard-dangerous-bash`, `protect-lockfile-edit`, `secret-scan-on-edit` — table-driven block/allow pairs, including the boundaries called out in the [Hook reference](#hook-reference) (a feature branch may be force-pushed; `rm -rf ./build` is not catastrophic).
- `block-secret-file-stage` resolves pathspecs by asking git, so it is exercised against a **real temporary repository** holding a real `.env` and `server.key`: an explicit add, the sweeping `git add .` and `-A`, `--dry-run` staging nothing, and a gitignored file ceasing to be flagged.
- All six are asserted to fail open across seven malformed-payload shapes — 42 of the cases here.

## Configuration reference

### `package.json` scripts

| Script | Command | Purpose |
|---|---|---|
| `sync` | `node scripts/sync-harnesses.js` | Regenerate all harness directories from source. |
| `sync:dry` | `node scripts/sync-harnesses.js --dry-run` | Log what sync would do without touching the filesystem. |
| `doctor` | `node scripts/doctor.js` | Report installation health. |
| `lint` | `node scripts/lint-frontmatter.js` | Validate frontmatter on agents and skills, plus MCP server JSON. |
| `test` | `node --test` | Run unit tests (built-in discovery finds `tests/*.test.js`; no path arg, so it works across Node 20 and 24). |

Node engine requirement: `>=18.0.0`. No runtime dependencies; no devDependencies.

### `.gitignore`

Patterns and rationale:

- `node_modules/`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*` — standard Node ignores (project has no deps, but contributor environments may install one transiently).
- `.DS_Store`, `Thumbs.db` — OS metadata.
- `.vscode/`, `.idea/` — editor settings.
- `.claude/settings.local.json` — Claude Code per-user state (permissions cache). The rest of `.claude/` is tracked; this single file is not.

Generated directories `.claude/`, `.cursor/`, `.codex/`, `.claude-plugin/` are tracked deliberately — contributors browsing the repo on GitHub should see what sync produces. The cardinal rule "do not edit generated dirs" is enforced by convention, not by `.gitignore`.

### CI workflow (`.github/workflows/sync-check.yml`)

Three jobs, all on `ubuntu-latest` with Node 24, running on pushes and PRs to `main` and `dev`:

1. **`sync-determinism`** — `npm run sync`, then `git status --porcelain` fails the build if sync produced uncommitted changes. Catches the common contribution mistake of editing source without committing regenerated harness files.
2. **`frontmatter-lint`** — `npm run lint`. Catches malformed agent/skill frontmatter.
3. **`tests`** — `npm test`. Runs the 243 unit tests.

Scoped to `permissions: contents: read` — no job here writes a comment, a commit, or a release. Tests do not block sync-determinism or lint; the three jobs run in parallel. There is no functionality test that exercises the actual sync output against a fixture — sync is verified only by its determinism and by the lint pass on its input.

### Release workflow (`.github/workflows/release.yml`)

Triggered by a `v*` tag push. Needs `permissions: contents: write` because it creates a Release.

1. **Verify the tag matches `package.json`** — a `vX.Y.Z` tag whose version disagrees with the manifest fails here.
2. **Gate on the same three checks** — `npm run sync` must produce zero drift, then `npm run lint` and `npm test`.
3. **Extract the CHANGELOG section** for that version, and `gh release create` with it as the notes.

Two things to know before tagging. A tag push runs the workflow file **as it existed at the tagged commit**, so a tag older than this workflow fires nothing and its Release must be created by hand. And only the last commit of a release cycle is sync-clean: `chore(release): X` bumps the version while the regenerated output lands in the following `chore(sync): regenerate harness outputs for X`. Tag that one.

### Environment variables

None. The scripts read no environment configuration beyond what their CLI flags specify.

## Cross-references

- [`README.md`](../README.md) — project overview, installation, status, roadmap.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — contribution workflow, conventional commits, rejection criteria.
- [`CLAUDE.md`](../CLAUDE.md) — AI assistant operating guidance for the repo.
- [`architecture.md`](./architecture.md) — adapter pattern, sync engine design, source-of-truth layout, settings preservation, Codex adapter narrative.
- [`authoring.md`](./authoring.md) — step-by-step authoring of agents, skills, and rules.
- [`decisions.md`](./decisions.md) — numbered design decisions (D1–D20) with rationale, alternatives, and revisit triggers.
- [`../CHANGELOG.md`](../CHANGELOG.md) — release history and deferred work.
