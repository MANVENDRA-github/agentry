---
name: database-transactions
description: Use database transactions correctly — wrap a multi-statement unit of work so it commits atomically or rolls back whole, pick the isolation level that blocks the specific anomaly you face (lost update, phantom, write skew) rather than the strongest by default, hold transactions for the shortest span to limit lock contention, and retry on deadlock or serialization failure. Invoke when writing multiple related writes or a read-modify-write against a database. Skip a single-statement write or a read-only query.
---

# Database transactions

A transaction is the database's promise that a group of statements happens all-or-nothing: either every write lands or none does, and no other transaction sees a half-finished state. The bugs come from not using that promise, or misunderstanding its limits. Two writes that should be one unit run without a transaction, the second fails, and the row is now inconsistent forever. A read-modify-write — read a balance, add to it, write it back — runs at an isolation level that lets a concurrent copy read the same old value, and one update silently overwrites the other. Or a transaction is held open across a slow call, holding its locks the whole time, until enough of them pile up to deadlock under load. The discipline is to scope the unit of work correctly, choose the isolation level that actually blocks the anomaly you have, hold it briefly, and be ready to retry when the database aborts you to keep its promise.

## When to invoke

- Writing multiple related writes that must all land together — a transfer that debits one row and credits another, an order plus its line items, a state change plus its audit record.
- A read-modify-write against the database: read a value, compute from it, write it back (a balance, a counter, an inventory count, a status transition).
- Diagnosing inconsistent data after a partial failure, a lost update under concurrency, or deadlocks and lock-wait timeouts under load.

## When NOT to invoke

- A single-statement write. One `INSERT`/`UPDATE`/`DELETE` is already atomic on its own; wrapping it in an explicit transaction adds nothing.
- A read-only query with no consistency requirement across multiple statements. If you are only reading, and don't need several reads to see one consistent snapshot, you don't need to manage a transaction.

## The discipline

- **Scope the transaction to exactly one unit of work.** Everything that must be consistent together goes inside `BEGIN`…`COMMIT`; everything else stays out. The transaction succeeds as a whole or rolls back as a whole — there is no "the debit committed but the credit didn't." On any error inside the block, roll back; never leave a transaction to be committed by accident on a path where a statement already failed.
- **Do only database work inside the transaction.** Open it as late as possible and commit as early as possible. An HTTP call, a queue publish, a file write, or waiting on user input inside an open transaction holds its locks for the entire duration of that slow work — that is how a transaction that touches two rows blocks every other writer and turns into a deadlock. Compute and call out *before* `BEGIN` or *after* `COMMIT`, not between.
- **Pick the isolation level for the anomaly you actually face, not the strongest by default.** The default (usually READ COMMITTED) prevents dirty reads but permits lost updates, non-repeatable reads, and phantoms. Raise it deliberately: REPEATABLE READ / SNAPSHOT to stop a read-modify-write from being clobbered and to make repeated reads stable; SERIALIZABLE when concurrent transactions could interleave into a state no serial order allows (write skew — two transactions each read a shared invariant, each decides its write is fine, and together they violate it). Stronger isolation costs concurrency and more aborts; weaker costs correctness. Name the anomaly, then choose.
- **Guard a read-modify-write against the lost-update race.** Reading a value and writing a derived one back is the classic race: two transactions read the same old value and the second write erases the first. Close it with an atomic write where possible (`UPDATE balance = balance + 10` in one statement, not read-then-set), or with `SELECT … FOR UPDATE` to lock the row you read, or with an optimistic version/`WHERE`-guard (`UPDATE … WHERE version = :read_version`) that fails when the row changed underneath you. Do not rely on the default isolation level to catch it — READ COMMITTED will not.
- **Expect deadlocks and serialization failures, and retry them.** Under real concurrency the database *will* abort some transactions to break a deadlock or enforce SERIALIZABLE — this is correct behavior, not a bug. A serialization/deadlock error means "your transaction didn't run; run it again." Wrap the whole unit of work in a bounded retry loop with a little backoff, and make the work retry-safe (re-read inside the retry, don't reuse stale values from the aborted attempt). A transaction with no retry on these errors surfaces them to the user as a hard failure.
- **Match the retryable errors to your engine.** Postgres raises `40001` (serialization failure) and `40P01` (deadlock detected); MySQL/InnoDB raises `1213` (deadlock) and `1205` (lock wait timeout). Retry those specific classes; do not blanket-retry every error — a constraint violation or a bad input will just fail again.

## Anti-patterns

- **Related writes with no transaction** — the second statement fails and the first is already committed, leaving a half-applied state (money debited but not credited) that no rollback ever cleans up.
- **A long-running transaction that holds locks across slow work** — an external API call, a large computation, or an idle prompt between `BEGIN` and `COMMIT`, blocking other writers and inviting deadlock.
- **Read-modify-write at the default isolation level** with no locking or version guard — the lost update: two concurrent updates, one silently overwrites the other.
- **Reaching for SERIALIZABLE everywhere** to feel safe — you pay in throughput and a storm of serialization aborts you then don't retry, so the "safe" choice becomes a reliability problem.
- **No retry on deadlock/serialization failure** — treating a transient, expected abort as a fatal error and failing the user's request instead of running the unit of work again.
- **Catching the error and committing anyway**, or swallowing a failed statement so a broken transaction commits partial work — the rollback exists precisely for this path.
- **Business logic that assumes the read inside a transaction is still current at write time** without a lock or version check — the gap between read and write is exactly where the race lives.
