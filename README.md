# agentry

[![sync-check](https://github.com/MANVENDRA-github/agentry/actions/workflows/sync-check.yml/badge.svg?branch=main)](https://github.com/MANVENDRA-github/agentry/actions/workflows/sync-check.yml)
[![Latest release](https://img.shields.io/github/v/release/MANVENDRA-github/agentry?sort=semver)](https://github.com/MANVENDRA-github/agentry/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-informational)](package.json)
[![Dependencies: none](https://img.shields.io/badge/dependencies-none-success)](package.json)

> Author your AI coding agents and skills once. Sync them to every harness you use.

agentry is a configuration framework that lets you write AI coding agents, skills, commands, rules, hooks, and MCP server configs one time, in a single harness-neutral format, then generate the tool-specific config for Claude Code, Cursor, Codex, and OpenCode from that one source.

If you use more than one AI coding tool, you end up maintaining the same `code-reviewer` agent and `tdd-workflow` skill by hand in both `.claude/` and `.cursor/`. The two copies drift the first time you edit one and forget the other. agentry keeps the canonical version in top-level `agents/`, `skills/`, `commands/`, `rules/`, `hooks/`, and `mcp/` directories and regenerates each harness's directory from it. The generated directories are disposable — every sync wipes and rewrites them — so drift isn't a thing you remember to avoid. It can't happen.

## What you get

Every number here is what the current tree actually produces. `npm run sync` writes it; CI fails the build if it doesn't.

| Source | Count | Claude Code | Cursor | Codex | OpenCode |
| --- | --- | --- | --- | --- | --- |
| **Agents** | 20 | `.claude/agents/` | `.cursor/agents/` | → skill | `.opencode/agents/` |
| **Skills** | 32 | `.claude/skills/` | → `.mdc` rule | → skill | `.opencode/skills/` |
| **Commands** | 21 | `.claude/commands/` | — | — | `.opencode/commands/` |
| **Rules** | 18 | `.claude/rules/` | → auto-attaching `.mdc` | → skill | — |
| **Hooks** | 7 | `.claude/hooks/` | — | — | — |
| **MCP servers** | 2 | `.mcp.json` | `.cursor/mcp.json` | — | `opencode.json` |

A dash means the harness has no primitive for it, not that the work is unfinished — see [Status and limitations](#status-and-limitations) for which ones are deferred and why.

Codex is the clearest illustration of what an adapter *is*. It has exactly one extensible primitive — a skill — so agentry flattens three source types into it: **20 agents + 32 skills + 18 rules = 70 Codex skills**, every one namespaced `agentry-*` so it cannot collide with a skill you wrote yourself.

## One source file, four harnesses

You write this once, at `skills/tdd-workflow/SKILL.md`:

```markdown
---
name: tdd-workflow
description: Test-first development with explicit red-green-refactor loops. Invoke when
  implementing a feature with well-defined inputs and outputs, fixing a reproducible bug,
  or refactoring code that already has tests. Skip for exploratory spikes, UI-heavy work,
  or one-off scripts where test overhead exceeds value.
---

# TDD workflow

Test-driven development, applied for real. The goal is to catch real failures with tests
that mean something — not to inflate coverage numbers or perform a ritual.
```

Note the `description`: it names both when to invoke *and* when to skip. That is the field every harness reads to decide whether to load the skill at all.

`npm run sync` produces, from that one file:

```
.claude/skills/tdd-workflow/SKILL.md              verbatim — Claude Code has skills
.opencode/skills/tdd-workflow/SKILL.md            verbatim — so does OpenCode
.cursor/rules/tdd-workflow.mdc                    rewritten — Cursor has no skill primitive,
                                                  so it becomes a rule, alwaysApply: false
.codex/agents/skills/agentry-tdd-workflow/        renamed — namespaced so it can't collide
```

Nothing about the source file knows a harness exists. Adding a fifth harness means writing a fifth adapter, not touching 32 skills.

## How it works

The core is a source-of-truth + adapter pipeline in `scripts/sync-harnesses.js`. You author content once — markdown with frontmatter for agents, skills, commands, rules, and hooks; JSON for MCP servers. Each adapter owns one target harness and translates the source into the directory layout and config that harness expects:

- **Claude Code** — near-verbatim. Agents, skills, commands, and rules map straight onto `.claude/`'s structure; the adapter also copies hooks, merges MCP servers into a project `.mcp.json`, and writes the `.claude-plugin/plugin.json` manifest.
- **Cursor** — structural translation. Cursor has no "skill" primitive, so each skill is rewritten into a `.mdc` rule with `alwaysApply: false` (`toCursorRule` in `scripts/cursor-transform.js`). Language rules auto-attach via `language`-derived globs. MCP servers merge into `.cursor/mcp.json`.
- **Codex** — structural translation. Codex has no markdown-agent primitive, so each agent (and each rule) is converted into a Codex skill with its `tools` and `model` fields dropped (`agentToSkill` / `ruleToSkill` in `scripts/codex-transform.js`). Every generated skill is namespaced `agentry-<name>`. (MCP is deferred — Codex stores servers as TOML in a shared config.)
- **OpenCode** — near-verbatim, like Claude Code. OpenCode has native agents, commands, *and* skills, so each maps onto `.opencode/`'s plural subdirectories. Agent frontmatter is translated to OpenCode's shape (`mode: subagent`; the incompatible `tools` array and `model` shorthand dropped) by `agentToOpenCodeAgent` in `scripts/opencode-transform.js`; skills copy verbatim. MCP servers are translated into `opencode.json` (`toOpenCodeMcpConfig`).

Two decisions do the load-bearing work.

**Regeneration over editing.** `npm run sync` is idempotent: run it twice and you get a byte-identical tree. You never hand-edit the generated directories — the source directories are the only thing you touch. CI enforces this. After it runs sync, `git status --porcelain` must come back empty, so a pull request that edits a source file without committing the regenerated output fails the build. A `protect-generated-dirs` hook catches the mistake even earlier, at the moment you try to write the file.

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

## Why it is curated

The content is not a catalog import. Every component is measured against one bar, stated in `CONTRIBUTING.md`: **five excellent skills beats fifty mediocre ones.** Speculative content — "might be useful" — is rejected on sight, and language- or framework-specific agents and skills are rejected outright (language discipline belongs in `rules/<language>/`, not in an agent).

That bar has teeth. The v0.15.0 batch came from auditing the existing corpus for genuine gaps: **ten proposals were cut** as duplicates or speculation before a line was written, and seventeen shipped. This is a deliberate alternative to the maximalist agent-config repos, not a competitor to them — see [D17](docs/decisions.md) for why that niche was chosen on purpose rather than lost by default.

Every component's `description` must name the condition that triggers it, and — where it matters — the condition that does *not*:

> **`caching`** — Add a cache deliberately … Invoke when adding or changing a cache at any layer. **Skip** for cheap or rarely-reused computation where a cache adds risk without a measured win.

A vague description causes a vague invocation. `npm run lint` fails a component that omits one.

## What's inside

### Agents (20)

Delegated, fresh-context specialists. Invoked when a job deserves its own reasoning budget.

| Agent | What it does |
| --- | --- |
| `code-reviewer` | Reviews diffs for correctness, security, and maintainability — prioritized findings, not nits. |
| `security-reviewer` | Vulnerability analysis through a threat-model lens — injection, access control, secrets, crypto, dependency risk. |
| `debugger` | Hypothesis-driven root-cause investigation that separates cause from symptom. |
| `planner` | Produces an implementation plan before any code is written. |
| `architect` | System and module design decisions: boundaries, responsibilities, trade-offs. |
| `api-designer` | Designs an API contract before implementation — naming, error shapes, versioning, pagination, idempotency. |
| `data-modeler` | Designs and evolves a data model — entities, keys, indexing for the real queries, constraints, safe migration. |
| `code-explorer` | Maps an unfamiliar codebase — entry points, the path an operation takes, where responsibilities live, with `file:line` anchors. |
| `refactorer` | Restructures code without changing behavior — extract, rename, dedupe, simplify. |
| `migrator` | Plans and executes staged, reversible migrations (data, schema, API, framework) — no big-bang, with a rollback path. |
| `performance-optimizer` | Fixes a measured performance problem end to end — baseline, profile, one change, re-measure — behavior held constant. |
| `build-fixer` | Diagnoses and resolves build/compile/CI failures with the minimal fix, not a mask. |
| `dependency-upgrader` | Upgrades dependencies safely and incrementally — one group at a time, breaking changes read, build green after each. |
| `test-author` | Authors a characterization suite for untested code — enumerates branches and error paths, pins current behavior. |
| `test-reviewer` | Reviews existing tests for whether they actually protect behavior — real assertions over mock calls, edges covered. |
| `e2e-runner` | Generates, maintains, and runs end-to-end tests for real user journeys — framework-agnostic, flakiness-averse. |
| `accessibility-reviewer` | Reviews UI for accessibility — semantic HTML, keyboard operability, contrast, accessible names, ARIA last. |
| `infra-config-reviewer` | Reviews IaC and deploy config — over-broad permissions, public exposure, root containers, unpinned images, plaintext secrets. |
| `pr-describer` | Turns a diff and its commit history into a review-ready PR description. |
| `doc-writer` | Writes and maintains documentation, keeping it accurate to the code. |

### Skills (32)

In-conversation discipline. Applied while the assistant is already working, not delegated.

**Working method (11)**

| Skill | What it does |
| --- | --- |
| `tdd-workflow` | Test-first development with explicit red-green-refactor loops. |
| `test-writing` | Adds tests to code that already exists, characterizing current behavior. |
| `code-review` | Self-review discipline before handing a change to another reviewer. |
| `error-debugging` | In-conversation debugging discipline; companion to the `debugger` agent. |
| `verification-loop` | Prove a change works by running it before declaring it done. |
| `search-first` | Search the codebase and dependencies for an existing solution before writing new code. |
| `git-commit-craft` | Conventional commit messages that explain why, not just what. |
| `release-notes` | Turn a release's commits into notes for the reader deciding whether to upgrade — breaking changes first. |
| `session-handoff` | Structured handoff notes so the next session resumes without re-deriving context. |
| `strategic-compact` | Compact the working context deliberately at task boundaries, not at an arbitrary auto-truncation point. |
| `continuous-learning` | Turn a hard-won session insight into a durable, reusable note before it scrolls away. |

**Design and data (3)**

| Skill | What it does |
| --- | --- |
| `api-design` | Design a clean, consistent, protocol-agnostic API contract before implementing it. |
| `data-modeling` | Design and evolve a schema deliberately — entities, keys, indexing for the real queries, expand-and-contract change. |
| `database-transactions` | An atomic unit of work, the isolation level that blocks the anomaly you face, short spans, retry on deadlock. |

**Reliability and operations (8)**

| Skill | What it does |
| --- | --- |
| `resilience` | Design for failure on purpose — timeouts, bounded retries with backoff, idempotency, circuit breakers, degradation. |
| `rate-limiting` | Protect a service from overload and abuse — the right algorithm, keyed by identity, a correct `429`/`Retry-After` contract. |
| `background-jobs` | Queued and async work for at-least-once delivery — idempotent jobs, bounded retries with a dead-letter, checkpointing. |
| `caching` | Add a cache deliberately — key on every input, pair a TTL with invalidation, guard the stampede. |
| `observability` | Make a system debuggable from the outside — structured logs, the right levels, metrics, tracing, never secrets in logs. |
| `incident-response` | Mitigate before you diagnose, coordinate through one commander, then a blameless postmortem with owned actions. |
| `feature-flags` | Decouple deploy from release — ship dark, turn it on deliberately, delete the flag once it has served its purpose. |
| `ci-pipeline-authoring` | Fast, trustworthy signal — ordered stages, caching, fail-fast, required checks that actually gate a merge. |

**Security (3)**

| Skill | What it does |
| --- | --- |
| `security-review` | Walk the threat model of your own change before you ship it — input, authz, secrets, crypto, dependencies. |
| `secrets-management` | A secret across its whole lifecycle — out of source and image layers, injected at runtime, least privilege, rotated. |
| `supply-chain-security` | Pin and lock, audit for advisories, vet a dependency before adding it, treat install scripts and typosquats as attack surface. |

**Correctness under real conditions (2)**

| Skill | What it does |
| --- | --- |
| `concurrency-safety` | Prefer immutability and message-passing; protect shared mutable state with the right primitive; avoid races and deadlocks. |
| `datetime-handling` | UTC at rest, timezone-aware values, monotonic elapsed time, deliberate DST and leap handling. |

**Platform and craft (5)**

| Skill | What it does |
| --- | --- |
| `containerization` | Images that are small, reproducible, cache-friendly, and non-root, with no secrets baked into a layer. |
| `accessibility` | Semantic HTML first, full keyboard operability, sufficient contrast, accessible names, ARIA only as a last resort. |
| `perf-profiling` | Fix a performance problem by measurement — baseline, profile, one change, re-measure — not by guesswork. |
| `mcp-authoring` | Build an MCP server a model can actually use — clear tool descriptions, tight schemas, structured errors, no hardcoded secrets. |
| `eval-harness` | Know whether a change to an LLM system improved it — a fixed eval set, graders, a baseline, regression gates. |

### Commands (21)

Slash commands wrapping the most-used agents and skills:

`/plan` `/review` `/debug` `/commit` `/handoff` `/refactor` `/document` `/architect` `/security-review` `/build-fix` `/verify` `/e2e` `/upgrade-deps` `/migrate` `/release-notes` `/explore` `/review-tests` `/optimize` `/design-api` `/model-data` `/describe-pr`

They sync to Claude Code and OpenCode — the two harnesses with a user-extensible command primitive. Cursor and Codex receive the agents and skills behind them.

### Rules (18)

Auto-attaching, per-file-type guidance, one directory per language:

| Category | Rules |
| --- | --- |
| Languages | `typescript` `javascript` `python` `go` `rust` `java` `csharp` `cpp` `c` `kotlin` `ruby` `php` `swift` `sql` |
| Shells | `bash` `powershell` |
| Config formats | `yaml` `terraform` |

They cover strictness, null / resource / memory safety, error handling, injection safety, and config footguns. Claude Code receives each verbatim; Cursor receives it as a `.mdc` auto-attached to that language's files via globs derived from the `language` field; Codex receives it as a skill.

### Hooks (7)

Claude Code `PreToolUse` guards you wire in from `settings.json`. They are copied into `.claude/hooks/`, never enabled behind your back — read one before you turn it on.

| Hook | What it blocks |
| --- | --- |
| `protect-generated-dirs` | Edits to the generated harness directories. |
| `secret-scan-on-edit` | Writing a secret into source. |
| `block-secret-file-stage` | Staging a `.env` or key file. |
| `block-no-verify` | `--no-verify` and commit-signing bypass. |
| `block-force-push` | Force-pushing a shared branch. |
| `guard-dangerous-bash` | Catastrophic shell commands. |
| `protect-lockfile-edit` | Hand-edits to a dependency lockfile. |

### MCP servers (2)

Harness-neutral JSON definitions — the filename is the server name. `filesystem` and `git`. Sync merges each into `.mcp.json` (Claude Code), `.cursor/mcp.json` (Cursor), and `opencode.json` (OpenCode, whose differently-shaped config is translated for it). Never inline a secret; reference an environment variable the harness expands.

## Setup

Requires Node.js 18 or newer. There are no runtime or dev dependencies to install, and no lockfile.

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

143 tests run on Node's built-in test runner (`node:test`) with no external framework. They cover the transform layer — the part with real logic rather than file copying — and the one hook whose contract is a process exit code:

- `tests/frontmatter.test.js` — the shared frontmatter parser and validators: CRLF endings, an empty body, a missing block, array-shaped values like `tools: [Read, Grep]`, a description that contains a colon, and the required-field and description-length checks.
- `tests/cursor-transform.test.js` — `toCursorRule` across the with-frontmatter, without-frontmatter, and already-declares-`alwaysApply` cases, body-spacing normalization, and `globs` injection / `globsForLanguage` mapping.
- `tests/codex-transform.test.js` — `renameSkill`, `agentToSkill`, and `ruleToSkill`: field drops, body preservation, description fallback, and null on input that has no frontmatter.
- `tests/opencode-transform.test.js` — `agentToOpenCodeAgent` (sets `mode: subagent`, drops `name`/`tools`/`model`, preserves the body) and `commandToOpenCode` (keeps `description`, drops `argument-hint`, preserves `$ARGUMENTS`).
- `tests/protect-generated-dirs.test.js` — the hook is a script, not a function, so this runs the real thing as a child process and asserts on its exit code (`0` allow / `2` block): every generated location blocks, source files and the user-editable `.mcp.json` / `opencode.json` do not, Windows separators and absolute paths normalize, each block message names the right source file, and a malformed payload fails open rather than wedging the session.

CI (`.github/workflows/sync-check.yml`) runs three jobs on every push and pull request: sync determinism, frontmatter lint, and the test suite. A `release` workflow cuts a GitHub Release from a `v*` tag and the matching CHANGELOG section, gated on the same three checks.

## Tech stack

- **Node.js 18+**, ES modules, zero dependencies — `scripts/` uses only the standard library (`node:fs/promises`, `node:path`, `node:url`, `node:os`). No `js-yaml`, no CLI framework; the frontmatter parser is ~40 lines in `scripts/frontmatter.js`.
- **node:test** for unit tests. No Jest, no Vitest, no config file.
- **Bash and PowerShell** installers for cross-platform install.
- **GitHub Actions** for CI, plus Dependabot on the manifest and the workflows.

The dependency count is not an accident. A tool that writes config into your `~/.claude/` should not drag a transitive dependency tree along with it.

## Status and limitations

v0.15.0. Four harness adapters. A few things are deliberately limited today, and the code says so plainly:

- Commands sync to Claude Code and OpenCode, the two harnesses with a user-extensible command primitive. Cursor and Codex receive the agents and skills behind those commands, but not the commands themselves.
- Hooks sync to Claude Code only. Cursor, Codex, and OpenCode have no drop-in hooks directory; their event models differ and need a dedicated mapping.
- Cursor rules auto-attach via globs when the rule's `language` is one of the known mappings in `LANGUAGE_GLOBS`; an unmapped language still ships as `alwaysApply: false` (opt-in).
- Codex rules sync as skills (`agentry-<category>-<name>`), since Codex has no rules primitive distinct from skills. A first-class Codex rules model, if one emerges, would replace this approximation.
- Codex MCP is deferred — it stores servers as TOML in a shared config file rather than a per-project JSON map.
- OpenCode receives agents, skills, and commands, but not rules or hooks. Its rules model is `AGENTS.md` plus the `instructions` config — a separate mapping. Agent `tools`/`model` are dropped rather than translated to OpenCode's permission-map and `provider/model` shapes; deriving them is a possible enhancement.

For the design in depth, see [`docs/architecture.md`](docs/architecture.md) for the adapter pattern, [`docs/authoring.md`](docs/authoring.md) for the authoring guide, [`docs/reference.md`](docs/reference.md) for a per-file and per-module map, and [`docs/decisions.md`](docs/decisions.md) for the numbered design decisions and their trade-offs.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first — it states the bar, and what gets rejected. Bug reports and proposals both have [issue forms](.github/ISSUE_TEMPLATE). Security problems go to a [private advisory](https://github.com/MANVENDRA-github/agentry/security/advisories/new), never a public issue — see [`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE).
