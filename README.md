# agentry

> Author your AI coding agents and skills once. Sync them to every harness you use.

agentry is a configuration framework that lets you write AI coding agents, skills, commands, rules, and MCP server configs one time, in a single harness-neutral format, then generate the tool-specific config for Claude Code, Cursor, Codex, and OpenCode from that one source.

If you use more than one AI coding tool, you end up maintaining the same `code-reviewer` agent and `tdd-workflow` skill by hand in both `.claude/` and `.cursor/`. The two copies drift the first time you edit one and forget the other. agentry keeps the canonical version in top-level `agents/`, `skills/`, `commands/`, `rules/`, `hooks/`, and `mcp/` directories and regenerates each harness's directory from it. The generated directories are disposable — every sync wipes and rewrites them — so drift isn't a thing you remember to avoid. It can't happen.

## How it works

The core is a source-of-truth + adapter pipeline in `scripts/sync-harnesses.js`. You author content once — markdown with frontmatter for agents, skills, commands, rules, and hooks; JSON for MCP servers. Each adapter owns one target harness and translates the source into the directory layout and config that harness expects:

- **Claude Code** — near-verbatim. Agents, skills, commands, and rules map straight onto `.claude/`'s structure; the adapter also copies hooks, merges MCP servers into a project `.mcp.json`, and writes the `.claude-plugin/plugin.json` manifest.
- **Cursor** — structural translation. Cursor has no "skill" primitive, so each skill is rewritten into a `.mdc` rule with `alwaysApply: false` (`toCursorRule` in `scripts/cursor-transform.js`). Language rules auto-attach via `language`-derived globs. MCP servers merge into `.cursor/mcp.json`.
- **Codex** — structural translation. Codex has no markdown-agent primitive, so each agent (and each rule) is converted into a Codex skill with its `tools` and `model` fields dropped (`agentToSkill` / `ruleToSkill` in `scripts/codex-transform.js`). Every generated skill is namespaced `agentry-<name>` so it can't collide with a skill the user wrote themselves. (MCP is deferred — Codex stores servers as TOML in a shared config.)
- **OpenCode** — near-verbatim, like Claude Code. OpenCode has native agents, commands, *and* skills, so each maps onto `.opencode/`'s plural subdirectories (`agents/`, `commands/`, `skills/`). Agent frontmatter is translated to OpenCode's shape (`mode: subagent`; the incompatible `tools` array and `model` shorthand dropped) by `agentToOpenCodeAgent` in `scripts/opencode-transform.js`; skills copy verbatim. MCP servers are translated into `opencode.json` (`toOpenCodeMcpConfig`). It's the only harness besides Claude Code that receives the slash commands.

Two decisions do the load-bearing work.

**Regeneration over editing.** `npm run sync` is idempotent: run it twice and you get a byte-identical tree. You never hand-edit the generated `.claude/`, `.cursor/`, or `.codex/` directories — the source directories are the only thing you touch. CI enforces this. After it runs sync, `git status --porcelain` must come back empty, so a pull request that edits a source file without committing the regenerated output fails the build.

**Wipe only what you own.** An adapter deletes only the subdirectories it generates — `.claude/agents/`, `.claude/skills/`, and so on — never the parent `.claude/`. The harness keeps per-user state at that top level (`settings.local.json` for Claude Code, `config.toml` for Codex, `opencode.json` for OpenCode), and clobbering it would be destructive. Each adapter cleans its own output and leaves the user's data alone.

```
agents/ skills/ commands/ rules/ hooks/ mcp/      ← source of truth (edit these)
                  │
                  ▼
       scripts/sync-harnesses.js                  ← one adapter per harness
                  │
       ┌──────────┼──────────┬──────────┐
       ▼          ▼          ▼          ▼
   .claude/    .cursor/    .codex/   .opencode/   ← generated (never edit; wiped each sync)
  (+ plugin   (skills →   (agents+   (near-
   manifest,   .mdc rules, rules →    verbatim;
   + hooks)    globs)      skills)    + commands)
       └─ MCP servers → .mcp.json · .cursor/mcp.json · opencode.json (Codex deferred)
                  │
                  ▼
   scripts/install.sh  /  scripts/install.ps1     ← copy into the harness's real location
                  │
       ┌──────────┼──────────┬──────────────┐
       ▼          ▼          ▼              ▼
  ~/.claude/  ./.cursor/  ~/.agents/   ~/.config/
                          skills/      opencode/
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
| Agent | `security-reviewer` | Vulnerability analysis through a threat-model lens — injection, access control, secrets, crypto, dependency risk. |
| Agent | `build-fixer` | Diagnoses and resolves build/compile/CI failures with the minimal fix, not a mask. |
| Agent | `e2e-runner` | Generates, maintains, and runs end-to-end tests for real user journeys — framework-agnostic, flakiness-averse. |
| Skill | `tdd-workflow` | Test-first development with explicit red-green-refactor loops. |
| Skill | `test-writing` | Adds tests to code that already exists, characterizing current behavior. |
| Skill | `code-review` | Self-review discipline before handing a change to another reviewer. |
| Skill | `error-debugging` | In-conversation debugging discipline; companion to the `debugger` agent. |
| Skill | `git-commit-craft` | Conventional commit messages that explain why, not just what. |
| Skill | `search-first` | Search the codebase and dependencies for an existing solution before writing new code. |
| Skill | `session-handoff` | Structured handoff notes so the next session resumes without re-deriving context. |
| Skill | `verification-loop` | Prove a change works by running it before declaring it done. |
| Skill | `api-design` | Design a clean, consistent, protocol-agnostic API contract before implementing it. |
| Skill | `perf-profiling` | Fix a performance problem by measurement — baseline, profile, one change, re-measure — not by guesswork. |
| Skill | `strategic-compact` | Compact the working context deliberately at task boundaries instead of at an arbitrary auto-truncation point. |
| Skill | `continuous-learning` | Turn a hard-won session insight into a durable, reusable note before it scrolls away. |

Twelve slash commands wrap the most-used agents and skills: `/plan`, `/review`, `/debug`, `/commit`, `/handoff`, `/refactor`, `/document`, `/architect`, `/security-review`, `/build-fix`, `/verify`, `/e2e`. They sync to Claude Code and OpenCode — the two harnesses with a user-extensible command primitive — while Cursor and Codex receive the underlying agents and skills only. All four harnesses get the agents and skills behind these commands.

One rule ships as a pattern proof for language-specific content: `rules/typescript/strict-mode.md`. Claude Code receives it verbatim; Cursor receives it as a `.mdc` rule auto-attached to `.ts`/`.tsx` files (via globs derived from its `language` field); Codex receives it as a skill. (OpenCode's rules model — `AGENTS.md` and the `instructions` config — is a separate mapping, deferred.)

One hook ships as a pattern proof for the hooks pipeline: `hooks/protect-generated-dirs.js` — a Claude Code `PreToolUse` hook that blocks edits to the generated `.claude/`, `.cursor/`, `.codex/`, and `.opencode/` directories and points you back at the source file. Hooks sync to Claude Code only; reference it from `settings.json` to enable it.

One MCP server ships as a pattern proof: `mcp/filesystem.json`. Author a Model Context Protocol server once as a harness-neutral JSON definition (the filename is the server name) and sync merges it into `.mcp.json` for Claude Code, `.cursor/mcp.json` for Cursor, and `opencode.json` for OpenCode — the first two read the same `mcpServers` map, while OpenCode's differently-shaped config is translated for it. Codex is deferred; it stores servers as TOML in a shared config file.

## Setup

Requires Node.js 18 or newer. There are no runtime or dev dependencies to install.

```bash
git clone https://github.com/MANVENDRA-github/agentry.git
cd agentry
npm run sync          # regenerate .claude/, .cursor/, .codex/, .opencode/ from source
```

## Usage

Install the generated config into the harness you use:

```bash
./scripts/install.sh --target claude    # copies into ~/.claude/
./scripts/install.sh --target cursor    # copies into ./.cursor/
./scripts/install.sh --target codex     # copies into ~/.agents/skills/
./scripts/install.sh --target opencode  # copies into ~/.config/opencode/
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

67 tests run on Node's built-in test runner (`node:test`) with no external framework. They cover the transform layer — the part with real logic rather than file copying:

- `tests/frontmatter.test.js` — the shared frontmatter parser and validators: CRLF endings, an empty body, a missing block, array-shaped values like `tools: [Read, Grep]`, a description that contains a colon, and the required-field and description-length checks.
- `tests/cursor-transform.test.js` — `toCursorRule` across the with-frontmatter, without-frontmatter, and already-declares-`alwaysApply` cases, body-spacing normalization, and `globs` injection / `globsForLanguage` mapping.
- `tests/codex-transform.test.js` — `renameSkill`, `agentToSkill`, and `ruleToSkill`: field drops, body preservation, description fallback, and null on input that has no frontmatter.
- `tests/opencode-transform.test.js` — `agentToOpenCodeAgent` (sets `mode: subagent`, drops `name`/`tools`/`model`, preserves the body) and `commandToOpenCode` (keeps `description`, drops `argument-hint`, preserves `$ARGUMENTS`).

CI (`.github/workflows/sync-check.yml`) runs three jobs on every push and pull request: sync determinism, frontmatter lint, and the test suite.

## Tech stack

- **Node.js 18+**, ES modules, zero dependencies — the `scripts/` use only the standard library (`node:fs/promises`, `node:path`, `node:url`, `node:os`). No `js-yaml`, no CLI framework; the frontmatter parser is ~40 lines in `scripts/frontmatter.js`.
- **node:test** for unit tests.
- **Bash and PowerShell** installers for cross-platform install.
- **GitHub Actions** for CI.

## Status and limitations

v0.7.0. Four harness adapters, nine agents, nine skills, eleven commands, one rule, and one hook. A few things are deliberately limited today, and the code says so plainly:

- Commands sync to Claude Code and OpenCode, the two harnesses with a user-extensible command primitive. Cursor and Codex receive the agents and skills behind those commands, but not the commands themselves.
- Hooks sync to Claude Code only. Cursor, Codex, and OpenCode have no drop-in hooks directory; their event models differ and need a dedicated mapping.
- Cursor rules auto-attach via globs when the rule's `language` is one of the known mappings (TypeScript, Python, Go, Rust, and others in `LANGUAGE_GLOBS`); unmapped languages still ship as `alwaysApply: false` (opt-in).
- Codex rules sync as skills (`agentry-<category>-<name>`), since Codex has no rules primitive distinct from skills. A first-class Codex rules model, if one emerges, would replace this approximation.
- OpenCode receives agents, skills, and commands, but not rules or hooks. Its rules model is `AGENTS.md` plus the `instructions` config — a separate mapping. Agent `tools`/`model` are dropped rather than translated to OpenCode's permission-map and `provider/model` shapes; deriving them is a possible enhancement.

For the design in depth, see [`docs/architecture.md`](docs/architecture.md) for the adapter pattern, [`docs/authoring.md`](docs/authoring.md) for the authoring guide, [`docs/reference.md`](docs/reference.md) for a per-file and per-module map, and [`docs/decisions.md`](docs/decisions.md) for the numbered design decisions and their trade-offs.

## License

MIT.
