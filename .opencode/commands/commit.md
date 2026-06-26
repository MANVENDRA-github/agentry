---
description: Write a commit message for the staged changes using the git-commit-craft skill.
---

Apply the `git-commit-craft` skill to write a commit message for the currently staged changes.

Read the staged diff first (`git diff --staged`) so the message reflects what is actually being committed, not what was discussed earlier in the session.

$ARGUMENTS, if provided, is additional context the diff does not communicate on its own — typically the motivation, a ticket reference, or a constraint the change works around. Fold it into the message body where it belongs.

If there are no staged changes, say so and stop. Do not invent a message for a phantom commit.
