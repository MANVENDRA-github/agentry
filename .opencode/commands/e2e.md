---
description: Generate, maintain, or run end-to-end tests for a critical journey with the e2e-runner agent.
---

Invoke the `e2e-runner` agent to cover or fix an end-to-end journey: $ARGUMENTS

If $ARGUMENTS is empty, first find the project's E2E setup — the test command, the harness in use, and how the app starts for tests (in `package.json` scripts, a compose file, CI config, or the README) — then ask which journey matters most, or run the existing E2E suite to surface what is failing.

$ARGUMENTS, if provided, is the journey to cover (e.g. "checkout: cart → pay → confirmation"), a flaky test to stabilize, or a pointer to the suite to run.

The agent is framework-agnostic — it uses whatever E2E harness the repo already has. It tests real journeys against a running system, waits on conditions rather than fixed sleeps, captures artifacts on failure, and quarantines rather than deletes a flaky test. It will not chase a green suite with blind retries.
