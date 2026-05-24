# Architecture

This document explains how agentry is structured internally. Read this if you want to contribute a new harness adapter, debug a sync issue, or understand the trade-offs behind the design.

## Overview

agentry follows a source-of-truth + adapter pattern. Content (agents, skills, commands, rules, hooks) is authored once in top-level directories. A sync script generates harness-specific copies into separate directories — one per supported AI tool. Users install agentry by copying the generated directory for their tool into the location that tool expects.

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
| `agents/` | `<name>.md` per agent. Frontmatter + system prompt body. | Active in v0.1 |
| `skills/` | `<name>/SKILL.md` per skill (plus any siblings the skill bundles). | Active in v0.1 |
| `commands/` | `<name>.md` per slash command. | Planned for v0.2 |
| `rules/` | `<name>.md` per project-rule snippet. | Planned for v0.3 |
| `hooks/` | `<name>.{sh,js}` per harness hook. | Planned for v0.3 |

The sync engine handles missing source directories gracefully — adding a new content type means creating the directory, adding source files, and extending the adapters to know what to do with them.

## The sync engine

`scripts/sync-harnesses.js` is one file with no runtime dependencies. The structure:

- A `SOURCES` map records the absolute path of each source directory.
- CLI parsing handles `--target <name>`, `--target=<name>`, and `--dry-run`. Unknown targets are reported and skipped.
- File helpers (`copyFile`, `writeFile`, `rmGenerated`, `copyTree`) are small and respect `--dry-run`. They log relative paths so output is consistent across platforms.
- Adapters live in their own functions: `syncClaude()` and `syncCursor()` for v0.1. Each adapter knows the target harness's expected layout and frontmatter conventions.
- An `ADAPTERS` map dispatches `--target` values to functions.

A sync run is fully idempotent. Running `npm run sync` twice produces the same tree.

## Adapter responsibilities

Each adapter does three things, in order:

1. **Wipe** the harness-specific subdirectories it owns. For Cursor this is the whole `.cursor/` directory. For Claude Code it is only the `agents/`, `skills/`, and `commands/` subdirectories — see "Settings preservation" below for why.
2. **Translate** each source file into the harness's expected format. Some translations are verbatim copy (Claude Code agents are markdown with the same frontmatter shape). Some are structural — Cursor's closest primitive to a skill is a `.mdc` rule, so `syncCursor` wraps source skills with `alwaysApply: false` in the frontmatter.
3. **Write** a manifest if the harness needs one. `syncClaude` writes `.claude-plugin/plugin.json` describing the agentry plugin.

Adapters log each operation so the user sees what changed. Operations are logged with paths relative to the repo root, normalized to forward slashes regardless of OS.

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
