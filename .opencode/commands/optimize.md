---
description: Fix a measured performance problem end to end with the performance-optimizer agent.
---

Invoke the `performance-optimizer` agent to fix the performance problem: $ARGUMENTS

State what is slow and, if you can, the target — "this batch job in half the time," "p95 under 200ms," "peak memory under 1GB." The agent will baseline, profile, change one thing, and re-measure on the same harness with behavior held constant.

If $ARGUMENTS does not name a measurable problem, the agent will ask for the metric and target before changing anything — it does not optimize on a hunch.
