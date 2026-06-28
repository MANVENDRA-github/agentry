---
description: Review existing tests for whether they actually protect behavior, with the test-reviewer agent.
---

Invoke the `test-reviewer` agent to review the tests in: $ARGUMENTS

If $ARGUMENTS is empty, default to the test files changed on the current branch against `main` (`git diff main..HEAD`) — tell the user this is the default scope before delegating, so they can point you at a specific test file, directory, or range instead.

$ARGUMENTS may be a test file, a directory of tests, a diff specifier, or a description of the behavior whose tests you want judged.
