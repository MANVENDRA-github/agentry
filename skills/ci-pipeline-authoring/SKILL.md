---
name: ci-pipeline-authoring
description: Author a CI pipeline that gives fast, trustworthy signal — ordered stages, dependency caching, fail-fast, parallel jobs, required status checks that actually gate merges, and build artifacts promoted between stages instead of rebuilt. Invoke when creating or restructuring a CI/CD workflow (GitHub Actions, GitLab CI, CircleCI, etc.). Skip for a repo with no automated pipeline or a single trivial lint job.
---

# CI pipeline authoring

A CI pipeline exists to answer one question fast: is this change safe to merge? A bad pipeline answers slowly and lies. It reinstalls every dependency and rebuilds from scratch at each stage, so a two-minute test suite takes fifteen. It jams lint, test, and build into one serial job, so a formatting nit fails after ten minutes of compilation. It has flaky steps that fail on nothing, so people learn to hit re-run and stop reading the result. And its "green" checkmark never actually blocked anything, because no check was marked required — a red build merged anyway. The discipline is to make the pipeline fast enough to trust, honest enough to believe, and wired so a failure genuinely stops the merge.

## When to invoke

- Creating a CI/CD workflow for a repo that doesn't have one, or restructuring one that has grown slow and serial.
- A pipeline that reinstalls/rebuilds at every stage, runs everything in one job, or takes long enough that people stop waiting for it.
- Wiring branch protection: deciding which checks must pass before a merge is allowed.
- Diagnosing a pipeline nobody trusts — flaky, slow, or green-but-didn't-catch-it.

## When NOT to invoke

- A repo with no automated pipeline and no appetite for one, or a single trivial lint job that runs in seconds — the machinery costs more than it saves.
- Deployment topology and release orchestration (environments, rollout strategy, approvals) beyond the build/test/gate pipeline — that is a separate, downstream concern.

## The discipline

- **Order stages fast-to-slow, and fail fast.** Run the cheap checks that fail most often first — lint, format, type-check — before the expensive ones — unit tests, integration, build. A style violation should fail in thirty seconds, not after the ten-minute compile. Configure the pipeline to stop (or at least report) on the first failing stage rather than grinding through the rest to tell you what you already know.
- **Cache dependencies, keyed on the lockfile.** The dependency install is usually the slowest repeated step and it rarely changes. Cache it keyed on a hash of the lockfile (`package-lock.json`, `poetry.lock`, `Cargo.lock`, `go.sum`) so an ordinary code change restores the cache instead of reinstalling from the network. A cache key that ignores the lockfile serves stale dependencies; a cache with no key busts on every run. Cache the build cache (compiler output, `~/.cache`) too where the tool supports it.
- **Parallelize independent jobs.** Lint, unit tests, and a type-check share no state — run them as separate jobs at once, not stitched into one script. Split a large test suite across shards. The pipeline's wall-clock time should be its slowest job, not the sum of all of them. Use a job dependency graph (`needs:`) to express real ordering and let everything else run concurrently.
- **Build the artifact once and promote it.** Compile, bundle, or containerize a single time, publish the result as a pipeline artifact, and have every later stage — test, scan, deploy — pull *that* artifact rather than rebuilding from source. Rebuilding at each stage wastes time and, worse, means the thing you tested is not byte-for-byte the thing you ship.
- **Make the checks that matter *required*.** A passing check that isn't marked required in branch protection is decoration — it will let a red build merge. Enumerate the checks that must be green (the ones whose failure means "do not merge") and mark them required, so the gate is enforced by the platform, not by whoever remembers to look.
- **Kill flakiness at the source; never paper over it.** A test that passes and fails on the same commit trains everyone to ignore red. Fix the race, the timing dependency, the shared fixture — or quarantine the test out of the required set with a ticket to fix it. A blanket "retry the whole job until green" hides real failures behind the same mechanism it hides flakes behind.
- **Trigger deliberately and cancel the stale.** Run on pull requests and on the default branch; cancel superseded runs when a new commit lands on the same branch (concurrency groups) so you aren't paying for feedback on a commit nobody is waiting for. Path filters skip work a change can't affect (docs-only, unrelated package).

## Anti-patterns

- **Reinstall and rebuild from scratch at every stage.** No caching, no artifact promotion — the slowest and most common pipeline defect. Cache the install; build once and promote.
- **Lint, test, and build in one serial job.** A fast failure hides behind a slow one, and nothing runs in parallel. Split into ordered, parallel jobs.
- **A cache key that ignores the lockfile** (or no key at all) — either serves stale dependencies or never hits. Key on the lockfile hash.
- **A "green" check that isn't required**, so a failing build merges anyway. Mark the gating checks required in branch protection.
- **Retry-until-green on flaky steps** instead of fixing them — trains the team to stop trusting the signal, and buries real regressions among the flakes.
- **Tests that depend on stage order or shared mutable state**, so they only pass when run serially — an obstacle to the parallelism that makes the pipeline fast.
- **No timeout on jobs**, so a hung step burns runner minutes for an hour before anyone notices. Bound every job.
