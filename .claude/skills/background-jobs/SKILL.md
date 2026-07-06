---
name: background-jobs
description: Design asynchronous and queued work for at-least-once delivery: make each job idempotent so a redelivery cannot double-apply, bound retries with a dead-letter destination for poison messages, keep jobs small and checkpointed so a crashed worker resumes instead of losing work, and separate scheduling from execution. Invoke when moving work off the request path into a queue, worker, or scheduled/cron task. For synchronous timeout/retry/circuit-breaker handling on an outbound call you are waiting on, use resilience instead; skip for purely in-request logic.
---

# Background jobs

The moment work leaves the request path, the guarantees you took for granted disappear. A synchronous call runs once, in order, and returns an answer the caller sees. A queued job runs *at least* once, possibly twice, possibly out of order, on a worker that may crash halfway through, and no user is watching when it fails. Almost every queue and scheduler in production delivers **at-least-once**, not exactly-once — exactly-once delivery is a distributed-systems fiction, and the ones that claim it buy it with an idempotency layer you could have built yourself. So the job *will* be redelivered eventually, and the failure modes this discipline prevents are all versions of that reality catching an unprepared handler: the job that double-charges a customer when the queue redelivers it, the work silently lost when a worker crashes mid-task, the poison message that retries forever and wedges the queue, and the fire-and-forget task no one can observe, replay, or reason about.

Design for redelivery and crash from the first line, not after the incident.

## When to invoke

- Moving work off the request path into a queue and a worker — sending email, generating a report, processing an upload, calling a slow third party asynchronously.
- Adding a scheduled or cron task that runs unattended.
- A fan-out where one event triggers many downstream jobs, or a pipeline of jobs handing work to each other.
- Diagnosing a job that ran twice, a queue stuck behind one bad message, or work that vanished when a worker restarted.

## When NOT to invoke

- Synchronous work you are waiting on the result of — a request-path call to a dependency that can be slow or down. That is the `resilience` discipline (timeouts, retries with backoff, circuit breakers on the call you block on), not this one.
- Purely in-request logic with no queue, worker, or schedule. If it runs and returns inside the handler, it is not a background job.
- A one-off script you run by hand and watch complete. The apparatus here earns its cost when the work runs unattended and must survive redelivery and crash.

## The discipline

- **Every job is idempotent.** At-least-once delivery means your handler must produce the same result whether it runs once or five times. Make the effect safe to repeat: carry a stable idempotency key (the business id, an event id, a dedupe token) and check-or-upsert against it — "has this charge id already been applied?" before applying it. An `INSERT ... ON CONFLICT DO NOTHING`, a unique constraint that rejects the duplicate, a state check that no-ops when the work is already done. Idempotency is not optional hardening; it is the price of admission to a queue.
- **Retry with bounded backoff, then dead-letter.** A transient failure (a timeout, a 503, a locked row) deserves a retry with exponential backoff and jitter. A *deterministic* failure — malformed payload, a referenced record that will never exist, a bug — will fail identically forever, and retrying it is how one poison message pins a worker and starves the queue. Cap the attempts, and on the final failure route the message to a **dead-letter queue** with its error and metadata, so the queue keeps flowing and a human can inspect, fix, and replay the poison message instead of losing it.
- **Keep jobs small, and checkpoint the long ones.** A worker can die at any instant — a deploy, an OOM, a spot-instance reclaim — and everything it held in memory is gone. A small job that processes one item redelivers cheaply and resumes by simply running again. A large job that processes ten thousand items in a loop loses all of it on a crash at item 9,999. Split the batch into per-item jobs, or checkpoint progress durably (record the last-committed offset/cursor) so a restart resumes from the checkpoint instead of the top. Combined with idempotency, a redelivered small job is a no-op or a safe resume.
- **Separate scheduling from execution.** The thing that *decides* work should happen is not the thing that *does* it. A cron entry or scheduler should enqueue a job, not run the business logic inline — so the schedule is simple and reliable, the work is retried and observed like any other job, and a slow execution does not delay the next tick. Make the trigger idempotent too: a scheduler that fires twice (clock skew, an overlapping run, a missed-then-caught-up tick) must not double-process, so key the run on its scheduled time or a period id and dedupe.
- **Make jobs observable and operable.** A background job fails where no user can see it, so you must build the eyes yourself. Emit structured logs and metrics keyed by job type and id — enqueued, started, succeeded, failed, retried, dead-lettered — plus duration and queue depth/age. You need to answer, at 3am from the outside: is this job stuck, how deep is the backlog, how old is the oldest message, what is in the dead-letter queue, and can I replay it safely? A fire-and-forget task with no telemetry is a task you cannot debug, drain, or trust.
- **Own the ordering and delivery assumptions explicitly.** Most queues do not guarantee order, and a redelivery can arrive after a later message. If your logic depends on sequence, do not assume it — enforce it (a per-key FIFO partition, a version/sequence check that rejects stale updates, or logic that is order-independent by construction). Decide, don't hope.

## Anti-patterns

- **A non-idempotent handler on an at-least-once queue.** The redelivery double-charges, double-emails, double-ships. This is the single most common background-job bug, and it hides until the day the network blips and the message is redelivered.
- **Infinite retries with no cap and no dead-letter.** A poison message retries forever, pins a worker, and grows a backlog behind it until the whole queue is wedged. Bound the attempts; dead-letter the rest.
- **One giant job that must complete atomically.** A crash near the end throws away all the work and, on redelivery, starts from zero — often re-doing the side effects it already committed. Split it, checkpoint it, make it resumable.
- **Business logic living in the cron entry.** Scheduling coupled to execution means a failure is invisible, a slow run delays the next, and there is no retry or dead-letter — the scheduler just moves on and the work is silently skipped.
- **A scheduled task with no overlap or double-fire guard.** Two overlapping runs, or a scheduler that fires twice, process the same period twice. Key the run and dedupe.
- **Fire-and-forget with no observability.** No metrics, no dead-letter inspection, no replay path. The job that failed is invisible until a customer reports the missing report, and by then there is nothing to replay.
- **Assuming exactly-once or in-order delivery** the queue never promised. Build the idempotency and ordering guarantees you need in your handler; do not inherit them from a broker that does not offer them.
