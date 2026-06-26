# Architecture

This document explains how agentry is structured internally. Read this if you want to contribute a new harness adapter, debug a sync issue, or understand the trade-offs behind the design.

## Overview

agentry follows a source-of-truth + adapter pattern. Content (agents, skills, commands, rules, MCP servers, hooks) is authored once in top-level directories. A sync script generates harness-specific copies into separate directories — one per supported AI tool. Users install agentry by copying the generated directory for their tool into the location that tool expects.

The reason for this shape: maintaining the same `code-reviewer` agent or `tdd-workflow` skill by hand across `.claude/` and `.cursor/` directories means the two copies drift the first time anyone edits one and forgets the other. A sync step makes drift impossible.

## The data flow

```
source-of-truth          sync script                generated dirs               install script           harness config
─────────────────────    ──────────────────────     ──────────────────────       ──────────────────       ─────────────────────
agents/<name>.md     ──▶ scripts/sync-harnesses.js ─▶ .claude/agents/<name>.md ──▶ scripts/install.sh ──▶ ~/.claude/agents/...
skills/<name>/...    ──▶                            ─▶ .cursor/rules/<name>.mdc ─▶ scripts/install.ps1 ─▶ <project>/.cursor/...
```

Each arrow is one well-defined transformation. Source files never change as a side effect of sync. Generated files are wiped and recreated on every sync — they are not edited by hand.

## Source-of-truth layout

| Directory | Contents | Status |
|---|---|---|
| `agents/` | `<name>.md` per agent. Frontmatter + system prompt body. | Active in v0.1 (Claude Code, Cursor); converted to skills for Codex via v0.3. |
| `skills/` | `<name>/SKILL.md` per skill (plus any siblings the skill bundles). | Active in v0.1 (Claude Code, Cursor); Codex support added in v0.3. |
| `commands/` | `<name>.md` per slash command. | Planned for v0.2 |
| `rules/` | `<category>/<rule-name>.md` per rule, namespaced by language (`typescript`, `python`, `go`) or topic (`security`, `performance`). | Active in v0.3 (Claude Code verbatim, Cursor as `.mdc` with `alwaysApply: false`; Codex deferred to v0.4) |
| `mcp/` | `<name>.json` per MCP server. One harness-neutral server definition; the filename is the server name. | Active in v0.6 (Claude Code `.mcp.json`, Cursor `.cursor/mcp.json`; Codex deferred) |
| `hooks/` | `<name>.{sh,js}` per harness hook. | Planned |

The sync engine handles missing source directories gracefully — adding a new content type means creating the directory, adding source files, and extending the adapters to know what to do with them.

## The sync engine

`scripts/sync-harnesses.js` is one file with no runtime dependencies. The structure:

- A `SOURCES` map records the absolute path of each source directory.
- CLI parsing handles `--target <name>`, `--target=<name>`, and `--dry-run`. Unknown targets are reported and skipped.
- File helpers (`copyFile`, `writeFile`, `rmGenerated`, `copyTree`) are small and respect `--dry-run`. They log relative paths so output is consistent across platforms.
- Adapters live in their own functions: `syncClaude()` and `syncCursor()` from v0.1, plus `syncCodex()` added in v0.3. Each adapter knows the target harness's expected layout and frontmatter conventions.
- An `ADAPTERS` map dispatches `--target` values to functions.

A sync run is fully idempotent. Running `npm run sync` twice produces the same tree.

## Adapter responsibilities

Each adapter does three things, in order:

1. **Wipe** the harness-specific subdirectories it owns. For Cursor this is the whole `.cursor/` directory. For Claude Code it is only the `agents/`, `skills/`, and `commands/` subdirectories — see "Settings preservation" below for why.
2. **Translate** each source file into the harness's expected format. Some translations are verbatim copy (Claude Code agents are markdown with the same frontmatter shape). Some are structural — Cursor's closest primitive to a skill is a `.mdc` rule, so `syncCursor` wraps source skills with `alwaysApply: false` in the frontmatter.
3. **Write** a manifest if the harness needs one. `syncClaude` writes `.claude-plugin/plugin.json` describing the agentry plugin.

Adapters log each operation so the user sees what changed. Operations are logged with paths relative to the repo root, normalized to forward slashes regardless of OS.

**Rules** (added v0.3) follow the same pattern. `syncClaude` copies them verbatim to `.claude/rules/<category>/<rule-name>.md`. `syncCursor` runs the same `toCursorRule` transform used for skills and writes to `.cursor/rules/<category>/<rule-name>.mdc` — the nested category preserves the source namespace across both harnesses. `syncCodex` skips rules in v0.3; Codex has its own rules concept and the mapping is deferred to v0.4.

**MCP servers** (added v0.6) break the one-source-one-output shape every other content type follows: instead of one generated file per source, all `mcp/<name>.json` sources are *merged* into a single map. `loadMcpServers` reads and JSON-parses each source (throwing on a malformed file so sync fails loudly rather than emitting a broken config), and `toMcpServersJson` (in `scripts/mcp-transform.js`) builds `{ "mcpServers": { "<name>": {...} } }`, sorting by name so the output is byte-stable regardless of `readdir` order. `syncClaude` writes that map to `.mcp.json` at the repo root — Claude Code's project-scope MCP path, the one place this content type lands outside a harness namespace directory. `syncCursor` writes the identical map to `.cursor/mcp.json`. `syncCodex` skips MCP — Codex stores servers as TOML in its shared `config.toml`, which needs its own merge design (deferred). Both harnesses take a portable JSON `mcpServers` map, so the definition passes through unchanged; the only transform is the wrap-and-merge.

Two consequences of `.mcp.json` living at the repo root rather than under `.claude/`: it is written only when at least one source exists (an empty `mcp/` produces no file), and it is never deleted — agentry must not clobber a `.mcp.json` a user wrote by hand before adopting agentry's MCP sync. This is the one generated artifact agentry creates but does not also wipe. See [`decisions.md`](decisions.md) D20.

## The Codex adapter

Codex CLI is the third supported harness (added v0.3). Its skill format is close enough to agentry's source format that the mapping is nearly verbatim — closer than Cursor required.

**Where Codex content lives in the agentry repo.** The Codex adapter generates `.codex/agents/skills/agentry-<name>/SKILL.md`. The path mirrors Codex's actual reading paths (`$HOME/.agents/skills/`, `$PWD/.agents/skills/`, etc.) inside agentry's `.codex/` namespace. The redundant-looking `.codex/agents/skills/` is deliberate: `.codex/` is agentry's namespace for Codex output, and `agents/skills/` matches the shape Codex expects.

**Skill mapping.** Source skills (`skills/<name>/SKILL.md`) copy near-verbatim. Only the `name:` field is rewritten to `agentry-<name>` (via `renameSkill` in `scripts/codex-transform.js`); every other frontmatter field and the body are preserved. Sibling files and directories alongside `SKILL.md` (e.g. `scripts/`, `references/`, `assets/`) are copied verbatim so a bundled skill still functions after sync.

**Agent mapping (approximation).** Codex has no markdown-agent analog. Subagents in Codex are role-based and configured inline in `config.toml`, not authored as separate files. To make agentry's agents reachable from Codex, each `agents/<name>.md` is converted into a Codex skill (`agentToSkill`): `name` is set to `agentry-<name>`, `description` is preserved, and `tools` / `model` are dropped because Codex skills do not understand those fields. The body becomes the skill's instructions. This is the same approximation pattern as Cursor's skill→`.mdc` rule transform.

**Commands skipped.** Codex does not support user-extensible slash commands — only built-in commands like `/skills` and `/feedback`. The closest user-invocable primitive is `$skill-name`, which the converted agentry skills already provide. The sync engine writes no command files for Codex.

**The `agentry-` prefix.** Every generated skill directory and every `name:` field is prefixed `agentry-`. This avoids collision with user-authored Codex skills: if the user has their own `code-review` skill and agentry ships `code-review`, both would land in `~/.agents/skills/` and Codex would not know which to dispatch. Prefixing makes them distinct (`agentry-code-review` vs `code-review`). Same collision-avoidance pattern as Cursor's `agentry-` prefix on agent filenames.

**Wipe pattern.** Only `.codex/agents/skills/` is wiped on sync. The parent `.codex/` directory may contain Codex's per-user state (notably `config.toml`) and must be preserved. This follows the same "wipe what you own" discipline as `syncClaude`'s partial wipe — see "The settings preservation pattern" below.

## Adding a new harness adapter

To add support for a new harness — say, a hypothetical Foo Editor:

1. Add `foo` to the `ALL_TARGETS` array near the top of `scripts/sync-harnesses.js`.
2. Decide the source→target mapping for each content type. For each agent, skill, command: where does it go in `.foo/`? What format does Foo expect? Does it need a manifest?
3. Write `async function syncFoo()` following the pattern of `syncClaude()` and `syncCursor()`. Wipe the directories you own, then iterate source dirs and write the translated files.
4. Add `foo: syncFoo` to the `ADAPTERS` map.
5. Extend `scripts/install.sh` and `scripts/install.ps1` to accept `--target foo`. Decide the install destination — user-level or project-level — and the subdirectories to copy.
6. Update README `## What's inside` and `docs/architecture.md` to mention the new adapter.

For non-trivial harnesses, open a GitHub issue first to discuss the source→target mappings before writing code.

## The settings preservation pattern

Claude Code stores per-user state in `~/.claude/settings.local.json` (permissions cache) and other files at the top level of `~/.claude/`. `syncClaude` must not delete those when regenerating agentry content.

The pattern: wipe only the subdirectories the adapter owns — `agents/`, `skills/`, `commands/` — not the parent `.claude/` directory. This is enforced in `rmGenerated` calls inside `syncClaude` and is the same pattern the installer follows when copying into `~/.claude/`.

Future adapters that interact with a harness storing per-user state should follow the same discipline. Wipe what you own. Leave alone what you don't.

## Why no external dependencies

The sync engine, doctor script, and lint script all use Node.js stdlib only. No `js-yaml`, no `chalk`, no `commander`. The reasons:

- One less thing for contributors to install. A `git clone` and `node scripts/sync-harnesses.js` should just work.
- Smaller supply-chain surface. Every dep is a maintenance burden and a security risk.
- The scripts are small enough that stdlib idioms are not painful.

If a future feature genuinely needs a dependency, add it deliberately. The default answer is "write the helper inline."
