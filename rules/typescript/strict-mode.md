---
name: strict-mode
description: TypeScript strict mode discipline — keep every strict flag on, treat escape hatches as code smells. Apply when working in any TypeScript file. Skip for exploratory spikes or in-progress JavaScript migrations where partial strictness is the temporary goal.
language: typescript
---

# TypeScript strict mode

`strict: true` enables every per-flag strictness setting at once. It is the baseline for any TypeScript project that intends to capture more than syntactic types. Strict mode is not a stretch goal — disable it and you give up most of TypeScript's value.

## What `strict: true` enforces

- `noImplicitAny` — variables and parameters cannot be implicitly typed `any`.
- `strictNullChecks` — `null` and `undefined` are distinct from other types; you must narrow before access.
- `strictFunctionTypes` — function parameter compatibility is checked contravariantly.
- `strictBindCallApply` — `bind`, `call`, `apply` are typed against the function's signature.
- `alwaysStrict` — each module is parsed in ECMAScript strict mode.
- `noImplicitThis` — `this` cannot be implicitly `any`.
- `strictPropertyInitialization` — class properties must be initialized in the constructor or declared optional.
- `useUnknownInCatchVariables` — `catch` clauses receive `unknown` instead of `any`.

Treat each one as load-bearing. None of them is a luxury.

## When you may be tempted to disable a flag

- **"I will tighten the types later."** Later does not come. Code written under loose typing has to be retroactively verified line by line. Stay strict from day one.
- **"The library's types are wrong."** Use module augmentation, a focused `// @ts-expect-error` with a comment, or a PR to DefinitelyTyped. Not a project-wide disable.
- **"I am migrating from JavaScript."** Migrate file by file with `// @ts-check` on each converted file. Partial migration that ratchets *up* is the goal; flipping a tsconfig flag off ratchets *down* and tends to stick.
- **"CI is failing and the release is due."** The type error is real. Add `// @ts-expect-error` with a TODO and a ticket number — never `// @ts-ignore`, never a tsconfig flag flip. The TODO is the ratchet that brings strictness back.

## What to do when strict mode catches something

- **`any` flagged on a value of unknown shape.** Change `any` to `unknown` and narrow with a type guard before use. `unknown` is the strict cousin of `any`: same flexibility for the producer, type-safety enforced on the consumer.
- **Null or undefined possible.** Narrow explicitly (`if (x != null)`, exhaustive pattern match, optional chaining where appropriate). Returning a silent default is rarely correct.
- **Function type mismatch.** Check whether the caller or the callee is wrong before reaching for a cast. A type mismatch is the compiler reporting a real disagreement; casting past it is how real bugs survive into production.
- **Class property not initialized.** Initialize in the constructor, declare optional with `?`, or — only when a framework guarantees initialization — use the definite-assignment assertion `!` with a comment naming the framework.

## What you do not do

- **`as any` to silence a type error.** This is type erasure with a hat on. If you must coerce, cast through `unknown` and narrow with a runtime check.
- **`// @ts-ignore`.** Use `// @ts-expect-error` instead. It fails the build when the error goes away, so it cannot rot.
- **`// @ts-nocheck` on a whole file.** No file is too big to type one expression at a time.
- **Disabling `strictNullChecks` in tsconfig.** The most common "temporary" loosening and the hardest to reverse — every nullable type in the codebase silently degrades.
- **Double-cast through `unknown` (`x as unknown as Foo`)** without a runtime check. This bypasses the strictness you turned on. If you must coerce, narrow.
