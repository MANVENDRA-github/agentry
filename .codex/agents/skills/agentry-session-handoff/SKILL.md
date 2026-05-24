---
name: agentry-session-handoff
description: Produces a structured handoff note capturing what was done, what remains, and decisions made — so the next working session can resume without re-deriving context. Invoke at the end of a session when work is incomplete and a future session needs to pick it up. Skip when the work finished cleanly and the PR description carries the context.
---

# Session handoff

A small investment at the end of a session that prevents the next session from starting cold. The failure mode this prevents: the next Claude (or the next developer) burning 20 minutes re-reading the diff, re-deriving why a decision was made, or rediscovering a gotcha you already worked around. A handoff is cheap to write while context is loaded; expensive to reconstruct after it is gone.

## When to invoke

- A session is ending with the work unfinished.
- The next steps are clear to you now but would not be obvious from the diff alone.
- A decision was made that the next session needs to know about — especially a rejected approach, a deliberate scope cut, or a workaround for a problem somewhere else.
- You are about to switch context (different project, different problem) and want to preserve where you left off so the return is cheap.
- The work touches state outside the diff — a branch in an odd shape, fixtures mid-migration, a config knob temporarily flipped.

## When NOT to invoke

- The session completed the work cleanly. The PR description and the commits carry the context.
- The work is small enough that the next session can reconstruct it from the diff in 30 seconds.
- The handoff would be longer than just re-doing the work.
- The session was exploratory and produced nothing worth resuming — close the session and move on.

If the situation matches the skip list, recommend not writing a handoff rather than producing low-value ceremony.

## The handoff format

```
## State
[where the work currently stands — what is working, what is in progress, what is not started]

## Decisions made
- [decision] — [one-line reason]
- ...

## Next steps
[the concrete next action, ordered]

## Open questions
[things that need user input or further investigation]

## Gotchas
[anything non-obvious the next session needs to avoid stepping on]
```

## How to write each section

- **State** describes the situation, not the journey. "OAuth flow is wired, callback handler returns 200, but the redirect URL is hardcoded and tests for the redirect path fail" — not "I spent an hour on the redirect URL." The next session wants to know where they are, not where you have been.
- **Decisions made** names what was decided and the one-line reason. If a decision was provisional, say so: "Hardcoded the URL for now — should move to config in a follow-up." A future reader needs to know which decisions are load-bearing and which were expedient.
- **Next steps** names the first concrete action the next session should take. If you have a sequence, list it in order. Each step should be actionable, not a topic — "write a test that covers the redirect path with a custom domain" beats "testing."
- **Open questions** lists what you could not decide without more input. Name what input is needed and from whom — "Need product confirmation on whether anonymous sessions get the same flow as authenticated ones."
- **Gotchas** captures the friction the next session will hit that is not obvious from the code. "Integration tests assume port 3000; if you re-run, check `.env` first." "The migration in `db/0042` was applied locally but not committed; do not re-create."

## Where the handoff lives

Two reasonable places:

- **`HANDOFF.md` at the project root.** Easy to find, survives between sessions, gets overwritten on each new handoff.
- **A new section in an existing tracking doc or issue.** Use this when the work is already being tracked elsewhere — the handoff stays alongside the rest of the trail.

This skill does not mandate a location. The caller picks based on where the next reader will look.

## Anti-patterns

- A handoff longer than the work it describes. If the note runs to a page for two hours of work, the next session would have been faster reading the diff.
- A handoff that lies about state. "Working" should mean "verified by a test that passes" — not "the function compiles and looks right."
- Vague gestures instead of references. "Something is off in the auth layer" is not a handoff; "the `validateToken` function returns null for expired tokens instead of throwing — see `src/auth/jwt.ts:42`" is.
- A handoff written for the author's future self that another reader could not follow. Use names, paths, and explicit references, not "the file I was just in."
- Writing a handoff every session as ceremony, including the ones that finished cleanly. The skill's value depends on its scarcity.
