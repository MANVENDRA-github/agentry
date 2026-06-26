---
description: Diagnose and resolve a build, compile, or CI failure with the build-fixer agent.
argument-hint: [optional: the failing command or error]
---

Invoke the `build-fixer` agent to get the build green: $ARGUMENTS

If $ARGUMENTS is empty, find the failure first: look for the project's build, type-check, or test command (in `package.json`, a `Makefile`, CI config, or the README) and run it to surface the actual error. Then delegate to the agent with that output.

$ARGUMENTS, if provided, is the failing command, the error text, or a pointer to where it fails (e.g. "CI step `npm run build`" or a pasted compiler error).

The agent reads the real error, finds the root cause, and applies the minimal fix — it does not mask the failure by deleting a test, casting to `any`, or disabling a flag. If the only fix is to weaken the build, it will say so rather than do it silently.
