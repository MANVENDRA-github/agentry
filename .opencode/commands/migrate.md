---
description: Plan and execute a staged, reversible migration with the migrator agent.
---

Invoke the `migrator` agent to move from one state to another without a flag day: $ARGUMENTS

If $ARGUMENTS is empty, first establish what is moving and to what: the old shape (API, schema, framework version, config format) and the target. Then map every place that touches it before changing anything.

$ARGUMENTS, if provided, describes the migration — the from-state and to-state, or a pointer to the deprecation/upgrade driving it.

The agent maps the full surface, picks a transition strategy that keeps the system working throughout (expand/contract, parallel run, or an adapter), migrates one slice at a time with verification after each, and keeps both old and new working until the last consumer moves. It backs up and dry-runs data migrations, and it will not big-bang the change or break callers mid-flight.
