---
name: agentry-verification-loop
description: Discipline of not declaring work done until it has actually been run and observed to do what was claimed. Invoke before saying a task is complete, a bug is fixed, or a feature works. Closes the gap between "the code looks right" and "the code does the right thing." Skip only for changes you cannot run (pure docs, comments).
---

# Verification loop

The habit of proving a change works before claiming it does. The failure mode this prevents: declaring a task done because the code looks correct and compiles — then discovering it never ran, ran the wrong path, or fixed nothing. "It should work" is a hypothesis. "I ran it and saw it work" is a result. This skill is the discipline of never shipping the first when you owe the second.

## When to invoke

- Before declaring any task complete.
- Before claiming a bug is fixed — a fix you have not run is a guess.
- Before saying a feature works or a refactor preserved behavior.
- Before pushing, opening a PR, or handing work to someone else.

## When NOT to invoke

- Changes you genuinely cannot execute: prose docs, comments, a config value whose effect is external and unobservable from here. Say plainly that the change is unverified and why, rather than implying it was checked.
- Throwaway spikes that will not outlive the hour and that no one will rely on.

For everything else that runs, it gets verified before it is called done.

## The loop

1. **State the claim.** What, specifically, should now be true? "POST /users returns 201 with the created record." "The null no longer crashes the parser." A claim you cannot phrase concretely is one you cannot verify.
2. **Pick the cheapest evidence that would actually confirm it.** A test that exercises the real path, a manual run, a log line, an observed response. The evidence must distinguish "works" from "looks like it works."
3. **Produce the evidence.** Run it. Watch the actual output — do not infer it from the code.
4. **Compare against the claim.** Did the observed behavior match what you said would happen? Exactly, or only approximately?
5. **If it does not match, the task is not done.** Diagnose, fix, and run the loop again. Do not narrow the claim to fit the result you got.

The loop closes only when observed behavior matches the claim. Until then, the work is in progress, regardless of how finished the code looks.

## What counts as evidence

- **Running the code on the real path**, with inputs that exercise the change — not a trivial input that skips the new branch.
- **A test that asserts behavior**, not that a mock was called. A green test that does not touch the changed line proves nothing about the change.
- **Observed output**: the response body, the rendered result, the file written, the log emitted. Something you saw, not something you expect.
- **The failing case, now passing.** For a bug fix, reproduce the bug first, apply the fix, then confirm the same reproduction no longer fails. A fix verified only against a case that already passed is not verified.

## What does not count

- "It compiles." Compilation is a floor, not proof of behavior.
- "The tests pass" — when you did not check that any test exercises the changed code. Passing a suite that never runs your line tells you nothing.
- "It looks right." Reading is not running. The eye skips the bug it wrote.
- "It worked last time." A different input, a different state, a different environment is a different run.
- An LLM, including you, asserting the output without having executed anything. Confidence is not evidence.

## For bug fixes specifically

Reproduce before you fix. A bug you cannot reproduce is a bug you cannot prove you fixed — the loop is: reproduce the failure, apply the fix, rerun the exact reproduction, confirm it now passes, then run the surrounding tests to confirm you broke nothing adjacent. Skipping the reproduce step is how "fixes" that change nothing get shipped.

## Knowing when it is enough

Verify the claim, not the universe. The goal is evidence that the specific change does the specific thing — not exhaustive proof against every input. Once the real path is exercised and the observed behavior matches the claim, and the surrounding suite still passes, the loop is closed. Stop. Endlessly re-running a passing check is procrastination, the same way never running it is negligence.

## Anti-patterns

- **Declaring done from the code, not from a run.** The single most common gap between "looks done" and "is done."
- **Verifying a path the change does not touch.** A test or manual run that skips the new branch confirms the old behavior, not the new.
- **Treating green as proof rather than a floor.** Tests catch what they were written to catch. Ask what yours actually exercises.
- **Fixing a bug you never reproduced.** You cannot confirm a fix for a failure you never observed.
- **Silently leaving a change unverified.** If you could not run it, say so. An unstated "I didn't actually check this" is worse than a check you skipped openly.
