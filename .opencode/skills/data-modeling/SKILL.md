---
name: data-modeling
description: Design and evolve a data model deliberately — entities and relationships, keys, normalization vs denormalization, indexing for the real queries, constraints, and schema change you can roll out safely. Invoke before adding or reshaping persistent storage. Store-agnostic. Skip for a single throwaway table.
---

# Data modeling

The discipline of designing the shape of your data deliberately, before the application and a million rows are built on top of it. A data model is the most expensive thing in a system to change: code is a refactor away from better, but a schema with live data and dependent queries is a migration, a backfill, and a coordinated deploy away from better. The model also quietly dictates what the application can do cheaply and what it cannot — the query you did not design for is the one that turns into a full scan in production. Get the shape right early, because later is costly.

This is store-agnostic. Relational, document, key-value, graph — the engine differs; the questions about entities, relationships, keys, and access patterns do not.

## When to invoke

- Adding or reshaping anything persistent — a table, a collection, a core document, an event schema.
- Designing storage for a new feature, before the queries and code depend on a shape you guessed at.
- Changing a schema that already has data and readers, where the change has to be staged safely.

## When NOT to invoke

- A throwaway table, a cache you can drop and rebuild, a scratch structure with no readers and no durability requirement. Model deliberately what is expensive to change; do not ceremonialize what is not.

## Model the domain, then the access

- **Entities and relationships first.** What are the real things (a user, an order, a payment), and how do they relate — one-to-one, one-to-many, many-to-many? Name them for the domain, not the screen they first appear on. The relationships drive the keys.
- **Keys and identity.** Every entity needs a stable identity. Prefer a key that does not change and does not encode meaning that might — a surrogate id over "email as primary key," because emails change. A many-to-many relationship is its own thing with its own key.
- **Design for the queries you will actually run.** Enumerate the real access patterns — "fetch a user's orders newest-first," "sum revenue by month" — and make those cheap. The model that ignores its read patterns is the one that needs a rescue index six months in. In relational stores this means indexing the columns you filter and join on; in document and key-value stores it shapes how you nest and key the data.
- **Normalize until it hurts, denormalize until it works.** Normalized data has one source of truth and no update anomalies — change a fact in one place. Denormalization duplicates for read speed and buys a consistency cost: now two copies can disagree. Start normalized; denormalize deliberately, for a measured read pattern, knowing what you took on.
- **Constraints belong in the schema.** Required fields NOT NULL, fixed sets as enums or check constraints, uniqueness and foreign keys enforced by the store where it supports them. A rule the schema enforces cannot be violated by a buggy writer; a rule only the application checks will eventually be bypassed.

## Designing for change

The schema will change; design so the change is survivable.

- **Additive change is cheap; reshaping is not.** Adding a nullable column or a new collection rarely breaks readers. Renaming a field, narrowing a type, or splitting a table breaks every reader at once — and with data present, needs a migration and often a backfill.
- **Expand and contract, never big-bang.** To change a column's shape under live traffic: add the new form, write both, backfill the old data, move readers over, then drop the old form — each step reversible. (This is the `migrator` agent's territory when the change is large.)
- **Model time and state explicitly.** A status is an enum with known values, not a free string. If you need history — "what was the price when the order was placed" — model it as its own record; do not overwrite the field and lose the past.
- **Avoid premature partitioning and sharding.** Splitting data across shards for a scale you do not have yet buys operational pain now for a problem you may never hit. Design the model cleanly; partition when the numbers say to.

## Anti-patterns

- **Modeling the UI instead of the domain.** A table shaped like today's screen rots the moment the screen changes. Model the things and their relationships; the screen is a projection.
- **Meaningful primary keys.** Keying on something that can change or repeat — email, name, "first initial + birth year" — guarantees a painful migration when the assumption breaks.
- **Enforcing invariants only in code.** "This is always one of three values," that the schema permits as any string, will — given enough writers and enough time — hold a fourth.
- **Unbounded growth with no plan.** A column that accumulates an ever-growing array, a table with no archival story. What is fast at ten thousand rows is a full scan at ten million.
- **Denormalizing first.** Duplicating for speed before you have a measured read problem trades correctness for a performance win you have not shown you need.
