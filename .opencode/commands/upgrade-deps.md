---
description: Upgrade project dependencies safely and incrementally with the dependency-upgrader agent.
---

Invoke the `dependency-upgrader` agent to move dependencies forward without breaking the build: $ARGUMENTS

If $ARGUMENTS is empty, first take stock: find the manifest and lockfile, list what is outdated (`npm outdated`, `pip list --outdated`, `cargo outdated`, or the project's equivalent), and run the audit if there is one. Then propose an order — security advisories first, then safe patch/minor, then majors one at a time — and start.

$ARGUMENTS, if provided, scopes the work: a specific package, a group that must move together, "security" for advisory-driven bumps only, or "all minor" for the safe set.

The agent upgrades one package or group at a time, reads the breaking changes for the versions it crosses, applies the required code changes, and re-runs the build and tests after each — committing forward only on green. It will not bump everything at once, and it will not pin around a breaking change to dodge it.
