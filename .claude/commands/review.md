---
description: Run a focused code review with the code-reviewer agent.
argument-hint: [file | diff range | PR# | description]
---

Invoke the `code-reviewer` agent to review: $ARGUMENTS

If $ARGUMENTS is empty, default to reviewing the current branch's diff against `main` — that is, `git diff main..HEAD`. Tell the user this is the default scope before delegating, so they can correct it if they meant a different range or a specific file.

$ARGUMENTS may be a file path, a diff specifier (`main..HEAD`, `HEAD~3..HEAD`), a PR number, or a free-form description of what to review.
