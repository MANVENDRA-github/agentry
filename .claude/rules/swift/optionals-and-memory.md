---
name: optionals-and-memory
description: Swift optionals- and memory-safety discipline — unwrap with `guard let`/`if let`/`??` not force-unwrap, break ARC retain cycles with `[weak self]`/`unowned`. Apply when working in any Swift file. Skip for a throwaway playground or a test where a trap on failure is acceptable.
language: swift
---

# Swift optionals and memory

Swift gives you two safety guarantees the language will enforce *if you let it*: optionals make absence explicit in the type system, and ARC frees objects deterministically when the last reference drops. Both have an escape hatch that silently gives the guarantee back — the force-unwrap `!`, which turns a `nil` into a crash, and a strong reference captured in a closure, which turns a released object into a leak that never frees. The discipline is to use the safe form by default and reach for the escape hatch only where an invariant genuinely holds, with a reason.

## What the discipline enforces

- **Unwrap optionals safely.** `guard let x = x else { return }` to bind-or-exit at the top of a scope, `if let`/`if let x` for a local branch, `??` to supply a default, optional chaining `a?.b?.c` for a chain that may end early. The unwrapped value is non-optional from there on, proven by the compiler.
- **Force-unwrap only on a real invariant.** `!` (and `try!`, `as!`) is acceptable only where the value cannot be `nil` by construction — and then it reads as documentation, ideally with a comment naming the invariant. On anything from outside (input, a network response, a JSON field, a failable initializer) it is a crash waiting for the wrong data.
- **Break retain cycles in closures.** An escaping closure that captures `self` strongly, stored on an object `self` also owns, is a cycle neither side ever frees. Capture `[weak self]` (and `guard let self else { return }`) for the common case, `[unowned self]` only when `self` is guaranteed to outlive the closure. The same applies to delegate references — `weak var delegate`.
- **Prefer value types.** Structs and enums have value semantics and no reference cycles by construction. Reach for a class when you need identity or shared mutable state, not by default.

## When you may be tempted to force-unwrap

- **"I just set it, it can't be nil."** Sometimes true within one scope — then bind it with `guard let` anyway; it is the same length and survives the refactor that adds an early return between the set and the use. Across scopes or after an `await`, "I just set it" stops being true.
- **"The JSON always has this field."** Until the server changes, the field is optional, or a partial response arrives. `!` on decoded data is the crash your users find first. Decode into the right optionality and handle the miss.
- **"`[weak self]` everywhere is noise."** It is noise only where there is no cycle (a non-escaping closure captures nothing long-lived). For an escaping, stored closure it is the difference between an object that frees and one that leaks — not noise, correctness.

## What to do when you hit one

- **An optional you need a value from.** `guard let` to unwrap-or-exit, `if let` to branch, `??` for a default. Chain with `?.` and terminate with `??`.
- **A force-unwrap on external data.** Model the optionality honestly (`String?`), decode with `try`/`Codable` and handle the failure, and convert absence into a typed error or a default — not a trap.
- **A closure that captures `self` and is stored/escaping.** Add `[weak self]`, then `guard let self else { return }` at the top. Use `unowned` only when the lifetime guarantee is real and documented.
- **A suspected leak.** Confirm with the memory graph / Instruments; the cause is almost always a strong closure capture or a strong delegate. Convert the offending reference to `weak`.

## What you do not do

- **`!` / `try!` / `as!` on input, network data, or a failable init** — anything that can legitimately fail. Unwrap safely and handle the failure.
- **Force-unwrap to silence the compiler** instead of modeling the optional. The `!` is `as any` for nil.
- **Capture `self` strongly in an escaping, stored closure** — that is the retain cycle. Use `[weak self]`.
- **`[unowned self]` when `self` might outlive-or-die before the closure runs** — an unowned access after deallocation traps.
- **Reach for a `class` by default** where a `struct` carries the data without reference semantics.
