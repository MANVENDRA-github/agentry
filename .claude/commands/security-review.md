---
description: Run a focused security review with the security-reviewer agent.
argument-hint: [file | diff range | PR# | description]
---

Invoke the `security-reviewer` agent to audit for vulnerabilities: $ARGUMENTS

If $ARGUMENTS is empty, default to reviewing the current branch's diff against `main` — that is, `git diff main..HEAD`. Tell the user this is the default scope before delegating, so they can correct it if they meant a different range, a specific file, or the whole surface of a feature.

$ARGUMENTS may be a file path, a diff specifier (`main..HEAD`, `HEAD~3..HEAD`), a PR number, or a free-form description of the surface to audit (e.g. "the new upload endpoint and everything it calls").

This is the security-specialist pass — injection, access control, secrets, crypto, and dependency risk through a threat-model lens. For a general correctness-and-maintainability review, use `/review` (the `code-reviewer` agent) instead.
