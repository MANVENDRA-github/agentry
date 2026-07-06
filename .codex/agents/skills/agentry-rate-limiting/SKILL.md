---
name: agentry-rate-limiting
description: Protect a service from overload and abuse with rate limits — choose an algorithm (token bucket or sliding window, not a naive fixed window that leaks a double-burst at the boundary), key the limit by the right identity (user, IP, or API key), return 429 with a correct Retry-After contract so well-behaved clients back off, and set the ceiling from measured capacity rather than a guess. Invoke when exposing an endpoint that untrusted or high-volume callers reach. Skip for internal, low-volume calls with no abuse or overload risk. Server-side self-protection — the counterpart to resilience, which is the caller side.
---

# Rate limiting

An endpoint with no ceiling is an endpoint one caller can turn into an outage. A retry loop gone wrong, a scraper, a misconfigured client, or a deliberate flood — each is the same shape: more requests than you provisioned for, all at once, until the service falls over for everyone. A rate limit is the valve that keeps one caller's volume from becoming everyone's downtime. It is server-side self-protection: you decide the maximum rate you will serve a given caller, and you say no — cheaply and clearly — past it. The failures this prevents: a single client saturating your capacity into an outage; a fixed-window limiter that lets a double-burst through at the window boundary; a 429 with no `Retry-After`, so even well-behaved clients cannot tell when to come back.

Rate limiting is the counterpart to `resilience`: resilience is how a *caller* survives a dependency that is slow or down (timeouts, retries, backoff); rate limiting is how a *service* protects itself from callers who send too much. The two meet at the 429 — the server sets the `Retry-After`, and a resilient client honors it.

## When to invoke

- Exposing an endpoint that untrusted or high-volume callers reach — a public API, a login or signup route, a password-reset or OTP send, an expensive search or export, anything a script can hammer.
- Adding a per-caller quota, a burst limit, or abuse protection to a surface that currently has none.
- Diagnosing an outage or cost spike caused by one caller's volume, or a limiter that lets bursts through at the window edge.

## When NOT to invoke

- Internal, low-volume calls between services you control, on a trusted network, with no abuse or overload risk — a limiter there adds a failure mode and a shared-counter dependency for no protective gain.
- A batch job or admin path where the caller is you and the volume is bounded by design. Match the control to the risk; not every endpoint needs a valve.

## Pick the algorithm deliberately

The algorithm decides *how* you count, and the naive choice has a hole.

- **Token bucket — the default for most APIs.** A bucket holds up to `N` tokens and refills at a steady rate; each request spends one, and a request with no token available is rejected. This allows a controlled burst (up to the bucket size) while bounding the sustained rate (the refill rate) — which matches how real clients behave. Two numbers, `capacity` and `refill rate`, and they map directly to "how big a burst" and "how fast sustained."
- **Sliding window — when you need a precise rolling limit.** Count requests over the trailing `T` seconds continuously, so "100 per minute" means any 60-second span, not a calendar minute. More accurate than fixed window and free of its boundary hole; a sliding-window *log* is exact but stores a timestamp per request, while a sliding-window *counter* approximates it cheaply by weighting the previous window.
- **Not a naive fixed window.** A fixed window ("100 per minute, counter resets on the minute") is simple and wrong at the edge: a client sends 100 in the last second of one window and 100 in the first second of the next — 200 requests in two seconds, twice the limit, straddling the boundary. If you use fixed windows anyway, know this double-burst is the cost, and prefer sliding or token bucket where the burst matters.
- **Leaky bucket when you must smooth output.** A queue drained at a fixed rate shapes bursty input into a steady stream — useful when the thing you protect (a downstream, a device) needs an even rate, not just a bounded total.

## Key the limit by the right identity

A limit is only as good as the thing it counts against. Choose the key so one caller cannot masquerade as many, and so many callers do not get lumped into one.

- **Authenticated calls: key by the stable principal** — the user id, the API key, the account/tenant. This is the identity you are actually protecting capacity against, and it survives IP changes.
- **Unauthenticated calls: key by IP, knowing its limits.** IP is the best you have before auth, but it is coarse — a NAT or corporate proxy puts thousands of users behind one address (so a per-IP limit punishes them all), and an attacker with a botnet or a cloud account has thousands of IPs (so a per-IP limit barely slows them). For login and signup, layer it: per-IP *and* per-account, so neither a single IP nor a single targeted account can be hammered.
- **Trust the source of the identity, not a spoofable header.** Read the client IP from your infrastructure's trusted forwarding chain (the real `X-Forwarded-For` your load balancer sets), not a raw request header a client can forge. An API key comes from your auth layer, not from an unauthenticated claim.
- **Layer limits by scope.** A per-key limit protects fairness between callers; a global limit protects the service's absolute capacity; a per-endpoint limit protects an expensive route independently of a cheap one. They compose — a caller under its own quota can still be shed by the global ceiling when the whole service is at capacity.

## The 429 contract

Rejecting is half the job; telling the caller *how* to behave is the other half. A well-designed 429 lets a good client back off correctly and a good ecosystem stay healthy.

- **Return `429 Too Many Requests`, not 200, 403, or 500.** The status is the contract: it tells the client this is a throttle, not a bug or a permission problem, and that the same request will succeed later. A rejected request must be cheap — reject before the expensive work, so shedding load actually sheds it.
- **Always send `Retry-After`.** The response must say when to come back — `Retry-After: 30` (seconds) or an HTTP date. Without it, a client can only guess, and guessing means either giving up on a request that would have succeeded or retrying immediately and deepening the overload. The `Retry-After` you send is the value a resilient client is waiting to honor.
- **Expose the limit state on every response** with the conventional headers — `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (or the `X-RateLimit-*` variants your ecosystem uses). A client that can see it is running low can self-pace *before* it hits the wall, which is better for both sides than discovering the limit by being rejected.
- **Make the reject path itself cheap and abuse-resistant.** The check must cost far less than serving the request, or the limiter becomes the amplifier. Do not do expensive work (or emit an expensive log line per rejection) on the path a flood takes.

## Set the ceiling from measured capacity

The number is not a vibe. A limit set too low throttles legitimate traffic and generates support tickets; set too high, it does not protect anything and the first real flood finds the real ceiling for you.

- **Derive the limit from load you have measured** — the throughput at which latency stays acceptable and the service stays healthy, with headroom. Load-test to find where it degrades, then set the ceiling below that knee, not at a round number someone liked.
- **Separate the sustained rate from the burst.** Most legitimate clients are bursty — a page load fires several calls at once. The token bucket's two knobs let you allow the burst while bounding the sustained rate; a single flat "per second" number forces you to choose one and get the other wrong.
- **Set it per-tier where callers differ.** A free tier, a paid tier, and an internal service have different legitimate volumes; one global number is wrong for all three. Make the limit a property of the caller's plan.
- **Fail open or closed on purpose when the limiter itself breaks.** If the shared counter store (Redis) is down, decide in advance: fail *open* (serve the request, lose enforcement) to protect availability, or fail *closed* (reject) to protect a fragile downstream. Both are defensible; an undecided default is not.

## Anti-patterns

- **No limit on a public or expensive endpoint** — the endpoint one client can saturate into an outage. The most common and most costly omission.
- **A naive fixed window** whose boundary lets a double-burst through — 2× the intended rate across the window edge, exactly when a burst hurts most.
- **A 429 with no `Retry-After`** — a well-behaved client is left guessing, so it either backs off too long or retries into the overload it caused.
- **Keying only by IP for authenticated abuse**, so a NAT'd office is throttled as one attacker while a botnet with a thousand IPs sails under the per-IP limit.
- **Trusting a spoofable client header** for the identity or the source IP, so a caller forges its way around its own quota.
- **A limit number pulled from thin air**, never traced to measured capacity — too low and it throttles real users, too high and it protects nothing.
- **An expensive reject path** — heavy work or a per-request log line on the rejection, so the limiter amplifies the flood instead of shedding it.
