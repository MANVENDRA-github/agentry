---
description: Restructure code without changing its behavior, via the refactorer agent.
argument-hint: [file or description of what to refactor]
---

Invoke the `refactorer` agent to restructure: $ARGUMENTS

If $ARGUMENTS is empty, default to the files changed on the current branch (`git diff --name-only main..HEAD`). Tell the user this is the default scope before delegating, so they can correct it; if there are no changed files, ask what to refactor instead.
