---
description: Design or evolve a data model with the data-modeler agent.
argument-hint: [entity | domain | schema change to model]
---

Invoke the `data-modeler` agent to model: $ARGUMENTS

$ARGUMENTS describes what to model — a new entity or domain, or a change to an existing schema. If it is a change to existing storage, the agent should read the current schema/model first so the design fits what is there and the migration path is concrete and reversible.

If $ARGUMENTS is empty, ask what to model — the entities involved, the store if it is fixed, and the main queries the data must serve — before delegating. Do not invent a domain to model.

The agent produces the model (entities, keys, relationships, indexes tied to real queries, constraints) and, for a change, a staged migration plan — not the application code that uses it.
