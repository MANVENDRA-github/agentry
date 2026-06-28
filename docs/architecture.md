# Architecture

This document explains how agentry is structured internally. Read this if you want to contribute a new harness adapter, debug a sync issue, or understand the trade-offs behind the design.

## Overview

agentry follows a source-of-truth + adapter pattern. Content (agents, skills, commands, rules, hooks, MCP servers) is authored once in top-level directories. A sync script generates harness-specific copies into separate directories — one per supported AI tool. Users install agentry by copying the generated directory for their tool into the location that tool expects.

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
| `agents/` | `<name>.md` per agent. Frontmatter + system prompt body. | Active in v0.1 (Claude Code, Cursor); converted to skills for Codex (v0.3); OpenCode agents (v0.7). |
| `skills/` | `<name>/SKILL.md` per skill (plus any siblings the skill bundles). | Active in v0.1 (Claude Code, Cursor); Codex (v0.3); OpenCode (v0.7). |
| `commands/` | `<name>.md` per slash command. | Active in v0.2 (Claude Code; OpenCode since v0.7) |
| `rules/` | `<category>/<rule-name>.md` per rule, namespaced by language (`typescript`, `python`, `go`) or topic (`security`, `performance`). | Active in v0.3 (Claude Code verbatim; Cursor as `.mdc` — auto-attached via `language`-derived globs since v0.6; Codex as a skill since v0.6). |
| `hooks/` | `<name>.{sh,js}` per harness hook. | Active in v0.6 (Claude Code only) |
| `mcp/` | `<name>.json` per MCP server. One harness-neutral server definition; the filename is the server name. | Active in v0.8 (Claude Code `.mcp.json`, Cursor `.cursor/mcp.json`, OpenCode `opencode.json`; Codex deferred) |

The sync engine handles missing source directories gracefully — adding a new content type means creating the directory, adding source files, and extending the adapters to know what to do with them.

## The sync engine

`scripts/sync-harnesses.js` is one file with no runtime dependencies. The structure:

- A `SOURCES` map records the absolute path of each source directory.
- CLI parsing handles `--target <name>`, `--target=<name>`, and `--dry-run`. Unknown targets are reported and skipped.
- File helpers (`copyFile`, `writeFile`, `rmGenerated`, `copyTree`) are small and respect `--dry-run`. They log relative paths so output is consistent across platforms.
- Adapters live in their own functions: `syncClaude()` and `syncCursor()` from v0.1, `syncCodex()` added in v0.3, and `syncOpenCode()` added in v0.7. Each adapter knows the target harness's expected layout and frontmatter conventions.
- An `ADAPTERS` map dispatches `--target` values to functions.

A sync run is fully idempotent. Running `npm run sync` twice produces the same tree.

## Adapter responsibilities

Each adapter does three things, in order:

1. **Wipe** the harness-specific subdirectories it owns. For Cursor this is the whole `.cursor/` directory. For Claude Code it is only the `agents/`, `skills/`, `commands/`, and `rules/` subdirectories (with `hooks/` copied fresh) — see "Settings preservation" below for why.
2. **Translate** each source file into the harness's expected format. Some translations are verbatim copy (Claude Code agents are markdown with the same frontmatter shape). Some are structural — Cursor's closest primitive to a skill is a `.mdc` rule, so `syncCursor` wraps source skills with `alwaysApply: false` in the frontmatter.
3. **Write** a manifest if the harness needs one. `syncClaude` writes `.claude-plugin/plugin.json` describing the agentry plugin.

Adapters log each operation so the user sees what changed. Operations are logged with paths relative to the repo root, normalized to forward slashes regardless of OS.

**Rules** (added v0.3) follow the same pattern. `syncClaude` copies them verbatim to `.claude/rules/<category>/<rule-name>.md`. `syncCursor` runs the same `toCursorRule` transform used for skills and writes to `.cursor/rules/<category>/<rule-name>.mdc` — the nested category preserves the source namespace across both harnesses. Since v0.6, a rule whose `language` field (falling back to its category directory) maps to a known glob set is written with `globs` + `alwaysApply: false`, which Cursor treats as "Auto Attached": the rule activates only when a matching file is in context. `syncCodex` converts each rule to a skill (`ruleToSkill`) named `agentry-<category>-<name>` — Codex has no rules primitive distinct from skills, so this is the same approximation as the agent→skill conversion.

**Hooks** (added v0.6) are scripts, not markdown. `syncClaude` copies `hooks/` verbatim into `.claude/hooks/`; the user references a hook from `settings.json` to enable it (agentry ships the script but never touches `settings.json` — same "wipe what you own, leave user state alone" discipline). `syncCursor` and `syncCodex` skip hooks: neither harness has a drop-in hooks directory, and their event models need a dedicated mapping. agentry ships one pattern-proof hook, `hooks/protect-generated-dirs.js`, a `PreToolUse` guard that blocks edits to the generated directories.

## The Codex adapter

Codex CLI is the third supported harness (added v0.3). Its skill format is close enough to agentry's source format that the mapping is nearly verbatim — closer than Cursor required.

**Where Codex content lives in the agentry repo.** The Codex adapter generates `.codex/agents/skills/agentry-<name>/SKILL.md`. The path mirrors Codex's actual reading paths (`$HOME/.agents/skills/`, `$PWD/.agents/skills/`, etc.) inside agentry's `.codex/` namespace. The redundant-looking `.codex/agents/skills/` is deliberate: `.codex/` is agentry's namespace for Codex output, and `agents/skills/` matches the shape Codex expects.

**Skill mapping.** Source skills (`skills/<name>/SKILL.md`) copy near-verbatim. Only the `name:` field is rewritten to `agentry-<name>` (via `renameSkill` in `scripts/codex-transform.js`); every other frontmatter field and the body are preserved. Sibling files and directories alongside `SKILL.md` (e.g. `scripts/`, `references/`, `assets/`) are copied verbatim so a bundled skill still functions after sync.

**Agent mapping (approximation).** Codex has no markdown-agent analog. Subagents in Codex are role-based and configured inline in `config.toml`, not authored as separate files. To make agentry's agents reachable from Codex, each `agents/<name>.md` is converted into a Codex skill (`agentToSkill`): `name` is set to `agentry-<name>`, `description` is preserved, and `tools` / `model` are dropped because Codex skills do not understand those fields. The body becomes the skill's instructions. This is the same approximation pattern as Cursor's skill→`.mdc` rule transform.

**Commands skipped.** Codex does not support user-extensible slash commands — only built-in commands like `/skills` and `/feedback`. The closest user-invocable primitive is `$skill-name`, which the converted agentry skills already provide. The sync engine writes no command files for Codex.

**The `agentry-` prefix.** Every generated skill directory and every `name:` field is prefixed `agentry-`. This avoids collision with user-authored Codex skills: if the user has their own `code-review` skill and agentry ships `code-review`, both would land in `~/.agents/skills/` and Codex would not know which to dispatch. Prefixing makes them distinct (`agentry-code-review` vs `code-review`). Same collision-avoidance pattern as Cursor's `agentry-` prefix on agent filenames.

**Wipe pattern.** Only `.codex/agents/skills/` is wiped on sync. The parent `.codex/` directory may contain Codex's per-user state (notably `config.toml`) and must be preserved. This follows the same "wipe what you own" discipline as `syncClaude`'s partial wipe — see "The settings preservation pattern" below.

## The OpenCode adapter

OpenCode CLI is the fourth supported harness (added v0.7), and the closest of all to Claude Code. Where Cursor and Codex each lack a primitive and force a structural translation, OpenCode has native **agents**, **commands**, and **skills** — all authored as markdown with frontmatter — so the mapping is near-verbatim, the same character as `syncClaude`.

**Where OpenCode content lives.** OpenCode reads from `.opencode/<kind>/` (project) and `~/.config/opencode/<kind>/` (global). The subdirectory names are **plural** in current OpenCode (`agents/`, `commands/`, `skills/`); the singular forms (`agent/`, `command/`) are kept only for backwards compatibility, so agentry emits the plural form. `syncOpenCode` generates into agentry's `.opencode/` namespace mirroring that layout.

**Skill mapping (verbatim).** OpenCode skills use the same Agent Skills format as the source (`name` + `description` frontmatter, body, bundled sibling files), so skills are copied verbatim — including any `scripts/`, `references/`, or `assets/` siblings — exactly as `syncClaude` does.

**Agent mapping (light frontmatter translation).** OpenCode derives an agent's name from its filename and expects a `mode` (`all` | `primary` | `subagent`). `agentToOpenCodeAgent` (in `scripts/opencode-transform.js`) keeps `description`, emits `mode: subagent` (agentry's agents are subagents), and drops `name` (filename-derived), `tools`, and `model`. The last two are dropped rather than translated because their shapes differ: Claude Code's `tools` is an allow-list array while OpenCode's is a permission map, and `model: sonnet` is a Claude Code shorthand, not an OpenCode `provider/model` id. Dropping them lets the subagent inherit safe defaults instead of emitting invalid config. Deriving an OpenCode permission map from the allow-list is a possible future enhancement.

**Command mapping.** OpenCode is the only harness besides Claude Code with user-extensible commands, so agentry's commands reach it. `commandToOpenCode` keeps `description` and drops `argument-hint` (a Claude Code-only field); the body — including `$ARGUMENTS`, which OpenCode also supports — is preserved. The command bodies reference agents by their unprefixed names, which match the unprefixed agent files.

**No `agentry-` prefix.** Unlike Cursor and Codex, OpenCode is treated like Claude Code: its primitives map 1:1, so agentry content keeps its natural shape and "owns" its names (the installer's uninstall is name-based). This also keeps the command→agent references intact. The prefix exists only to disambiguate the *approximations* Cursor and Codex require, where dissimilar primitives are flattened into one namespace; OpenCode has no such flattening.

**Rules and hooks deferred.** OpenCode's rules model is `AGENTS.md` plus the `instructions` config array — a different shape from a per-file rules directory — so rule sync is deferred pending that mapping. Hooks are skipped too: OpenCode has no drop-in hooks directory.

**Wipe pattern.** Only the `agents/`, `commands/`, and `skills/` subdirectories of `.opencode/` are wiped. The parent `.opencode/` may hold the user's `opencode.json` and other state — same "wipe what you own" discipline as `syncClaude` and `syncCodex`.

## The MCP adapter (across harnesses)

MCP servers (added v0.8) break the one-source-one-output shape every other content type follows. Instead of one generated file per source, all `mcp/<name>.json` sources are *merged* into a single config per harness. `loadMcpServers` (in `sync-harnesses.js`) reads and JSON-parses each source into `{ name, def }` records — throwing on a malformed file so sync fails loudly rather than emitting a broken config — and the transforms in `scripts/mcp-transform.js` build the per-harness output, sorting by name so it is byte-stable regardless of `readdir` order.

There is no dedicated `syncMcp` adapter; instead each harness adapter that supports MCP writes its own output as a final step, because the target shape differs:

- **`syncClaude`** writes `.mcp.json` at the repo root — Claude Code's project-scope MCP path — as `{ "mcpServers": { "<name>": def } }`. The definition is passed through verbatim (`toMcpServersJson`).
- **`syncCursor`** writes the identical `mcpServers` map to `.cursor/mcp.json`. Cursor and Claude Code read the same shape, so no transform is needed.
- **`syncOpenCode`** writes `opencode.json` at the repo root, under the `mcp` key, but OpenCode's schema differs — `type: "local" | "remote"`, a single `command` array (command + args), an `environment` map, an `enabled` flag — so `toOpenCodeMcpConfig` performs a real per-server transform.
- **`syncCodex`** skips MCP. Codex stores servers as TOML in its shared `config.toml`, which needs its own merge design (deferred).

Two of these outputs — `.mcp.json` and `opencode.json` — are the only generated artifacts that land outside a harness namespace directory; they are the project-scope paths the harnesses read from the repo root. Because of that, they follow a stricter discipline than the wiped namespace dirs: each is written only when at least one MCP source exists, and is **never deleted**. agentry must not clobber a `.mcp.json` (or an `opencode.json`, which holds far more than MCP) that a user authored before adopting agentry's MCP sync. This is the one place "wipe what you own" becomes "write what you own, but never delete what you might not have created." See [`decisions.md`](decisions.md) D20.

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

The pattern: wipe only the subdirectories the adapter owns — `agents/`, `skills/`, `commands/`, `rules/` — not the parent `.claude/` directory. This is enforced in `rmGenerated` calls inside `syncClaude` and is the same pattern the installer follows when copying into `~/.claude/`.

Future adapters that interact with a harness storing per-user state should follow the same discipline. Wipe what you own. Leave alone what you don't.

## Why no external dependencies

The sync engine, doctor script, and lint script all use Node.js stdlib only. No `js-yaml`, no `chalk`, no `commander`. The reasons:

- One less thing for contributors to install. A `git clone` and `node scripts/sync-harnesses.js` should just work.
- Smaller supply-chain surface. Every dep is a maintenance burden and a security risk.
- The scripts are small enough that stdlib idioms are not painful.

If a future feature genuinely needs a dependency, add it deliberately. The default answer is "write the helper inline."
