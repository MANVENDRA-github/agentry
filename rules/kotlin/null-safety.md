---
name: null-safety
description: Kotlin null-safety discipline — let the type system carry nullability, reach for `?.`/`?:`/`let` over `!!`, guard platform types at the boundary. Apply when working in any Kotlin file. Skip for throwaway spikes that will not be committed.
language: kotlin
---

# Kotlin null safety

Kotlin builds null safety into the type system: `String` cannot hold null, `String?` can, and the compiler will not let you dereference the nullable one without handling the null case. This is the feature — it turns the `NullPointerException` from a runtime surprise into a compile-time decision. The discipline is simply to work *with* it: make a type nullable only when a value is genuinely, meaningfully absent, and handle that absence with the language's operators instead of asserting it away with `!!`.

## What the discipline enforces

- **Nullability is intentional.** A type is `T?` because absence is a real, expected state — not because you are unsure. Default to non-null; add the `?` only where "no value" is a case the code must handle.
- **Handle null with the safe operators.** `?.` to call through a nullable, `?:` (Elvis) to supply a fallback or `return`/`throw`, `?.let { }` to run a block only when present. These make the null path explicit and keep the value non-null inside the block.
- **Guard at the boundary.** Where a value must not be null, assert it once at the edge with `requireNotNull(x) { "x" }` (for arguments) or `checkNotNull(x)` (for state), converting a nullable into a non-null with a clear message — not with a bare `!!` deep in the logic.
- **Contain platform types.** A value from Java (`String!`) has unknown nullability; the compiler trusts you. Do not let it flow untyped through your code — annotate the Java side (`@Nullable`/`@NonNull`), or assign it to an explicit `String`/`String?` at the boundary so the risk is checked, not assumed.

## When you may be tempted to reach for `!!`

- **"I know it's not null here."** If you truly know, `requireNotNull`/`checkNotNull` says so with a message and fails informatively; `!!` fails with a bare `KotlinNullPointerException` and no context. If you only think you know, `!!` is the exact NPE Kotlin exists to prevent.
- **"`!!` is shorter than handling the null."** It is shorter and it moves the failure from compile time to a user's runtime. `?:` with a `return`/`throw` is barely longer and honest.
- **"`lateinit` lets me skip the nullable."** `lateinit` is for genuine dependency-injection / setup-then-use, not a way to dodge modeling an absent value. Using it where the value can legitimately be missing just trades a null check for an `UninitializedPropertyAccessException`.

## What to do when you hit one

- **A nullable you need a value from.** `?:` to provide a default or exit early (`val name = user?.name ?: return`), or `?.let { }` to proceed only when present. The result is non-null without an assertion.
- **A value that must exist by contract.** `requireNotNull`/`checkNotNull` at the boundary, once, with a message — then the rest of the function sees a non-null type.
- **A Java value of unknown nullability.** Pin it: annotate the Java source, or assign to an explicit nullable/non-null Kotlin type at the seam and handle it there.
- **A nullable chain.** Chain the safe calls (`a?.b?.c`) and terminate with `?:`; don't `!!` in the middle.

## What you do not do

- **`!!` on external input** — a parse, a network response, a nullable Java return. That is the assertion most likely to be wrong.
- **`!!` as a habit to satisfy the compiler.** Every `!!` is a place you told the compiler to stop protecting you; handle the null instead.
- **Let platform types propagate** untyped through the codebase — check them at the boundary.
- **`lateinit` to avoid a nullable** for a value that can genuinely be absent. Model it as `T?` and handle it.
- **Return `null` where an empty collection or a sealed result type** would express the outcome more safely.
