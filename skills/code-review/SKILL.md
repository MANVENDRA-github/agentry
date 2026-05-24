---
name: code-review
description: Self-review discipline for in-conversation use — apply before declaring code complete or before committing. Walks correctness, security, maintainability, and convention checks at the time of writing. For focused review of a large diff in a fresh context, delegate to the code-reviewer agent.
---

# Code review (self)

The careful re-read that catches issues at writing time, before they reach the reviewer or production. The failure mode this prevents: shipping code that compiles and passes the test you wrote, but contains issues a careful re-read would have surfaced — off-by-one errors, swallowed errors, missing authorization, names that lie. Self-review is cheap; the same issue caught by a reviewer or production is expensive.

## When to invoke

- Just finished writing a non-trivial chunk of code, before declaring it done.
- About to commit work.
- About to hand a branch to someone else for review — catch your own issues first.
- After applying a fix to a bug, before claiming the fix is verified.

## When NOT to invoke (and what to do instead)

- **The change is a one-line fix or typo.** Just commit.
- **The diff is large enough that self-review under a working-session context would not be thorough** — your attention is split, you have been staring at the code for hours, or the diff crosses many files. **Delegate to the `code-reviewer` agent.** A fresh context reviews better than a tired one.
- **A structured review artifact is needed** for the team (PR review, audit trail, prioritized findings). **Delegate to the `code-reviewer` agent.** The agent produces a structured report; this skill produces a mental pass.

If it is a quick re-read pass before commit, this skill. If it is a fresh-context structured review, the agent.

## The review bands

Walk these in order. Stop at the highest band with substantive issues — do not nit-pick style while correctness is still open.

### Correctness

- Off-by-one and boundary errors. Empty inputs, single-element inputs, last-index access.
- Null, undefined, or missing values reaching code that assumes presence.
- Swallowed errors — caught and ignored, logged and continued, or re-thrown with lost context.
- Logic that diverges from what the function name or comment claims.
- Tests that assert on the wrong thing — mock return values instead of behavior, presence of a call instead of its effect.
- Race conditions when the code involves shared mutable state or async ordering.

### Security

- Unsanitized input reaching SQL, HTML, shell commands, filesystem paths, or template engines.
- Authorization checks missing, misplaced, or applied at the wrong layer.
- Secrets in source, logs, error messages, or commit history.
- New dependencies you did not vet — unmaintained, oversized for the use case, or a supply-chain risk.
- Permissive defaults: open CORS, disabled auth flags, debug endpoints exposed.

### Maintainability

- Names that lie. `validateUser` that mutates state. `getThing` that performs I/O. `isReady` with side effects.
- Hidden coupling — a change here that silently requires a change somewhere else.
- Premature abstraction. A generic interface for one caller. A strategy pattern around one strategy. A config knob with one value.
- Duplication of logic that already exists elsewhere in the codebase. Reach for the existing helper before creating a new one.
- Dead code: unused exports, unreachable branches, commented-out blocks.

### Conventions

- Matches patterns visible in nearby code — file structure, naming, error handling, imports.
- Conforms to CLAUDE.md, CONTRIBUTING.md, lint config.
- Departures from convention have a comment explaining why.

## What you do not do during self-review

- Do not rewrite the code as you find issues. Note them, finish the review, then fix in a focused pass. Editing mid-review loses your place and produces patchy coverage.
- Do not invent issues to feel thorough. A clean re-read with nothing substantive to flag is the correct outcome of well-written code.
- Do not skip running the tests. Self-review with stale test output is partial review. If tests have been re-run since the last code change, the output is fresh; otherwise, re-run.
- Do not skip the parts of the diff you remember writing well. Memory is unreliable about your own code.

## Verifying you actually reviewed

Before declaring the code complete:

- Did you re-read every modified file end-to-end, including the parts you thought were obvious?
- Did you run the tests after the last code change, and did they pass?
- Did you check the parts of the diff outside the function you focused on (imports, type signatures, callers)?
- Could you, in one sentence, describe what each substantive change does and why?

If the answer to any of these is no, the review is not done.

## Anti-patterns

- Reviewing only the code you remember writing. Re-read the whole diff.
- Treating "the tests pass" as proof of correctness. Tests are a floor, not a ceiling — they catch what they were written to catch.
- Self-review under time pressure that you would not accept from someone else. If you are rushing, either defer to a fresh pass later or delegate to the agent.
- Stopping at the first issue and concluding the review. Walk the whole diff; you may find a more serious issue further down.
- Reviewing in the same context where you wrote the code, when the diff is large. Switch to the agent for fresh eyes.
