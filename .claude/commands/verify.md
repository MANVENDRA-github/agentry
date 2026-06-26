---
description: Prove a change works by running it, using the verification-loop skill.
argument-hint: [optional: the claim to verify]
---

Apply the `verification-loop` skill to confirm the current change actually does what it is supposed to — before declaring it done.

$ARGUMENTS, if provided, is the specific claim to verify (e.g. "POST /users returns 201 with the created record" or "the null no longer crashes the parser"). If empty, state the claim yourself from the change in progress, then verify it.

Run the loop: state the claim concretely, pick the cheapest evidence that would actually confirm it, produce that evidence by running the code on the real path, and compare the observed behavior against the claim. The work is done only when what you observed matches what you claimed — not when the code merely looks right. For a bug fix, reproduce the failure first, then confirm the same reproduction now passes.
