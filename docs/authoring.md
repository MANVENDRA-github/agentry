# Authoring agents and skills

This is the practical how-to for adding your first agent or skill to agentry. Read it end-to-end before you start writing.

## Before you author

- **Read 2–3 existing files** in the same directory. `agents/code-reviewer.md` and `skills/tdd-workflow/SKILL.md` are the references for v0.1. Match their voice, format, and depth.
- **Justify the addition.** Write down a one-line statement of the concrete problem the new agent or skill solves. If you cannot, the answer is "do not add it."
- **Check it is universal.** v0.1 and v0.2 ship language- and framework-neutral content only. If your draft mentions specific libraries, frameworks, or language syntax, revise it to be universal or save it for a v0.3+ language pack.
- **Search for overlap.** Does an existing skill or agent already do most of what you are about to add? Extend the existing one instead of duplicating.

## Authoring an agent

An agent is a separate Claude instance with its own context, invoked by the main session for a focused task (review this code, write this test, etc.).

### 1. Create the file

```
agents/<name>.md
```

The filename without extension becomes the agent's name. Use kebab-case.

### 2. Write the frontmatter

Exactly four fields, no more, no less:

```yaml
---
name: <name>
description: <one or two sentences, see guidance below>
tools: [Read, Grep, Glob, Bash]
model: sonnet
---
```

- `name` — must match the filename.
- `description` — what the agent does and when to invoke it. See "Writing a good description" below.
- `tools` — Claude Code tool names the agent is allowed to call. Pick the minimum it needs.
- `model` — usually `sonnet` for v0.2. Reach for `opus` only if the task genuinely needs it.

### 3. Writing a good description

The description is how the harness decides whether to invoke this agent. Two failure modes to avoid:

- **Too vague.** "Reviews code" causes the agent to fire on requests like "explain this code" where review is not what the user wanted.
- **Missing trigger.** A description that names what the agent does but not when to invoke it is incomplete.

Good descriptions name (a) what the agent does and (b) the specific situation in which to use it, and ideally (c) what NOT to use it for if confusion is likely.

Length: roughly 25–50 words. One or two sentences.

### 4. Write the system prompt body

This is the markdown that becomes the agent's system prompt. Style:

- **Second person.** "You read the diff. You report findings."
- **Imperative.** "Stop at the highest band with substantive issues."
- **Concrete over abstract.** "Off-by-one" beats "logical errors."
- **No language-specific examples.** The agent must work in any language.
- **Length: roughly 80–150 lines.** Loaded into context on every invocation, so bloat is expensive.

Recommended structure: a short role statement, a how-you-work procedure, what-you-look-for sections, an output format, and a list of what-you-do-not-do.

### 5. Sync, verify, lint, commit

```bash
npm run sync
ls .claude/agents/<name>.md          # should exist
ls .cursor/agents/agentry-<name>.md  # should exist
npm run lint                         # should pass
git add agents/<name>.md .claude/agents/<name>.md .cursor/agents/agentry-<name>.md
git commit -m "feat: add <name> agent"
```

Commit source and generated files together. CI will fail the PR otherwise.

## Authoring a skill

A skill is a procedural protocol the main Claude follows during regular conversation. It is loaded when the situation matches the description.

### 1. Create the file

```
skills/<name>/SKILL.md
```

Skills live in their own directory because they may eventually bundle siblings (helper scripts, reference docs). For v0.2 there is only the one file.

### 2. Frontmatter

Exactly two fields:

```yaml
---
name: <name>
description: <one or two sentences, see guidance below>
---
```

No `tools` or `model` — those are agent concepts.

### 3. Description

Same guidance as agents. For skills, the "when NOT to invoke" half is especially important — skills often misfire on tasks that look superficially similar. Name both the trigger conditions and the skip conditions explicitly.

### 4. Body

Skills are procedural. Write them like a playbook:

- **Imperative mood**, second person.
- **Step-by-step structure** where it helps; clear headers for skimming.
- **No persona framing.** "Test-driven development applied for real" is fine; "You are a TDD expert" is not — that is agent voice.
- **Length: roughly 100–180 lines.**

### 5. Sync, verify, lint, commit

```bash
npm run sync
ls .claude/skills/<name>/SKILL.md      # should exist
ls .cursor/rules/<name>.mdc            # should exist
npm run lint
git add skills/<name>/SKILL.md .claude/skills/<name>/SKILL.md .cursor/rules/<name>.mdc
git commit -m "feat: add <name> skill"
```

## A worked example

Below is a complete (but invented — not in the repo) skill called `tone-check`. Use the shape as a starting template, not the content.

```markdown
---
name: tone-check
description: Reviews documentation, error messages, and user-facing copy for tone consistency — flags marketing fluff, hype words, and condescension. Invoke before publishing or shipping user-visible text. Skip for internal-only code comments and PR descriptions.
---

# Tone check

A pass over user-facing text to catch tone problems before they reach a reader. The goal is honest, plain copy — not polished marketing.

## When to use

- Documentation about to ship: README, docs/, changelog entries.
- Error messages and CLI output the user sees.
- Onboarding text, empty states, in-app help.

## When to skip

- Code comments.
- Internal PR descriptions.
- Test fixtures and example data.

## What to flag

- **Hype words** — "blazing fast," "revolutionary," "game-changing." Cut or replace with a measurable claim.
- **Empty intensifiers** — "very," "really," "literally," "actually." Usually deletable with no loss of meaning.
- **Condescension** — "simply," "just," "obviously," "of course." Implies the reader is slow if they do not follow.
- **Marketing voice** — second-person sales pitch in technical docs ("you will love this feature"). Convert to factual description.
- **Apologetic hedging** — "we tried to," "sort of," "kind of." If the thing works, say so. If it does not, say what is missing.

## How to report

For each finding:

- Quote the offending phrase.
- Name the category (hype, intensifier, condescension, marketing, hedging).
- Suggest a replacement or recommend deletion.

End with a one-line summary: how many findings, and whether the document is ready to ship.
```

That is the whole file. Copy the shape, replace the content.

## Authoring a rule

A rule is a focused piece of guidance that should apply when the developer is working in a specific context — usually a specific language (`typescript`, `python`, `go`) but sometimes a topic (`security`, `performance`). Rules differ from skills in two ways:

- **Triggered by context, not user intent.** Skills get invoked because the user is doing something the skill helps with (TDD, debugging). Rules apply because the user is working in a specific context (TypeScript files, a security-sensitive area). The harness — not the user — decides when the rule kicks in.
- **Smaller in scope per file.** A skill is a multi-step protocol. A rule is one tight piece of guidance ("use strict mode," "narrow types at API boundaries," "log structured errors"). One rule per file; one concern per rule.

The v0.3 pattern proof ships one rule: `rules/typescript/strict-mode.md`. Read it as the reference for length, depth, and voice before authoring your own.

### 1. Create the file

```
rules/<category>/<rule-name>.md
```

The category is usually a language identifier (`typescript`, `python`, `go`) but may be a topic (`security`, `performance`) for non-language rules. The nesting establishes a namespace so rule names do not collide across categories. Use kebab-case for the rule name.

### 2. Frontmatter

```yaml
---
name: <rule-name>
description: <when this rule applies, what it covers>
language: <language identifier>   # optional, used by Cursor for context targeting
---
```

- `name` — must match the filename (without `.md`).
- `description` — names the trigger condition and the skip conditions, same discipline as skills. ≥20 characters.
- `language` — optional. Present for language-specific rules; absent for topic rules. v0.3 does not yet derive Cursor globs from this field, but the field is preserved for forward compatibility.

### 3. Body

Same voice as skills: imperative, second person, concrete over abstract. The rule's body applies *in* a specific context, but the body itself should not include code samples — every example costs tokens on every invocation, and a rule that says "prefer X over Y" lands better than one that pastes 10 lines of sample code.

Length: roughly 40–80 lines including frontmatter. Smaller than skills because a rule covers one concern.

### 4. Per-harness behavior

- **Claude Code:** copied verbatim to `.claude/rules/<category>/<rule-name>.md`. Available in the install location; CLAUDE.md can reference it explicitly.
- **Cursor:** transformed to `.cursor/rules/<category>/<rule-name>.mdc` with `alwaysApply: false` added by `toCursorRule`. Opt-in for v0.3; a future enhancement can derive globs from `language` for auto-apply.
- **Codex:** skipped in v0.3 — Codex has its own rules concept and the mapping needs dedicated investigation. Deferred to v0.4.

### 5. Sync, verify, lint, commit

```bash
npm run sync
ls .claude/rules/<category>/<rule-name>.md       # should exist
ls .cursor/rules/<category>/<rule-name>.mdc      # should exist
npm run lint                                     # should pass
git add rules/<category>/<rule-name>.md .claude/rules/<category>/<rule-name>.md .cursor/rules/<category>/<rule-name>.mdc
git commit -m "feat: add <category>/<rule-name> rule"
```

## Authoring an MCP server

An MCP server config tells a harness how to launch (or connect to) a [Model Context Protocol](https://modelcontextprotocol.io) server — a separate process or remote endpoint that exposes tools and resources to the assistant. Unlike agents, skills, and rules, an MCP server is not prose: it is a small JSON object, and it describes the same server across harnesses. That sameness is why it belongs in agentry — otherwise the identical server is re-declared by hand in `.mcp.json` (Claude Code), `.cursor/mcp.json` (Cursor), and `opencode.json` (OpenCode), and the copies drift.

### 1. Create the file

```
mcp/<name>.json
```

One server per file. The filename without `.json` becomes the server's name (`mcp/github.json` → `github`). MCP definitions have no name field of their own — the name is the map key the harness uses — so agentry takes it from the filename, the same way agents and skills take their identity from theirs. Use kebab-case.

### 2. Schema

Each file is the server *definition* object as it appears inside Claude Code / Cursor's `mcpServers` map. Two shapes, by transport.

**Local (stdio) server** — the harness spawns a process:

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
  "env": { "ROOT": "." }
}
```

**Remote (HTTP/SSE) server** — the harness connects to a URL, nothing is spawned:

```json
{
  "type": "http",
  "url": "https://example.com/mcp"
}
```

Required: exactly one transport — a non-empty `command` (stdio) or a non-empty `url` (remote). Optional: `args` (array), `env` (object) for stdio; `type` and auth `headers` for remote.

**Do not put real secrets in the file.** It is committed and synced like every other generated artifact. Reference an environment variable the harness expands at launch (`"env": { "API_KEY": "${GITHUB_TOKEN}" }`) rather than pasting a token.

### 3. Per-harness behavior

- **Claude Code & Cursor:** the definition is written verbatim into a merged `mcpServers` map — `.mcp.json` at the repo root for Claude Code, `.cursor/mcp.json` for Cursor. Servers are sorted by name so the files are byte-stable.
- **OpenCode:** the definition is translated into OpenCode's shape and written to `opencode.json` under the `mcp` key — `type: "local"` with a single `command` array (command + args) and an `environment` map for stdio, `type: "remote"` with `url` and `headers` for remote, plus `enabled: true`.
- **Codex:** skipped. Codex stores servers as TOML under `[mcp_servers.<name>]` in its shared `config.toml`; merging there safely needs dedicated design. Deferred — see [`decisions.md`](decisions.md) D20.

### 4. Sync, verify, lint, commit

```bash
npm run sync
cat .mcp.json                 # Claude Code: your server under mcpServers
cat .cursor/mcp.json          # Cursor: the same map
cat opencode.json             # OpenCode: translated under the mcp key
npm run lint                  # validates JSON + transport shape
git add mcp/<name>.json .mcp.json .cursor/mcp.json opencode.json
git commit -m "feat: add <name> MCP server"
```

Note `.mcp.json` and `opencode.json` live at the repo root, not under a harness directory. agentry treats them as fully generated artifacts: add or change servers by editing `mcp/*.json` sources, never by editing the outputs. Sync writes them only when at least one `mcp/*.json` source exists, and never deletes them — so if you remove the last MCP source, delete a stale output by hand.

## Anti-patterns to avoid

- **Vague descriptions** like "for code review" or "helps with testing." The harness invocation system needs a sharper trigger than this.
- **Language-specific content** sneaking in via examples. If you write `function foo(): string` in an agent body, you have made it less useful for everyone not writing TypeScript.
- **Marketing tone in the body.** The body is operating instructions, not promotional copy.
- **Inline code examples that are not generic.** Every example in an agent or skill body costs tokens on every invocation. Keep them universal or omit them.
- **Adding a component "because it would be cool to have."** If you cannot name a concrete problem it solves, do not add it.
