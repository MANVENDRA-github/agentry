---
name: agentry-csharp-nullable-reference-types
description: C# nullable-reference-types discipline — enable NRT project-wide, honor the `?` annotations, treat the null-forgiving `!` as a code smell. Apply when working in any C# file. Skip for legacy projects mid-migration where NRT is being ratcheted on file by file.
---

# C# nullable reference types

Before nullable reference types (NRT), every C# reference could be `null` and the compiler said nothing — a `NullReferenceException` was a runtime coin flip. NRT turns that into a compile-time conversation: you declare which references can be null (`string?`) and which cannot (`string`), and the compiler flow-analyzes your code to prove you never dereference a maybe-null value. It is the closest C# has to `strictNullChecks`, and like strict mode it is only worth anything if you leave it on and stop lying to it.

## What NRT enforces

- **`<Nullable>enable</Nullable>` project-wide.** Turn it on in the `.csproj` for the whole project, not per-file with `#nullable enable` scattered around. A non-nullable annotated reference (`string`) is a promise it is never null; a nullable one (`string?`) forces the compiler to make you check before you dereference.
- **Flow analysis you cooperate with.** The compiler tracks nullability through your branches. `if (x is not null)` narrows `x` to non-null inside the block. Guard clauses (`ArgumentNullException.ThrowIfNull(arg)`) tell it — and the reader — that past this line the value is real.
- **Annotations that mean what they say.** A `string` parameter that you then null-check is a contradiction the compiler will flag; either it is `string?` (nullable, check it) or `string` (non-null, don't). Resolve the contradiction, don't paper over it.

## When you may be tempted to reach for `!`

- **"The compiler is wrong, it can't be null here."** Occasionally true — a value initialized by a framework, or a check the analyzer can't follow. Then `!` is acceptable *with a comment* saying why it cannot be null. Usually the compiler is right and you have a real maybe-null you haven't handled.
- **"`!` makes the warning go away."** So does fixing the nullability. The null-forgiving operator suppresses the check without changing the fact; if you are wrong, you get the exact NRE the feature exists to prevent.
- **"I'll disable NRT for this file, it has too many warnings."** Each warning is a latent NRE. `#nullable disable` on the file hides all of them at once — the opposite of what you want.

## What to do when it catches something

- **A maybe-null value you dereference.** Narrow it: `is not null`, pattern matching, `?.` with a sensible fallback (`x?.Name ?? "default"`), or a guard that throws. The narrowed value is non-null from there on and the warning clears honestly.
- **A parameter that shouldn't be null.** Type it non-nullable and guard at the top: `ArgumentNullException.ThrowIfNull(arg)`. Fail at the boundary with a named argument, not deep inside.
- **A property not initialized in the constructor.** Initialize it, make it `?`, use `required` (C# 11+), or — only when a framework guarantees initialization — the `= null!` default with a comment naming the framework. Not a blanket `!` everywhere.
- **A third-party API not annotated.** Treat its returns as nullable until proven otherwise; check at your boundary and convert to a non-null value for the rest of your code.

## What you do not do

- **`!` to silence a real warning.** It is `as any` for null — it turns off the safety you enabled. Narrow instead.
- **`#nullable disable` on a file** to escape the warnings. Fix them one expression at a time.
- **Flip `<Nullable>` off in the `.csproj`** once it is on. The most damaging retreat — every reference in the project silently loses its guarantee.
- **`= null!` sprinkled to initialize non-nullable fields** without a framework reason. Use `required` or a real value.
- **`x!.Member` chains.** If you are forgiving nullability to dereference, you have an unhandled maybe-null. Handle it.
