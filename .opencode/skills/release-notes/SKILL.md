---
name: release-notes
description: Discipline of turning a release's commits and PRs into notes written for the person deciding whether and how to upgrade — grouped by impact, leading with breaking changes and migration steps, not a raw commit dump. Invoke when cutting a release or writing a changelog entry. Skip for internal version bumps no one outside the repo consumes.
---

# Release notes

The habit of writing a release's notes for the reader who has to act on them, not for the author who wrote the commits. The failure mode this prevents: pasting `git log` into a changelog, where the one breaking change that will break the reader's build is buried on line 34 between two dependency bumps. A good release note answers, fast: should I upgrade, what will it cost me, and what do I get? Where `git-commit-craft` makes each commit explain itself, this skill makes the *release* explain itself.

## When to invoke

- Cutting a release or tagging a version that someone outside the repo will install.
- Writing or updating a `CHANGELOG.md` entry.
- Summarizing a milestone for users, not just contributors.

## When NOT to invoke

- An internal-only bump no one downstream consumes — a one-line `chore: bump to X` is enough.
- A single self-explanatory change where the commit message already is the note.

## The method

1. **Gather the range.** Take everything since the last release: `git log <last-tag>..HEAD`, the merged PRs, the closed issues. That is the raw material — not the final notes.
2. **Group by impact, not by commit.** Sort changes into what the reader cares about, in this order: **Breaking changes**, **New features**, **Improvements**, **Bug fixes**, then **Internal/maintenance** (or drop the last entirely for a user-facing audience). One entry per *change*, not per commit — squash three commits that built one feature into one line.
3. **Lead with what forces action.** Breaking changes go first, each with the migration step inline: what changed, and exactly what the reader must do. "Removed `config.legacyMode`; set `mode: \"compat\"` instead" beats "Refactored config handling."
4. **Write for the consumer.** Describe each change by what it means for someone using the project, not by what the diff did. "Searches now match accented characters" — not "normalize NFC in the tokenizer."
5. **Link the detail.** Reference the PR/issue for anyone who wants to go deeper, so the note itself stays scannable.

## What goes in

- **Breaking changes** — always, first, with the migration step. This is the line that protects the reader's build.
- **User-visible features and behavior changes** — what they can now do, or what now behaves differently.
- **Notable fixes** — especially anything that changes an outcome a user may have worked around.
- **Deprecations** — what is going away, and the replacement, so the reader can move ahead of the removal.

## What stays out

- The raw commit list. Merge commits, `wip`, `fix typo`, formatting, and lockfile bumps are noise to a consumer.
- Internal refactors with no observable effect — unless they change performance or a guarantee the reader relies on.
- Implementation detail. *How* it was built belongs in the PR; the note carries *what it means*.

## A note on versioning

The notes and the version number should tell the same story. Under semver, a breaking change forces a major bump — if your notes have a "Breaking changes" section and the version moved a patch digit, one of them is wrong. Let the highest-impact change set the version.

## Anti-patterns

- **Dumping the git log.** A changelog that is the commit history reformatted makes the reader do the triage you were supposed to do.
- **Burying the breaking change.** The one entry that will cost the reader time, hidden in the middle, unlabeled. It goes first, flagged, with the fix.
- **Writing for the author, not the reader.** "Refactored the parser" tells a user nothing; "fixes crash on empty input files" tells them whether they need this release.
- **No upgrade guidance.** Naming a breaking change without saying what to do about it leaves every reader to reverse-engineer the migration independently.
- **A version that contradicts the notes.** A "Breaking changes" heading over a patch release. Match the bump to the impact.
