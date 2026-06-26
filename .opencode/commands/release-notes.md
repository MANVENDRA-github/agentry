---
description: Turn a release's commits and PRs into notes written for the reader deciding whether to upgrade, using the release-notes skill.
---

Apply the `release-notes` skill to produce release notes for the consumer, not a commit dump: $ARGUMENTS

If $ARGUMENTS is empty, find the range yourself: the last release tag to `HEAD` (`git describe --tags --abbrev=0` then `git log <tag>..HEAD`), plus the merged PRs in that window. Confirm the target version before writing.

$ARGUMENTS, if provided, is the version being cut or the explicit commit range.

Group changes by impact (breaking → features → improvements → fixes), lead with breaking changes and their migration steps, write each entry for what it means to a user, and link the PR for detail. Keep the version number consistent with the impact — a breaking change means a major bump.
