---
name: agentry-java-null-safety
description: Java null-safety discipline — model absence with `Optional`, never return `null` from a public API, annotate and check nullability at boundaries. Apply when working in any Java file. Skip for throwaway spikes that will not be committed.
---

# Java null safety

`null` is the billion-dollar mistake, and Java gives you no compiler help against it by default — a `NullPointerException` is a runtime surprise, three frames from the actual bug. The discipline is to make absence a value you handle deliberately instead of a landmine you step on: model "no result" with `Optional`, refuse to let `null` cross a public boundary, and annotate the boundaries you cannot control so a checker can catch what the language will not.

## What the discipline enforces

- **Model an absent return with `Optional<T>`.** A method that may not have a value returns `Optional<T>`, not `null`. The caller cannot forget to handle the empty case — the type makes them.
- **Never return `null` for a collection.** Return an empty `List`/`Set`/`Map` (`Collections.emptyList()`, `List.of()`). A `null` collection forces every caller to null-check before iterating; an empty one just works.
- **Validate at the boundary.** Public methods and constructors reject `null` arguments they don't accept: `Objects.requireNonNull(arg, "arg")`. Fail fast at the door, with a message, rather than deep inside with a bare NPE.
- **Annotate what the type system can't express.** `@Nullable`/`@NonNull` (JSpecify, JSR-305, or your framework's) on fields, parameters, and returns, and run a null checker (NullAway, the Checker Framework, or IDE inspections) so the annotations are enforced, not decorative.

## When you may be tempted to cut a corner

- **"Returning `null` is less code than `Optional`."** It is less code and more bugs. The `Optional` return is where the caller is forced to decide what "missing" means; a `null` return is where they forget.
- **"This can't be null here."** If it truly cannot, the boundary check is one line and documents the invariant. If it only *probably* cannot, you are one refactor away from an NPE.
- **"I'll wrap it in a try/catch for the NPE."** Catching an NPE is treating a symptom. The NPE means a value was absent where you assumed presence — fix the assumption, don't swallow the crash.

## What to do when you hit one

- **A field or parameter that might be absent.** Type it `Optional<T>` for a *return*, but for a *field or parameter* prefer a real value plus a null check or a nullable annotation — `Optional` fields and parameters are an anti-pattern (extra allocation, awkward serialization). Make the field non-null with a sensible default, or annotate it `@Nullable` and check.
- **An `Optional` you need to unwrap.** `map`/`flatMap`/`filter`/`orElseGet` to transform in place; `orElseThrow` when absence is genuinely exceptional. Reserve `get()` for after an `isPresent()` you can see on the same screen — better, avoid `get()` entirely.
- **A value from an untyped source** (JSON, JDBC, a legacy API). Null-check it at the point it enters your typed code and convert it into a non-null value or an `Optional`, so the rest of the code never wonders.

## What you do not do

- **Return `null` from a public method** as a stand-in for "no result." Return `Optional` (or empty collection).
- **Return a `null` array or collection.** Empty, always.
- **`optional.get()` without a guarding `isPresent()`** in view — it is `Optional`'s own NPE waiting to happen.
- **`Optional` fields or method parameters.** `Optional` is a return type; using it for fields/parameters is a smell.
- **Disable or ignore the null checker** to make a warning go away. The warning is a latent NPE; annotate correctly or fix the flow.
