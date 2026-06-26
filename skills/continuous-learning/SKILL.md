---
name: continuous-learning
description: Discipline of turning a hard-won insight from a session into a durable, reusable note before it is lost — so the next session does not re-derive it from scratch. Invoke after solving something non-obvious, discovering a project convention or gotcha, or at the end of a session that produced a reusable lesson. Skip for one-off trivia and anything the repo already records.
---

# Continuous learning

The habit of capturing what a session taught, while you still have it, in a form a future session can find and use. The failure mode this prevents: solving the same gnarly problem twice because the first solution lived only in a transcript that scrolled away. A lesson learned and not written down is a lesson you will pay for again.

This skill pairs naturally with a session-end (Stop) hook that prompts the capture automatically — but the discipline stands on its own: when you learn something durable, record it.

## When to invoke

- Just after solving something non-obvious — a fix that took real investigation, a workaround for a sharp edge, a sequence that finally worked.
- When you discover a project convention, constraint, or gotcha that is not written anywhere obvious ("migrations must run before the seed," "this service needs env X locally").
- At the end of a session that produced a reusable pattern, before the context closes.

## When NOT to invoke

- One-off trivia with no second use — a typo fixed, a value looked up once.
- Anything the codebase already records: structure git history captures, a fix already in the diff, a convention already in `CLAUDE.md` or a README. Do not duplicate the repo back to itself.
- Secrets, tokens, or anything that should never be written to a tracked file.

The bar: *durable and reusable*. If it will matter again and is not already captured, keep it. Otherwise let it go.

## The loop

1. **Notice the insight.** The signal is a moment of "oh — that's how it works here" or "that took far longer than it should have." That friction is the thing worth capturing.
2. **Generalize it.** Strip the task-specific surface and keep the transferable rule. Not "the foo_test failed on line 12," but "tests in this repo need the fixture server up first — start it with X." A lesson welded to one task will not be recognized next time.
3. **Write it where it will be found.** Put it where the next session actually looks: a project convention into the repo's guidance file, a reusable procedure into a skill, a context-triggered rule into a rule file, a personal preference into your notes. Captured somewhere unsearchable is the same as lost.
4. **Make it self-contained.** State the lesson, *why* it is true, and how to apply it — enough that a reader with no memory of this session can act on it. Link it to the related note or file if one exists.

## What is worth keeping

- **Conventions and constraints** specific to this project that are not self-evident from the code.
- **Non-obvious solutions** — the fix whose reasoning you would not reconstruct quickly.
- **Gotchas and sharp edges** — the thing that bit you, so it does not bite the next run.
- **Workflows that worked** — the command sequence, the order of operations, the setup step that is easy to forget.

## What is not

- Restating what the code, the diff, or git history already makes plain.
- Transient task state ("currently editing file Y") — that belongs in a handoff note, not a durable lesson.
- Over-captured noise. Five sharp, true notes beat fifty vague ones no one trusts — the same curation bar a good skill library holds.

## Anti-patterns

- **Trusting memory.** The insight feels unforgettable now and is gone by the next session. Write it while you have it.
- **Capturing the symptom, not the lesson.** "X broke" is not reusable; "X breaks when Y, because Z — do W" is.
- **Duplicating instead of updating.** If a note on this already exists, sharpen it; do not spawn a second. A library of near-duplicates rots.
- **Hoarding.** Saving everything devalues the notes that matter. Keep what will be reused; drop the rest.
