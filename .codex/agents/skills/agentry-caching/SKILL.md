---
name: agentry-caching
description: Add a cache deliberately — key it on every input, pair a TTL with explicit invalidation, guard the stampede, and cache only what is expensive, reused, and staleness-tolerant. Invoke when adding or changing a cache at any layer. Skip for cheap or rarely-reused computation where a cache adds risk without a measured win.
---

# Caching

There are two hard things in computer science, the joke goes, and caching is one and a half of them: naming things (the cache key) and invalidation. The joke is accurate. A cache trades correctness risk for speed — it serves a remembered answer instead of computing the true one — and every cache bug is some version of "we served the wrong remembered answer": stale data after an update, one tenant's data under another's key, a value that was never valid cached forever. The discipline is to add a cache only where the speed is worth the risk, and to design the key and the invalidation so the remembered answer is never wrong in a way that matters.

## When to invoke

- Adding or changing a cache at any layer — in-process memory, a shared store (Redis/Memcached), HTTP/CDN, a memoized computation.
- Diagnosing stale data, a cache that returns the wrong tenant's or user's value, or a thundering-herd latency spike on expiry.

## When NOT to invoke

- Computation that is already cheap, or a value rarely reused — the cache adds a correctness risk and a memory cost with no measurable speed win.
- Before you have measured. A cache is an optimization; add it against a real hot path, not a hunch (see the `perf-profiling` discipline).

## The discipline

- **The key includes every input the value depends on.** Tenant/user id, locale, version, feature-flag state, permissions — anything that changes the answer belongs in the key. The classic breach is a key that omits the tenant, so cache entries leak across tenants. If two requests would compute different values, they must have different keys.
- **Cache-aside as the default shape.** On read: check the cache; on miss, compute, store with a TTL, return. It is simple, and the cache being empty or down degrades to "slow," not "wrong."
- **A TTL *and* explicit invalidation.** The TTL bounds staleness for everything; explicit invalidation (or write-through) handles the updates you know about, so a change is reflected immediately rather than after the TTL. TTL alone means every update is stale until it expires; invalidation alone means a missed invalidation is stale forever.
- **Guard the stampede.** When a hot key expires, every concurrent request misses at once and hammers the origin — the thundering herd. Defend with single-flight/locking (one request recomputes, the rest wait), TTL jitter (so keys don't all expire together), or early/background recomputation before expiry.
- **Cache what fits the profile: expensive, reused, and staleness-tolerant.** All three. An expensive value read once does not benefit; a cheap value gains nothing; a value that must be exactly current (a balance, an authz decision) should not be cached casually — a stale "allowed" is a security bug.
- **Bound it and measure it.** Set a max size with an eviction policy (LRU) so the cache cannot grow into an OOM. Track the hit rate — a cache with a low hit rate is pure overhead and risk; the number tells you whether it earns its place.

## Anti-patterns

- **A key missing an input** — the cross-tenant / cross-user data leak, the most dangerous cache bug there is.
- **Unbounded cache** with no eviction — a slow memory leak that ends in an OOM.
- **Caching the error/miss path** (a transient failure or an empty result) with a long TTL, so a blip becomes a sticky wrong answer.
- **Invalidate-by-hope** — assuming the TTL is short enough that you don't need real invalidation, then shipping a 24h TTL on data users expect to update instantly.
- **Caching an authorization decision** so a revoked permission still reads as granted until expiry.
- **No hit-rate metric**, so a cache that never helps sits there adding risk invisibly.
