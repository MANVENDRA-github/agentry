---
name: feature-flags
description: Decouple deploy from release with feature flags — ship code dark, turn it on deliberately, and delete the flag once it has served its purpose. Invoke when rolling out a risky or incomplete change, running an experiment, or gating access. Skip for a small change with no rollout risk, where a flag is just indirection.
---

# Feature flags

A feature flag turns "deploy" and "release" into two separate decisions: the code ships to production behind a runtime switch, and you turn it on when you are ready — for everyone, for 1%, for internal users, or not yet at all. That decoupling is what makes continuous deployment safe: a bad change is a config toggle away from off, not a revert-and-redeploy away. But a flag is also a branch in your code and a promise to clean up, and a codebase drowning in stale flags is worse than one with none. The discipline is to use flags where the rollout risk is real, and to treat every flag as temporary unless you have decided otherwise on purpose.

## When to invoke

- Rolling out a risky, large, or incomplete change you want to ship dark and enable gradually.
- Running an A/B experiment or a percentage rollout where you need to compare or ramp.
- Gating access — a beta, an entitlement, an internal-only tool — or needing a kill switch for an operationally risky path.

## When NOT to invoke

- A small, low-risk change that ships and works. A flag there is indirection with a cleanup cost and no upside.
- As a substitute for a real permissions/entitlement system for long-lived access control — a permission flag that never dies is really a config setting; model it as one.

## The discipline

- **Know which kind of flag you have — because their lifespans differ.** A *release* flag (ship dark, ramp up, then remove) is short-lived. An *ops / kill-switch* flag (disable an expensive or fragile path under load) may live long but stays simple. An *experiment* flag dies when the experiment concludes. A *permission* flag is really configuration and belongs in your entitlement model, not your flag debt. Naming the category tells you when it should be deleted.
- **Default off, and make "off" safe.** A new flag defaults to its old behavior; enabling it is the deliberate act. The off path must remain fully working — flags are a rollback mechanism only if turning one off actually restores the prior behavior.
- **Test both branches.** Code behind a flag is code that runs in production in both states. The on and the off path both need coverage — the off path is what protects you when you flip the switch back.
- **Evaluate cleanly.** Read a flag once near the entry of a request/operation, not scattered through a hot loop or deep in the call tree; pass the decision down. A flag check that hits a service on every iteration is a latency and a coupling problem.
- **Delete flags on a schedule.** A released flag that is 100%-on for a month is dead weight and a live footgun — someone can flip it off and resurrect old behavior. Give every temporary flag an owner and a removal trigger, and remove both branches when it retires.

## Anti-patterns

- **Permanent "temporary" flags.** The released flag no one deleted, now a decade of if-statements. Flag debt is real debt.
- **Nested flag spaghetti.** Flags gating flags gating flags — the combinatorial state space is untested and unreasoned. Keep flags independent and shallow.
- **An unsafe off path.** Enabling the flag quietly made the off branch stop working, so your "rollback" doesn't. Keep off working until the flag is deleted.
- **Reading a flag in a hot loop uncached**, turning a config lookup into a per-iteration network call.
- **No owner, no removal date.** A flag with no one responsible for retiring it never retires.
- **A flag standing in for access control** — long-lived entitlement logic pretending to be a rollout toggle.
