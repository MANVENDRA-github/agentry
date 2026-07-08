<!--
Title must use a conventional prefix: feat: fix: refactor: docs: chore: test:
One logical change per PR. A new agent is one PR; a new agent plus a sync-engine
refactor is two.
-->

## What changed

<!-- One or two sentences. What does this PR do? -->

## Why

<!--
The part reviewers cannot reconstruct from the diff.

If this adds an agent, skill, command, rule, or hook, name the concrete problem
you hit that it solves. "Might be useful" is rejected — see CONTRIBUTING.md.
-->

## Checklist

- [ ] Source-of-truth files changed under `agents/`, `skills/`, `commands/`, `rules/`, `hooks/`, or `mcp/` — **not** the generated dirs
- [ ] `npm run sync` ran, and the regenerated harness files are committed in this PR
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] New component's `description` names its trigger condition explicitly
- [ ] New component matches the format and depth of 2–3 existing peers in the same directory

<!--
Reminder: never hand-edit .claude/, .cursor/, .codex/, .opencode/, .mcp.json,
or opencode.json. Sync wipes them. CI fails the PR if source and generated
output disagree.
-->

## Verification

<!--
Paste the real command output. Not "tests pass" — the actual lines.

$ npm run lint
$ npm test
-->

```
```
