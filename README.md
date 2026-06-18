# agentry

> Author your AI coding agents and skills once. Sync them to every harness you use.

agentry is a configuration framework that lets you write AI coding agents, skills, commands, and rules one time, in a single harness-neutral format, then generate the tool-specific config for Claude Code, Cursor, and Codex from that one source.

If you use more than one AI coding tool, you end up maintaining the same `code-reviewer` agent and `tdd-workflow` skill by hand in both `.claude/` and `.cursor/`. The two copies drift the first time you edit one and forget the other. agentry keeps the canonical version in top-level `agents/`, `skills/`, `commands/`, and `rules/` directories and regenerates each harness's directory from it. The generated directories are disposable — every sync wipes and rewrites them — so drift isn't a thing you remember to avoid. It can't happen.

## How it works

The core is a source-of-truth + adapter pipeline in `scripts/sync-harnesses.js`. You author content once as markdown with frontmatter. Each adapter owns one target harness and translates the source into the directory layout and frontmatter that harness expects:

- **Claude Code** — near-verbatim. Agents, skills, commands, and rules map straight onto `.claude/`'s structure, and the adapter also writes the `.claude-plugin/plugin.json` manifest.
- **Cursor** — structural translation. Cursor has no "skill" primitive, so each skill is rewritten into a `.mdc` rule with `alwaysApply: false` (`toCursorRule` in `scripts/cursor-transform.js`).
- **Codex** — structural translation. Codex has no markdown-agent primitive, so each agent is converted into a Codex skill with its `tools` and `model` fields dropped (`agentToSkill` in `scripts/codex-transform.js`). Every generated skill is namespaced `agentry-<name>` so it can't collide with a skill the user wrote themselves.

Two decisions do the load-bearing work.

**Regeneration over editing.** `npm run sync` is idempotent: run it twice and you get a byte-identical tree. You never hand-edit the generated `.claude/`, `.cursor/`, or `.codex/` directories — the source directories are the only thing you touch. CI enforces this. After it runs sync, `git status --porcelain` must come back empty, so a pull request that edits a source file without committing the regenerated output fails the build.

**Wipe only what you own.** An adapter deletes only the subdirectories it generates — `.claude/agents/`, `.claude/skills/`, and so on — never the parent `.claude/`. The harness keeps per-user state at that top level (`settings.local.json` for Claude Code, `config.toml` for Codex), and clobbering it would be destructive. Each adapter cleans its own output and leaves the user's data alone.

```
agents/   skills/   commands/   rules/        ← source of truth (edit these)
                  │
                  ▼
       scripts/sync-harnesses.js              ← one adapter per harness
                  │
       ┌──────────┼───────────────┐
       ▼          ▼               ▼
   .claude/    .cursor/        .codex/         ← generated (never edit; wiped each sync)
  (+ plugin   (skills →       (agents →
   manifest)   .mdc rules)     skills)
                  │
                  ▼
   scripts/install.sh  /  scripts/install.ps1 ← copy into the harness's real location
                  │
       ┌──────────┼───────────────┐
       ▼          ▼               ▼
  ~/.claude/   ./.cursor/   ~/.agents/skills/
```

## What's inside

| Type | Name | What it does |
|---|---|---|
| Agent | `code-reviewer` | Reviews diffs for correctness, security, and maintainability — prioritized findings, not nits. |
| Agent | `planner` | Produces an implementation plan before any code is written. |
| Agent | `debugger` | Hypothesis-driven root-cause investigation that separates cause from symptom. |
| Agent | `pr-describer` | Turns a diff and its commit history into a review-ready PR description. |
| Agent | `refactorer` | Restructures code without changing behavior — extract, rename, dedupe, simplify. |
| Agent | `doc-writer` | Writes and maintains documentation, keeping it accurate to the code. |
| Agent | `architect` | System and module design decisions: boundaries, responsibilities, trade-offs. |
| Skill | `tdd-workflow` | Test-first development with explicit red-green-refactor loops. |
| Skill | `test-writing` | Adds tests to code that already exists, characterizing current behavior. |
| Skill | `code-review` | Self-review discipline before handing a change to another reviewer. |
| Skill | `error-debugging` | In-conversation debugging discipline; companion to the `debugger` agent. |
| Skill | `git-commit-craft` | Conventional commit messages that explain why, not just what. |
| Skill | `search-first` | Search the codebase and dependencies for an existing solution before writing new code. |
| Skill | `session-handoff` | Structured handoff notes so the next session resumes without re-deriving context. |

Eight slash commands wrap the most-used agents and skills for Claude Code: `/plan`, `/review`, `/debug`, `/commit`, `/handoff`, `/refactor`, `/document`, `/architect`. They sync to Claude Code only — Cursor and Codex have no user-extensible slash-command primitive — but the underlying agents and skills are available on all three harnesses.

One rule ships as a pattern proof for language-specific content: `rules/typescript/strict-mode.md`. Claude Code receives it verbatim; Cursor receives it as a `.mdc` rule.

## Setup

Requires Node.js 18 or newer. There are no runtime or dev dependencies to install.

```bash
git clone https://github.com/MANVENDRA-github/agentry.git
cd agentry
npm run sync          # regenerate .claude/, .cursor/, .codex/ from source
```

## Usage

Install the generated config into the harness you use:

```bash
./scripts/install.sh --target claude    # copies into ~/.claude/
./scripts/install.sh --target cursor    # copies into ./.cursor/
./scripts/install.sh --target codex     # copies into ~/.agents/skills/
```

On Windows, use the PowerShell installer:

```powershell
.\scripts\install.ps1 -Target claude
```

Run `--target` once per harness you use. Add `--project` to install into the current directory instead of your home directory, or `--uninstall` to remove what agentry installed.

### Authoring your own

Add a skill by creating `skills/<name>/SKILL.md`:

```markdown
---
name: my-skill
description: One line on what this skill does and when to invoke it.
---

# My skill

The instructions the agent follows when this skill is invoked.
```

Run `npm run sync`, and it appears in every harness you target. Agents (`agents/<name>.md`), commands (`commands/<name>.md`), and rules (`rules/<category>/<name>.md`) follow the same author-then-sync flow. Don't edit the generated directories — the next sync overwrites them.

Other scripts:

- `npm run sync:dry` — show what a sync would write without touching disk.
- `npm run lint` — validate frontmatter on every agent and skill (required fields, `name` matches filename, description length).
- `npm run doctor` — report the health of sources, generated output, and your local install.

## Tests

```bash
npm test
```

47 tests run on Node's built-in test runner (`node:test`) with no external framework. They cover the transform layer — the part with real logic rather than file copying:

- `tests/frontmatter.test.js` — the shared frontmatter parser and validators: CRLF endings, an empty body, a missing block, array-shaped values like `tools: [Read, Grep]`, a description that contains a colon, and the required-field and description-length checks.
- `tests/cursor-transform.test.js` — `toCursorRule` across the with-frontmatter, without-frontmatter, and already-declares-`alwaysApply` cases, plus body-spacing normalization.
- `tests/codex-transform.test.js` — `renameSkill` and `agentToSkill`: field drops, body preservation, and null on input that has no frontmatter.

CI (`.github/workflows/sync-check.yml`) runs three jobs on every push and pull request: sync determinism, frontmatter lint, and the test suite.

## Tech stack

- **Node.js 18+**, ES modules, zero dependencies — the `scripts/` use only the standard library (`node:fs/promises`, `node:path`, `node:url`, `node:os`). No `js-yaml`, no CLI framework; the frontmatter parser is ~40 lines in `scripts/frontmatter.js`.
- **node:test** for unit tests.
- **Bash and PowerShell** installers for cross-platform install.
- **GitHub Actions** for CI.

## Status and limitations

v0.5.0. Three harness adapters, seven agents, seven skills, eight commands, and one rule. A few things are deliberately limited today, and the code says so plainly:

- Commands sync to Claude Code only, because Cursor and Codex have no user-extensible slash-command primitive. The agents and skills behind those commands still reach all three harnesses.
- Cursor rules ship as `alwaysApply: false` (opt-in). Deriving auto-apply globs from a rule's `language` field isn't wired up yet — the field is captured but unused.
- Codex rules aren't synced. Codex has its own rules model that needs a dedicated mapping; for now the Codex adapter handles skills and agents only.

For the design in depth, see [`docs/architecture.md`](docs/architecture.md) for the adapter pattern, [`docs/authoring.md`](docs/authoring.md) for the authoring guide, [`docs/reference.md`](docs/reference.md) for a per-file and per-module map, and [`docs/decisions.md`](docs/decisions.md) for the numbered design decisions and their trade-offs.

## License

MIT.
