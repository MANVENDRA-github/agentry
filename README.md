# agentry

> Author your AI coding agents and skills once. Sync them to every harness you use.

agentry is a small configuration framework for developers who use more than one AI coding tool. You write your agents and skills in one place, and a sync step generates the harness-specific files for each tool you care about. v0.1 supports Claude Code and Cursor. The goal is to stop duplicating the same `code-reviewer` agent or `tdd-workflow` skill across `.claude/` and `.cursor/` directories that immediately drift apart.

It is intentionally small. Four agents, five skills, five commands, two adapters, one sync script. The bet is that a tight, readable repository is more useful day-to-day than a sprawling one you stop trusting after a month.

## Why agentry?

- **One source of truth.** Your `code-reviewer` agent works identically in Claude Code and Cursor without any manual sync. Edit the source file, run `npm run sync`, both harnesses are updated.
- **Curated over comprehensive.** Every agent and skill in agentry is meant to be read end-to-end. If it cannot earn its place by being clearly useful and well-written, it does not ship.
- **Cross-harness install in one command.** Pick a target, run the installer, and the right files land in the right places for that tool.

## Why not ECC?

ECC is excellent if you want a maximalist all-in-one — hundreds of skills, dozens of agents, broad harness support, an active contributor base. agentry is for developers who want a smaller, sharper set they can actually read end-to-end, with cross-harness sync for the two or three tools they use day-to-day. Different goals, different fits. If you want the kitchen sink, use ECC. If you want a short, opinionated config you control, agentry might suit you better.

## Status

**v0.4.0.** Three harness adapters (Claude Code, Cursor, Codex). Six agents (`code-reviewer`, `planner`, `debugger`, `pr-describer`, `refactorer`, `doc-writer`). Six skills (`tdd-workflow`, `session-handoff`, `git-commit-craft`, `error-debugging`, `code-review`, `test-writing`). Seven Claude Code slash commands (`/plan`, `/review`, `/debug`, `/commit`, `/handoff`, `/refactor`, `/document`). One TypeScript rule (`strict-mode`) as a pattern proof for language-specific content. Content grows with use, not with speculation — every component still has to earn its place.

## Install

```bash
git clone https://github.com/MANVENDRA-github/agentry.git
cd agentry
npm install
npm run sync                                       # generate harness-specific directories
./scripts/install.sh --target claude               # or: --target cursor
./scripts/install.sh --target codex --user         # install to ~/.agents/skills/
./scripts/install.sh --target codex --project      # install to <project>/.agents/skills/
```

Windows users:

```powershell
.\scripts\install.ps1 -Target claude               # or: -Target cursor
.\scripts\install.ps1 -Target codex -User
.\scripts\install.ps1 -Target codex -Project
```

The installer copies generated files into the target harness's expected location (e.g. `~/.claude/` for Claude Code). Run `--target` once per harness you use.

## What's inside

| Component | Name | Purpose |
|---|---|---|
| Agent | `code-reviewer` | Reviews code for correctness, security, and maintainability — without manufacturing nits. |
| Agent | `planner` | Produces an implementation plan before any code is written. |
| Agent | `debugger` | Hypothesis-driven root-cause investigation in fresh context. |
| Agent | `pr-describer` | Generates a PR description from a diff. |
| Agent | `refactorer` | Restructures existing code without changing behavior — extract, rename, dedupe, simplify. |
| Agent | `doc-writer` | Writes and maintains documentation — READMEs, API references, inline comments, guides. |
| Agent | `architect` | System and module design decisions — boundaries, responsibilities, trade-offs. Distinct from `planner`, which sequences the implementation. |
| Skill | `tdd-workflow` | Test-first development with explicit red-green-refactor loops. |
| Skill | `session-handoff` | Structured handoff notes for resuming work in a fresh session. |
| Skill | `git-commit-craft` | Conventional commits with the motivation written down, not just the diff. |
| Skill | `error-debugging` | In-conversation debugging discipline (companion to the `debugger` agent). |
| Skill | `code-review` | Self-review before handing off to another reviewer (companion to the `code-reviewer` agent). |
| Skill | `test-writing` | Adds tests to existing untested code (distinct from `tdd-workflow`'s test-first methodology). |
| Skill | `search-first` | Research before coding — search the codebase and dependencies for existing solutions before writing new code. |
| Command | `/plan` | Slash-command wrapper for the `planner` agent. |
| Command | `/review` | Slash-command wrapper for the `code-reviewer` agent. |
| Command | `/debug` | Slash-command wrapper for the `debugger` agent. |
| Command | `/commit` | Slash-command wrapper for the `git-commit-craft` skill. |
| Command | `/handoff` | Slash-command wrapper for the `session-handoff` skill. |
| Command | `/refactor` | Slash-command wrapper for the `refactorer` agent. |
| Command | `/document` | Slash-command wrapper for the `doc-writer` agent. |
| Command | `/architect` | Slash-command wrapper for the `architect` agent. |
| Rule | `typescript/strict-mode` | TypeScript strict mode discipline. Available to Claude Code (verbatim copy) and Cursor (as `.mdc` rule with `alwaysApply: false`). Codex rules support deferred to v0.4. |
| Harness adapter | Claude Code | Generates `.claude/` directory with agent, skill, and command files, plus the `.claude-plugin/plugin.json` manifest. |
| Harness adapter | Cursor | Generates `.cursor/` directory with `.mdc` rules format. Commands are not synced — Cursor has no equivalent primitive. |
| Harness adapter | Codex | Generates `.codex/agents/skills/agentry-*/` skill directories. agentry agents are installed as Codex skills (approximation — Codex has no markdown-agent primitive). Commands are skipped (no Codex slash-command primitive). Installs to `~/.agents/skills/` or `<project>/.agents/skills/`. |

Commands are a Claude Code-only feature today. Cursor and Codex have no equivalent slash-command system, so the sync engine skips them for those targets. Cursor and Codex users still get every agent and skill — only the thin command wrappers are unavailable, and the underlying agents can be invoked directly without them.

## How agentry works

Source-of-truth content lives in top-level directories: `agents/` and `skills/` today, with `commands/` and `rules/` planned. You author each file once, in a harness-neutral format.

`scripts/sync-harnesses.js` reads the source directories and writes harness-specific copies into `.claude/` and `.cursor/`. Each harness adapter knows the file layout and frontmatter format that harness expects, and translates the source files accordingly.

**Never edit the generated `.claude/` or `.cursor/` directories directly.** They are overwritten on every sync. Make your changes in `agents/` or `skills/`, then re-run `npm run sync`. This rule is enforced by convention, not by tooling — but breaking it will silently lose your edits.

## Authoring your own

A skill is a markdown file with frontmatter:

```markdown
---
name: my-skill
description: One-line summary of what this skill does and when to use it.
---

# My skill

Body of the skill — instructions the agent will follow when this skill is invoked.
```

Drop it in `skills/my-skill/SKILL.md`, run `npm run sync`, and it appears in every harness you target. Agents follow a similar pattern under `agents/`.

See [`docs/authoring.md`](docs/authoring.md) for the full authoring guide, [`docs/architecture.md`](docs/architecture.md) for how the sync engine and harness adapters fit together, and [`docs/decisions.md`](docs/decisions.md) for the design decisions and trade-offs behind agentry's shape.

## Roadmap

- **v0.1** ✓ shipped: foundation. Two harness adapters, one agent, one skill, minimal install.
- **v0.2** ✓ shipped: three more agents, four more skills, five Claude Code commands, CI workflow, `doctor` and `lint` scripts, contributor and authoring docs.
- **v0.3** ✓ shipped: Codex CLI as a third harness adapter, the `rules/` source-directory pattern proven with one TypeScript rule (`strict-mode`), and module extraction plus 47 unit tests covering the transform layer.
- **v0.4**: additional harnesses (OpenCode, Zed, Antigravity), expanded language-specific rule packs, hooks, marketplace listing, Codex rules support, Cursor `globs`-based auto-apply for language rules.
- **v0.5+**: more content as use surfaces real needs.

## License

MIT.
