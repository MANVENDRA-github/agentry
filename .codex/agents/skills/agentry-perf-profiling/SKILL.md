---
name: agentry-perf-profiling
description: Discipline of fixing a performance problem by measurement, not guesswork — baseline, profile to locate the real bottleneck, one minimal change, measure again on the same harness, confirm behavior is unchanged. Invoke when something is measurably too slow or heavy and worth fixing. Skip when there is no measured problem — do not optimize on a hunch.
---

# Perf profiling

The habit of letting measurement, not intuition, drive a performance change. The failure mode this prevents: rewriting the code you *assume* is slow, shipping a more complex version, and finding the real cost was somewhere else entirely. Intuition about performance is wrong often enough that acting on it without a profile is how complexity gets added for no gain. Measure first, change one thing, measure again.

## When to invoke

- Something is measurably too slow, too memory-hungry, or too costly, and the improvement is worth the effort.
- A regression appeared and you need to find what got slower and why.

## When NOT to invoke

- There is no measured problem. "This feels like it could be faster" is not a reason to optimize — it is a reason to measure, and usually a reason to stop.
- The code is not hot. Optimizing a path that runs once at startup, or that the profile shows is a rounding error, trades readability for nothing.
- Before correctness and clarity are in place. A fast wrong answer is still wrong; premature optimization buries the bug.

## The loop

1. **Define the metric and the target.** What exactly is slow, measured how, and what would "good enough" be? "p95 request latency under 200ms," "this batch finishes in half the time," "peak memory under 1GB." A goal you cannot measure is a goal you cannot reach or know you reached.
2. **Establish a baseline.** Measure the current state on a representative workload, with a method you can repeat. Record the numbers and how you got them. Without a baseline, "faster" is a feeling.
3. **Profile to locate the bottleneck.** Use a profiler or targeted measurement to find where the time or memory actually goes — do not assume. The profile names the hot spot; that is where a change can pay off, and nowhere else can.
4. **Make one minimal change** aimed at the located bottleneck. One change, so the next measurement attributes the effect cleanly. The smallest change that addresses the hot spot, not a rewrite that also touches five other things.
5. **Measure again on the same harness.** Same workload, same method, same conditions as the baseline. Compare. Did it move, by how much, and did it reach the target?
6. **Confirm behavior is unchanged.** Run the tests. A performance change that alters results is a bug, not a speedup. Faster *and* correct, or it does not ship.

## What counts as a measurement

- **A repeatable harness** — the same inputs and conditions each run, so two numbers are comparable.
- **Representative load** — measured on data shaped like production, not a toy input that misses the real cost.
- **Distribution, not a single number** — p95/p99 or a range over several runs. One run is noise; averages hide the tail that users feel.
- **Warm vs cold accounted for** — a first run paying one-time costs (JIT, caches, connections) is not the steady state; know which you are measuring.

## What does not count

- "It feels faster." The eye and the gut are unreliable instruments for milliseconds.
- A single timed run. Variance between runs is often larger than the change you are chasing.
- A microbenchmark of a path the profile never flagged as hot — a real win on code that does not matter.
- Numbers from a different machine, dataset, or build than the baseline.

## Anti-patterns

- **Optimizing by guess.** Changing the code you assume is slow without a profile that says so. The bottleneck is usually not where you think.
- **Measuring once.** No baseline, or no after-measurement — so "faster" is asserted, not shown.
- **Bundling changes.** Three optimizations at once means you cannot tell which helped, which did nothing, and which quietly slowed things down.
- **Trading correctness for speed.** Skipping a check, loosening a guarantee, or changing the output to win a benchmark. Re-run the tests; a speedup that breaks behavior is a regression.
- **Optimizing the cold path.** Effort spent where the profile shows near-zero time is complexity bought for no return.
