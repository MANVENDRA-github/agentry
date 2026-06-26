---
name: error-debugging
description: Hypothesis-driven debugging discipline for in-conversation use — apply when Claude encounters a bug or error while working on something else. For focused investigations of complex bugs in a fresh context, delegate to the debugger agent instead.
---

# Error debugging

Hypothesis → evidence → conclusion, applied inline while working on something else. The failure mode this prevents: trying random fixes, pattern-matching to "I have seen this before" without confirming, declaring a fix without verifying the root cause and then watching the bug reappear in a different shape. The discipline costs a few minutes; skipping it costs hours of cycles on a fix that does not address the cause.

## When to invoke

- A test failed unexpectedly during a working session.
- Code that worked before is now broken and the cause is not obvious.
- An error message appears whose meaning is not clear from a quick read.
- A symptom appears that you would be tempted to "fix" by changing the most adjacent code without understanding why.
- A call returns the wrong value, the wrong type, or no value at all when it should.

## When NOT to invoke (and what to do instead)

- **The fix is obvious from the error** — a typo named in the message, an import missing, a clear off-by-one. Just fix it.
- **The error is a known pattern with a documented solution** in CLAUDE.md or nearby docs. Apply the documented solution.
- **The investigation needs a fresh context** away from current work, or the bug is large enough to need a structured artifact (diagnosis, evidence trail, confidence rating). **Delegate to the `debugger` agent.** The agent produces a structured report you can act on; this skill is for inline cycles.
- **The bug is in code you do not own** (a dependency, runtime, external service) and you cannot reproduce it locally. The next step is reporting upstream or working around at the boundary — not in-conversation debugging.

If the fix is one line, fix it. If the investigation needs a clean room, hand to the debugger agent. This skill is for the middle ground.

## The protocol

1. **Name the symptom precisely.** Not "it is broken" — "the test `validateToken_expiredToken` expects `ExpiredError` but receives `MalformedError`." Specificity here saves time at every later step. If you cannot name the symptom precisely, your first move is to gather enough information to do so.
2. **Form a hypothesis.** State it explicitly: "I think the cause is X because Y." If you cannot articulate it, you do not have a hypothesis; you have a guess. Guesses are fine as a starting point, but name them as guesses and convert them to hypotheses before acting.
3. **Gather evidence.** Read the code in question. Reproduce the bug if possible — reproduction is the difference between a tractable bug and a flaky one. Check what changed recently (`git log -p` on the suspected paths). Look at logs, error messages, stack traces.
4. **Confirm or revise.** Evidence either supports or undermines the hypothesis. If it contradicts, form a new one based on what you learned. Do not stretch the original hypothesis to fit evidence it does not actually explain.
5. **Identify the root cause.** The first explanation that fits is sometimes the symptom of something else. Ask "and what caused that?" until the answer is a place where the fix actually belongs.
6. **Fix the root cause** — or, when the root cause is out of scope, fix the symptom and name the underlying issue explicitly so it is visible to the next reader.

## Honesty rules

- If the evidence is incomplete, the diagnosis is incomplete. Say so before declaring a fix.
- If you could not reproduce the bug, say so. A "fix" for a bug you could not reproduce is unverified, and shipping it is a guess wearing a fix's clothes.
- If the cause might be in code you did not write, name that boundary. Diagnosing third-party code ends where you stop having read access; everything beyond is hypothesis.
- If two hypotheses survive the evidence, do not pick the more convenient one. Either gather more evidence or report both and let the caller decide.

## Reproducing the bug

Reproduction is the difference between a tractable bug and a flaky one. Spend more time here than feels comfortable — every later step is faster once you can reproduce on demand.

- **Start from the smallest input** that triggers the bug. If the bug appears at a specific call, find the exact arguments. If it appears in a specific environment, find what about the environment matters.
- **If it is intermittent, look for hidden state.** Time-of-day, request ordering, shared resources, cached data, environment variables. Intermittent bugs are usually deterministic once you find the variable that was varying.
- **If you cannot reproduce locally** but can in another environment (CI, staging, production), bring evidence from there into the investigation — logs, request traces, stack traces. Do not skip ahead to a fix because reproduction is hard; investigate what makes the environments differ.
- **Once reproduced, write down the reproduction steps.** A bug you reproduced once but cannot reliably trigger again is not really reproduced. The verification of the fix depends on running the reproduction afterward.

## Verifying the fix

A fix is not done when the test passes. Confirm:

- The originally-failing test or reproduction now passes for the right reason — the behavior is correct, not just the assertion masked.
- Tests that were already passing still pass. A fix that breaks something else is a different bug, not a clean fix.
- If the bug was reproducible at a specific entry point, walk the same entry point again and confirm the symptom is gone.

## When the root cause is out of scope

Sometimes the root cause sits behind a refactor you cannot do in the current session — a misshapen abstraction, a third-party bug, a contract change that needs coordination. The protocol still applies; the fix changes:

- Diagnose the root cause as if you were going to fix it. The diagnosis stays the same regardless of where the fix lands.
- Apply the symptom-mitigation, and explicitly mark it as a workaround in a comment near the change. Name the underlying root cause and a reference (issue number, doc, PR) where the proper fix lives.
- Open or update an issue tracking the root cause so the workaround does not become permanent by accident.

A workaround that is documented as a workaround is honest engineering. A workaround that pretends to be a fix is technical debt with a misleading label.

## Anti-patterns

- **Trying fixes until one works.** A passing test after a random change is not evidence the bug is gone — it is evidence the test stopped catching it.
- **Stretching a hypothesis** to fit contradictory evidence. If the evidence contradicts, form a new hypothesis. Bending the old one is wishful thinking with extra steps.
- **Chained speculation.** "This is probably X, which is probably because of Y, which might be Z." Stop when the evidence runs out and report what you have, marked with the right confidence.
- **Fixing the symptom when the root cause is reachable.** Symptom-fixes mask the real bug and let it recur somewhere else where it is harder to find.
- **Skipping reproduction because it is tedious.** Bugs you cannot reproduce, you cannot reliably fix. The reproduction setup pays for itself the moment you need to verify the fix.
