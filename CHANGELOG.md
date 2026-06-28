# Changelog

All notable changes to agentry are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.0] — comprehension and hardening content

Curated content for the parts of the loop agentry hadn't reached: understanding code you didn't write, judging whether tests protect anything, and hardening a system for the real world. Content-only release; all components language- and framework-neutral (D9), each held to the curation bar (D10) — the universal gaps, not a catalog import from the maximalist alternatives.

### Added

**Agents:**
- `code-explorer` — maps an unfamiliar codebase: entry points, the path an operation takes end to end, what each layer owns, and the few key abstractions, every hop anchored to file:line. The comprehension counterpart to `architect` (which designs new structure) and `planner` (which sequences a change) — it describes the shape that already exists.
- `test-reviewer` — reviews existing tests for whether they actually protect behavior: real assertions over mock calls, edges and failure paths covered, not brittle or tautological. Complements `tdd-workflow`/`test-writing`, which write tests, with a quality lens; reports false confidence and coverage gaps, not a coverage percentage.
- `performance-optimizer` — executes the `perf-profiling` discipline end to end: baseline, profile to locate the real bottleneck, one minimal change, re-measure on the same harness, behavior held constant. Returns a verified before/after, not a speculative rewrite. Where the skill is the method, the agent is the actor — the same pairing as `debugger`/`error-debugging`.

**Skills:**
- `security-review` — walk the threat model of your own change before shipping it: untrusted input to every sink, an authz check on every new action, secrets out of source and logs, vetted crypto, dependency risk. The in-conversation companion to the `security-reviewer` agent, completing the agent↔skill pairing `code-review`/`error-debugging` already follow.
- `observability` — make a system debuggable from the outside: structured logs at the right levels with correlating context, metrics you'd actually alert on, tracing across boundaries, and never secrets or PII in a log line.
- `mcp-authoring` — build a Model Context Protocol server a model can use well: descriptions as the contract, schemas as guardrails, errors as instructions, transport chosen for the deployment, secrets from the environment. On-brand — agentry already ships and syncs `mcp/`.
- `data-modeling` — design and evolve a data model deliberately: entities and relationships, stable keys, indexing for the real access patterns, constraints in the schema, and expand-and-contract change you can roll out safely. Store-agnostic.
- `resilience` — design for failure on purpose: timeouts on every boundary, bounded retries with backoff and jitter, idempotency where you retry a write, circuit breakers, and graceful degradation. Pairs with `observability`.

**Commands** (Claude Code & OpenCode):
- `/explore`, `/review-tests`, `/optimize` — wrappers for the three new agents.

### Changed

- README "What's inside" expanded with the three agents and five skills; the command count is now eighteen (`/explore`, `/review-tests`, `/optimize` added).
- The "Status and limitations" summary, stale since v0.7.0 ("nine agents, nine skills, eleven commands"), corrected to the current counts — fifteen agents, eighteen skills, eighteen commands, one rule, one hook, one MCP server — and the test count refreshed to 98.
- Plugin manifest version bumped to `0.11.0`.

## [0.10.0] — maintain-and-ship content

Curated content completing the maintenance and release half of the dev loop — keeping dependencies current, moving the codebase between states safely, and writing a release for the reader who has to act on it. Content-only release; all components language- and framework-neutral (D9), each held to the curation bar (D10).

### Added

**Agents:**
- `dependency-upgrader` — upgrades dependencies safely and incrementally: one package or group at a time, reads the breaking changes for the versions it crosses, applies the required code changes, and re-runs the build and tests after each. Returns a green build with each upgrade explained, not one giant lockfile bump.
- `migrator` — plans and executes a migration (data, schema, API version, framework, config format) as small, reversible steps via expand/contract, parallel run, or an adapter, keeping old and new working through the transition. Returns a staged migration with a rollback path, not a big-bang rewrite.

**Skills:**
- `release-notes` — turn a release's commits and PRs into notes written for the person deciding whether to upgrade: grouped by impact, breaking changes and their migration steps first, not a raw `git log` dump. Completes the commit (`git-commit-craft`) → PR (`pr-describer`) → release authoring story.

**Commands** (Claude Code & OpenCode):
- `/upgrade-deps`, `/migrate`, `/release-notes` — wrappers for the two new agents and the new skill.

### Changed

- README "What's inside" expanded with the two agents, skill, and three commands; the command count is now fifteen.
- Plugin manifest version bumped to `0.10.0`.

## [0.9.0] — loop-coverage content

Curated content closing the universal gaps in the dev loop — end-to-end testing, performance work, context management, and learning capture. Content-only release; no infrastructure changes. All components are language- and framework-neutral (D9), and each earns its place against the curation bar (D10): the additions are the loop stages neither agentry nor the maximalist alternatives covered, not a catalog import.

### Added

**Agents:**
- `e2e-runner` — generates, maintains, and runs end-to-end and integration tests for real user journeys. Framework-agnostic (uses whatever harness the repo has), flakiness-averse (waits on conditions, quarantines rather than deletes, captures artifacts). Complements `tdd-workflow`/`test-writing`, which stay at the unit level.

**Skills:**
- `perf-profiling` — fix a performance problem by measurement: baseline → profile to locate the bottleneck → one minimal change → re-measure on the same harness → confirm behavior unchanged. The discipline against optimizing by guess.
- `strategic-compact` — compact the working context deliberately at task boundaries instead of letting it auto-truncate at an arbitrary point, preserving the decisions that matter over the recency the threshold keeps.
- `continuous-learning` — turn a hard-won session insight into a durable, reusable note before the context scrolls away. Pairs naturally with a session-end (Stop) hook, but stands on its own as a discipline.

**Commands** (Claude Code & OpenCode):
- `/e2e` — slash-command wrapper for the `e2e-runner` agent.

### Changed

- README "What's inside" expanded with the new agent, three skills, and command; the command count is now twelve.
- Plugin manifest version bumped to `0.9.0`.

## [0.8.0] — MCP server sync

A new content type: Model Context Protocol server configs, authored once and synced to every harness that reads a JSON server map — Claude Code, Cursor, and OpenCode.

### Added

**Content type:**
- `mcp/` source directory. One harness-neutral server definition per file (`mcp/<name>.json`); the filename is the server name. Stdio (`command` / `args` / `env`) and remote (`type` / `url`) transports are supported.
- **Claude Code** and **Cursor** receive the servers merged verbatim into `.mcp.json` (repo root) and `.cursor/mcp.json` — the same `mcpServers` map both read.
- **OpenCode** receives `opencode.json` (repo root) under the `mcp` key, translated to OpenCode's shape: `type: local|remote`, a single `command` array, an `environment` map, an `enabled` flag.
- Servers are sorted by name for byte-stable output. **Codex** is deferred — it stores servers as TOML in a shared `config.toml`.
- One MCP server (`mcp/filesystem.json`) ships as the pattern proof.

**Modules:**
- `scripts/mcp-transform.js` — `validateServer` (semantic check), `toMcpServersJson` (Claude/Cursor merge), and `toOpenCodeMcpConfig` (OpenCode merge + per-server transform).

**Tooling:**
- `npm run lint` validates `mcp/*.json` (valid JSON + a declared transport, with `args` / `env` shape checks); the section runs only when MCP sources exist.
- `npm run doctor` reports the MCP server count and confirms `.mcp.json`, `.cursor/mcp.json`, and `opencode.json` each contain every source server.

**Docs:**
- "Authoring an MCP server" in `docs/authoring.md`; MCP adapter narrative in `docs/architecture.md`; decision D20 in `docs/decisions.md`; contract, module, flow, and test entries in `docs/reference.md`.

### Changed

- `syncClaude`, `syncCursor`, and `syncOpenCode` gained an MCP step; `loadMcpServers` is shared between them. `.mcp.json` and `opencode.json` are the generated artifacts written outside a harness namespace directory: each is written only when sources exist and is never deleted — agentry must not clobber a config a user authored by hand (`opencode.json` especially, since it holds far more than MCP).
- Plugin manifest version bumped to `0.8.0`.

### Fixed

- **Cross-platform sync determinism (CRLF).** The Cursor, Codex, and OpenCode transforms tested `body.startsWith("\n")` to decide whether to insert the blank line after the frontmatter. On a source checked out with Windows line endings (`core.autocrlf=true`), the body started with `\r\n`, the test failed, and an extra blank line was emitted — so `npm run sync` on Windows produced spurious diffs in every generated `.mdc`, `SKILL.md`, and OpenCode agent/command. The separator test now accepts a leading CRLF, and a new `.gitattributes` (`* text=auto eol=lf`) normalizes the working tree to LF so the transforms always see LF input. Sync is now byte-identical across platforms.

### Tests

- 31 new cases (98 total): `validateServer`, `toMcpServersJson`, and `toOpenCodeMcpConfig` in `tests/mcp-transform.test.js`, plus CRLF-vs-LF invariance regression tests for the Cursor, Codex, and OpenCode transforms.

### Deferred

- **Codex MCP support.** Codex stores servers as TOML under `[mcp_servers.<name>]` in its shared `config.toml`; a safe merge needs a TOML serializer and is deferred. See `docs/decisions.md` D20.
- **MCP install.** The installers are not extended to place the generated MCP files — installing means merging into a user's existing config without clobbering their own servers, which needs its own design. See `docs/decisions.md` D20.

## [0.7.0] — OpenCode adapter

A fourth harness. OpenCode CLI has native agents, commands, and skills, so the mapping is near-verbatim — the closest of any harness to Claude Code, and the only other one that receives agentry's slash commands.

### Added

**Harness adapter:**
- OpenCode support (`--target opencode`). `syncOpenCode` generates into `.opencode/` with plural subdirectories (`agents/`, `commands/`, `skills/`), matching current OpenCode (singular forms are backwards-compat only).
  - **Agents** → `.opencode/agents/<name>.md`: frontmatter translated to OpenCode's shape — `description` kept, `mode: subagent` added, and `name` / `tools` / `model` dropped (Claude Code's `tools` allow-list and `model: sonnet` shorthand do not match OpenCode's permission-map and `provider/model` forms).
  - **Skills** → `.opencode/skills/<name>/`: copied verbatim, including bundled sibling files. OpenCode uses the same Agent Skills format.
  - **Commands** → `.opencode/commands/<name>.md`: `argument-hint` dropped, `$ARGUMENTS` body preserved. OpenCode is the only harness besides Claude Code with user-extensible commands.
  - No `agentry-` prefix — like Claude Code, OpenCode's primitives map 1:1, so content keeps its names and the command→agent references stay intact.

**Modules:**
- `scripts/opencode-transform.js` — `agentToOpenCodeAgent` and `commandToOpenCode`.

**Tooling:**
- Install scripts accept `--target opencode` / `-Target opencode`. Default scope is user (`~/.config/opencode/`); `--project` installs to `.opencode/`.
- `doctor.js` checks the generated `.opencode/` tree against sources.

### Changed

- `ALL_TARGETS` and the `ADAPTERS` map gained `opencode`.
- Plugin manifest and `package.json` version bumped to `0.7.0`.
- README and architecture doc updated: four-harness data flow, a "The OpenCode adapter" section, and a note that commands now reach Claude Code *and* OpenCode.

### Tests

- 67 unit tests (up from 59). Added `tests/opencode-transform.test.js`: `agentToOpenCodeAgent` (mode set, field drops, body and colon-in-description preservation, null on no frontmatter) and `commandToOpenCode` (description kept, `argument-hint` dropped, `$ARGUMENTS` preserved).

### Deferred

- **OpenCode rules and hooks.** OpenCode's rules model is `AGENTS.md` plus the `instructions` config — a separate mapping from a per-file rules directory. Hooks have no OpenCode drop-in directory. Both are deferred.
- **OpenCode agent tool permissions.** `tools` is dropped rather than translated into OpenCode's permission map; deriving it from the source allow-list is a possible future enhancement.

## [0.6.0] — hooks pipeline, command coverage, and completed rule mappings

Closes the gaps the previous releases flagged as deferred: hooks become a real content type, the new agents get command wrappers, and the two rule mappings parked at v0.3 (Cursor auto-apply globs, Codex rules) are now implemented.

### Added

**Content type — hooks:**
- `hooks/` source directory. `syncClaude` copies hook scripts verbatim into `.claude/hooks/`; the user references a hook from `settings.json` to enable it. Hooks sync to Claude Code only — Cursor and Codex have no drop-in hooks directory. `.claude/hooks/` joined the `syncClaude` wipe list.
- One pattern-proof hook, `hooks/protect-generated-dirs.js` — a `PreToolUse` guard that blocks Write/Edit-class calls targeting the generated `.claude/`, `.cursor/`, and `.codex/` directories and points the author back at the source file. Zero dependencies; fails open on malformed input.

**Agents:**
- `security-reviewer` — vulnerability analysis through a threat-model lens (injection, access control, secrets, crypto, dependency risk). The security-specialist counterpart to `code-reviewer`.
- `build-fixer` — diagnoses and resolves build/compile/CI failures with the minimal fix, fixing the cause rather than masking the symptom.

**Skills:**
- `verification-loop` — prove a change works by running it before declaring it done.
- `api-design` — design a clean, consistent, protocol-agnostic API contract before implementing it.

**Commands** (Claude Code only):
- `/security-review`, `/build-fix` — wrappers for the two new agents.
- `/verify` — wrapper for the `verification-loop` skill.

### Changed

- **Cursor auto-apply globs (was deferred at v0.3).** Rules whose `language` field (or category directory) maps to a known glob set now sync with `globs` + `alwaysApply: false` — Cursor's "Auto Attached" mode. `LANGUAGE_GLOBS` and `globsForLanguage` added to `scripts/cursor-transform.js`; `toCursorRule` gained an optional `{ globs }` argument (skills are unaffected — no globs passed). The TypeScript strict-mode rule now auto-attaches to `.ts`/`.tsx`.
- **Codex rules mapping (was deferred at v0.3).** `syncCodex` now converts each rule to a skill (`ruleToSkill`) named `agentry-<category>-<name>` — Codex has no rules primitive distinct from skills.
- Install scripts (`install.sh`, `install.ps1`) copy `hooks/` for the Claude target. `doctor.js` reports the `hooks/` source and checks the generated copies.
- Plugin manifest and `package.json` version bumped to `0.6.0`.
- README "What's inside", architecture doc status table, and the Codex/Cursor adapter notes updated for hooks, the new commands, and the completed rule mappings.

### Tests

- 59 unit tests (up from 47). Added: `toCursorRule` globs injection and no-op-without-globs cases, `globsForLanguage` mapping; `ruleToSkill` field-drop, body preservation, and description-fallback cases.

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
