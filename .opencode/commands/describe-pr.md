---
description: Generate a reviewer-focused PR title and description with the pr-describer agent.
---

Invoke the `pr-describer` agent to write a PR title and description for: $ARGUMENTS

If $ARGUMENTS is empty, default to the current branch against `main` — that is, `git diff main..HEAD`. State the range you are about to describe before delegating, so the caller can correct it if they meant a different base.

$ARGUMENTS may be a base branch, an explicit range (`origin/release..HEAD`, `HEAD~3..HEAD`), or a PR number. For a branch stacked on another unmerged branch, describe against the parent so the output covers only this PR's contribution.

The agent reads the diff and commit history in a fresh context, infers the motivation, and structures the output for fast review. Do not write the description inline — that work lives in the agent. Relay its title and description back to the caller to open or update the PR.
