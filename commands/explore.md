---
description: Map an unfamiliar codebase or flow with the code-explorer agent.
argument-hint: [path | flow | "how does X work"]
---

Invoke the `code-explorer` agent to map: $ARGUMENTS

If $ARGUMENTS is empty, default to mapping the repository's main entry points and the primary flow through it — tell the user this is the default scope before delegating, so they can point you at a specific path, module, or flow instead.

$ARGUMENTS may be a directory or file path, a named flow ("the checkout path"), or a question about how something works ("how does auth work").
