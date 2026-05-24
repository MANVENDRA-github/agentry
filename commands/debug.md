---
description: Investigate a bug with the debugger agent in fresh context.
argument-hint: [symptom + expected behavior]
---

Invoke the `debugger` agent to investigate: $ARGUMENTS

If $ARGUMENTS is empty, ask the user for:

- the symptom (what is broken, observable behavior)
- the expected behavior (what should happen instead)
- what changed recently near the suspected area, if known

Then delegate to the agent with that information. Do not start investigating before you have these.
