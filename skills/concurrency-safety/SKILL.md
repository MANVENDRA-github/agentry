---
name: concurrency-safety
description: Reason about shared state under concurrency — prefer immutability and message-passing, protect shared mutable state with the right primitive, avoid races and deadlocks. Invoke when writing code that runs on multiple threads, coroutines, or processes touching shared state. Skip for single-threaded or purely sequential logic.
---

# Concurrency safety

Concurrency bugs are the worst kind: they are non-deterministic, they usually pass every test on your machine, and they surface as a corrupted value or a hung process in production under load you can't reproduce. The cause is almost always the same shape — two flows of execution touching the same mutable state without coordination, and the outcome depending on which one happened to get there first. You cannot debug your way out of this reliably; you have to design it out. The whole discipline is: know exactly what state is shared and mutable, and make every access to it coordinated — or make the state not shared, or not mutable.

## When to invoke

- Writing code that runs on multiple threads, coroutines, async tasks, or processes that touch common state.
- Adding shared caches, counters, connection pools, or in-memory state to a concurrent server.
- Diagnosing a heisenbug: intermittent corruption, a value that is "sometimes wrong," a deadlock or a hang under load.

## When NOT to invoke

- Single-threaded or strictly sequential code with no shared mutable state.
- Pure functions and immutable data — they are concurrency-safe by construction; there is nothing to coordinate.

## The discipline

- **Prefer designs with no shared mutable state.** The safest race is the one that can't exist. Favor immutable data (copy-on-write, persistent structures), confine state to a single owner and communicate by passing messages (channels, queues, actors) rather than sharing memory, and keep functions pure where you can. Most concurrency safety is achieved by *not sharing*, not by locking well.
- **When you must share mutable state, protect every access.** Pick the right primitive for the job: a mutex/lock for a compound update, an atomic for a single counter or flag, a read-write lock when reads vastly outnumber writes, a concurrent/thread-safe collection instead of guarding a plain one by hand. The rule is total — *every* read and write of the shared value goes through the same coordination, not just the writes.
- **Assume nothing is atomic unless it is documented to be.** `count++` is read-modify-write — three steps, interruptible between each. Check-then-act (`if (!map.contains(k)) map.put(k, v)`) is a race even when each call is individually safe. Use an atomic operation or a compare-and-swap / `computeIfAbsent`-style primitive that does the whole thing as one step.
- **Avoid deadlock by discipline on locks.** Hold a lock for the shortest span that keeps the invariant, never do I/O or call unknown code while holding one, and when you must hold two, always acquire them in the same global order everywhere. A lock ordering that differs between two code paths is a deadlock waiting for the right interleaving.
- **Bound the concurrency.** Unbounded task spawning, an unbounded queue, or a pool with no limit turns a load spike into memory exhaustion. Cap the pool, bound the queue, and decide what happens when the bound is hit (backpressure, reject, shed).

## Anti-patterns

- **Check-then-act races.** `if (!exists) create()` across threads creates twice. Make it one atomic operation.
- **Guarding only the writes.** A read that races an unsynchronized write can see a torn or stale value. Coordinate reads too.
- **Sharing a non-thread-safe client or buffer** across threads because "it seemed to work." It works until it doesn't, under load, in production.
- **`sleep` as synchronization** — waiting a bit and hoping the other task is done. Use a real signal: a latch, a future, a condition variable, a join.
- **Double-checked locking done wrong**, or any clever lock-free trick without the memory-model guarantees to back it. Reach for a vetted concurrent primitive instead of inventing one.
- **Holding a lock across I/O or a callback**, inviting both contention and deadlock.
