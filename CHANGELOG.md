# Changelog

All notable changes to agentry are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] — MCP server sync

A new content type: Model Context Protocol server configs, authored once and synced to the harnesses that read a portable `mcpServers` map.

### Added

**Content type:**
- `mcp/` source directory. One harness-neutral server definition per file (`mcp/<name>.json`); the filename is the server name. Stdio (`command` / `args` / `env`) and remote (`type` / `url`) transports are supported.
- Claude Code receives all servers merged into `.mcp.json` at the repo root (project scope); Cursor receives the identical `mcpServers` map at `.cursor/mcp.json`. Servers are sorted by name for byte-stable output. Codex is deferred — it stores servers as TOML in a shared `config.toml`.
- One MCP server (`mcp/filesystem.json`) ships as the pattern proof.

**Modules:**
- `scripts/mcp-transform.js` — `validateServer` (semantic check) and `toMcpServersJson` (merge + sort + serialize).

**Tooling:**
- `npm run lint` now validates `mcp/*.json`: valid JSON plus a declared transport, with `args` / `env` shape checks. The section runs only when MCP sources exist.
- `npm run doctor` reports the MCP server count, confirms the generated `.mcp.json` / `.cursor/mcp.json` contain every source server, and validates each source.

**Docs:**
- "Authoring an MCP server" in `docs/authoring.md`; the MCP adapter narrative in `docs/architecture.md`; decision D20 in `docs/decisions.md`; contract, module, flow, and test entries in `docs/reference.md`.

### Changed

- `syncClaude` and `syncCursor` gained an MCP step; `loadMcpServers` is shared between them. `.mcp.json` is the first generated artifact written outside a harness namespace directory: it is written only when sources exist and is never deleted — agentry must not clobber a `.mcp.json` a user authored by hand.
- Plugin manifest version bumped to `0.6.0`.

### Fixed

- **Cross-platform sync determinism (CRLF).** The Cursor and Codex transforms tested `body.startsWith("\n")` to decide whether to insert the blank line after the frontmatter. On a source checked out with Windows line endings (`core.autocrlf=true`), the body started with `\r\n`, the test failed, and an extra blank line was emitted — so `npm run sync` on Windows produced spurious diffs in every generated `.mdc` and `SKILL.md`. The separator test now accepts a leading CRLF, and a new `.gitattributes` (`* text=auto eol=lf`) normalizes the working tree to LF so the transforms always see LF input. Sync is now byte-identical across platforms.

### Tests

- 18 new cases in `tests/mcp-transform.test.js` (65 total): `validateServer` accept/reject paths and `toMcpServersJson` wrapping, verbatim preservation, name sorting, order-independence, no-mutation, formatting, and empty-list behavior.

### Deferred

- **Codex MCP support.** Codex stores servers as TOML under `[mcp_servers.<name>]` in its shared `config.toml`; a safe merge needs a TOML serializer and is deferred. See `docs/decisions.md` D20.
- **MCP install.** The installers are not extended to place `.mcp.json` / `.cursor/mcp.json` — installing means merging into a user's existing MCP config without clobbering their own servers, which needs its own design. See `docs/decisions.md` D20.

## [0.5.0] — research and design content

Two universal additions completing the dev-loop core: research before coding, and structural design before implementation. Content-only release with no infrastructure changes.

### Added

**Agents:**
- `architect` — system and module design decisions (boundaries, responsibilities, data flow, trade-offs). Distinct from `planner`, which sequences the implementation once the structure is decided.

**Skills:**
- `search-first` — research-before-coding methodology; search the codebase, docs, and dependencies for existing solutions before writing new code.

**Commands** (Claude Code only):
- `/architect` — slash-command wrapper for the `architect` agent.

### Changed

- README "What's inside" expanded with the new agent, skill, and command.

## [0.4.0] — code creation and maintenance content

Curated content filling the creation and maintenance half of the workflow — restructuring existing code, writing documentation, and adding tests to code that already exists. No infrastructure changes.

### Added

**Agents:**
- `refactorer` — restructures existing code without changing its behavior; the actor counterpart to `code-reviewer`.
- `doc-writer` — writes and maintains documentation, keeping it accurate to the code.

**Skills:**
- `test-writing` — adds tests to existing untested code, characterizing current behavior. Distinct from `tdd-workflow`, which drives new code test-first.

**Commands** (Claude Code only):
- `/refactor`, `/document` — slash-command wrappers for the two new agents.

### Changed

- README "What's inside" table expanded with the new agents, skill, and commands.
- Plugin manifest version bumped to `0.4.0`.

## [0.3.0] — Codex adapter, rules pattern, and test coverage

### Added

**Harness adapters:**
- Codex CLI support (`--target codex`). Source skills sync near-verbatim to `.codex/agents/skills/agentry-<name>/SKILL.md`; source agents are converted to Codex skills (Codex has no markdown-agent primitive — `tools` and `model` are dropped, body becomes the skill body). Commands are skipped (no user-extensible slash commands in Codex; `$skill-name` invocation serves the analogous purpose).
- The `agentry-` prefix is applied to every generated Codex skill — directory name and frontmatter `name` field both — to avoid collision with user-authored Codex skills.

**Content:**
- `rules/` source directory pattern, namespaced by category (language identifier like `typescript` or `python`, or topic like `security`). Claude Code receives rules verbatim at `.claude/rules/<category>/<rule-name>.md`; Cursor receives them as `.mdc` rules with `alwaysApply: false` at `.cursor/rules/<category>/<rule-name>.mdc`.
- One TypeScript rule (`rules/typescript/strict-mode.md`) as the pattern proof — strict-mode discipline covering the eight strict flags, when to resist disabling, and the standard remediation responses.

**Modules:**
- `scripts/frontmatter.js` — shared frontmatter parser and validation helpers (`parseFrontmatter`, `checkRequired`, `checkDescription`), extracted from the previously-duplicated copies in `lint-frontmatter.js`, `doctor.js`, and `sync-harnesses.js`.
- `scripts/cursor-transform.js` — `toCursorRule` extracted from `sync-harnesses.js`.
- `scripts/codex-transform.js` — `renameSkill` and `agentToSkill` for the Codex adapter.

**Tooling:**
- `npm test` script using Node's built-in `node:test` runner. No external test framework added.
- CI workflow grew a third job (`tests`) running `npm test` alongside `sync-determinism` and `frontmatter-lint`.
- Install scripts (`install.sh`, `install.ps1`) accept `--target codex` / `-Target codex`. Default scope is user; `--project` is supported.

**Docs:**
- "Authoring a rule" section in `docs/authoring.md`.
- "The Codex adapter" section in `docs/architecture.md`.

### Changed

- `sync-harnesses.js` refactored to use the extracted modules. Output is byte-identical to v0.2 for Claude Code and Cursor; Codex output is new.
- `.claude/rules/` joined the `syncClaude` wipe list alongside `agents/`, `skills/`, and `commands/`.
- Plugin manifest version bumped to `0.3.0`.
- README, architecture doc, and authoring guide updated to reflect three-harness support and rules as an active content type.

### Tests

- 47 unit tests across three modules:
  - `tests/frontmatter.test.js` — parser edge cases (CRLF, empty body, missing frontmatter, blank lines, array-shaped values, description containing a colon), `checkRequired`, `checkDescription`.
  - `tests/cursor-transform.test.js` — `toCursorRule` behavior across the four frontmatter cases plus body-separator normalization.
  - `tests/codex-transform.test.js` — `renameSkill` preservation and `agentToSkill` field drop / body preservation.

### Deferred

- **Codex rules support.** Codex has its own rules concept and the source-to-Codex-rule mapping needs dedicated investigation. Targeted for v0.4.
- **Cursor `globs`-derived auto-apply for language rules.** The `language` frontmatter field is captured but not yet used to derive context-triggered application. All rules currently ship as `alwaysApply: false` (opt-in). Targeted for v0.4.

## [0.2.0] — infrastructure and content expansion

### Added

**Infrastructure and docs:**
- `CHANGELOG.md`, `CONTRIBUTING.md`.
- `docs/architecture.md` — sync design and adapter pattern.
- `docs/authoring.md` — how to write new agents and skills.
- `.github/workflows/sync-check.yml` — CI that catches sync drift and frontmatter errors.
- `scripts/doctor.js` (`npm run doctor`) — install and source health check.
- `scripts/lint-frontmatter.js` (`npm run lint`) — frontmatter validation.

**Agents:**
- `planner` — produces implementation plans before code is written.
- `debugger` — hypothesis-driven root-cause investigation.
- `pr-describer` — generates PR descriptions from a diff.

**Skills:**
- `session-handoff` — structured handoff notes for resuming work.
- `git-commit-craft` — conventional commits with explained motivation.
- `error-debugging` — in-conversation debugging discipline (companion to the `debugger` agent).
- `code-review` — self-review discipline (companion to the `code-reviewer` agent).

**Commands** (Claude Code only):
- `/plan`, `/review`, `/debug`, `/commit`, `/handoff` — slash-command wrappers for the most-used agents and skills.

### Changed

- `package.json` adds `doctor` and `lint` npm scripts.
- Plugin manifest version bumped to `0.2.0`.

## [0.1.0] — initial release

### Added

- Source-of-truth directories: `agents/`, `skills/`.
- Sync engine (`scripts/sync-harnesses.js`) with adapters for Claude Code and Cursor.
- One agent: `code-reviewer` — correctness, security, maintainability, conventions.
- One skill: `tdd-workflow` — red-green-refactor with discipline checks.
- Installers: `scripts/install.sh` (Unix/macOS), `scripts/install.ps1` (Windows).
- Plugin manifest at `.claude-plugin/plugin.json` for Claude Code.

### Architecture

- Single source of truth in top-level directories; generated harness directories are regenerated on every sync.
- v0.1 supports two harnesses (Claude Code, Cursor); more planned for v0.3+.
