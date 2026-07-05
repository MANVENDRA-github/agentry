---
name: agentry-rust-error-handling
description: Rust error-handling discipline — return `Result`, keep `unwrap`/`expect`/`panic!` out of library and request paths, propagate with `?` and typed errors. Apply when working in any Rust file. Skip for prototypes, examples, and tests where a panic on failure is acceptable.
---

# Rust error handling

Rust encodes fallibility in the type system: a function that can fail returns `Result<T, E>`, and the compiler will not let you use the `T` without confronting the `E`. That is a gift — it means the only way to ignore an error is to explicitly opt out, and every opt-out is a word you can grep for. The discipline is simply to not opt out on paths that matter. `.unwrap()` is not "handle the error"; it is "convert the error into a crash," and in a library or a request handler that crash is someone else's outage.

## What the discipline enforces

- **Return `Result<T, E>` for anything fallible.** I/O, parsing, env access, network, user input — the failure is part of the signature, not a surprise.
- **Propagate with `?`.** Let the error flow up to a caller with the context to decide, converting types with `From` along the way. `?` is the idiom; long `match` ladders on every call are noise.
- **Model errors for your audience.** A library returns typed errors (an enum, usually via `thiserror`) so callers can `match` on the variant. A binary or application uses `anyhow` with `.context()` so the operator gets a readable chain. Do not force `anyhow` on your library's callers.
- **Treat `unwrap`/`expect`/`panic!`/panicking index `[]` as opt-outs** that must be justified. In library and request-handling code they are banned; where an invariant genuinely cannot fail, `expect("why it cannot fail")` documents that invariant for the next reader.

## When you may be tempted to unwrap

- **"This will never be `None`/`Err` here."** If it truly cannot fail, say so: `expect("config was validated at startup")`. If you are only *fairly* sure, you are wrong often enough to return a `Result` and let the caller decide.
- **"It's just a prototype."** Then it is in scope of the Skip clause — fine. But the moment it is on a path a user or another crate reaches, the unwraps become time bombs. Convert them before you commit.
- **"The error type doesn't line up."** That is what `From`/`?` and `thiserror`'s `#[from]` are for. Implement the conversion once; do not `.map_err(|_| ...)` at every call site and lose the cause.
- **"The borrow checker is fighting me, so I'll `.clone()` and `.unwrap()` my way out."** Both are usually the type telling you the design is off. Fix the ownership or the error model; do not paper over it.

## What to do when you hit one

- **An `.unwrap()` on external input** (a parsed number, an env var, a request field). Return a typed error via `?` instead, so a bad input becomes a handled `400`, not a panic that takes down the worker.
- **A panic inside a request handler or task.** Convert it to a `Result` and map it to a proper response/error at the boundary. A panicking handler is an availability bug.
- **An `Option` you need to treat as an error.** `opt.ok_or_else(|| MyError::Missing)?` or a `match` — not `.unwrap()`.
- **A `Result<T, E>` you must discard.** If ignoring is genuinely correct, `let _ = ...;` *with a comment*; if it is a logged best-effort, log the `Err`. Never silently drop a failure that mattered.

## What you do not do

- **`.unwrap()` / `.expect()` on I/O, parsing, env, or user input** in code that ships. Return the error.
- **`panic!` for an expected failure.** Panics are for broken invariants and unrecoverable bugs, not for a missing file or a malformed request.
- **Stringly-typed errors (`Result<T, String>`)** in a library. Callers cannot match on a string. Use an enum.
- **`.map_err(|_| ...)` that throws away the source.** Preserve the cause with `#[from]` or `.context()` so the chain survives.
- **`let _ = fallible();` with no comment** — the silent-drop equivalent of a bare `unwrap`, just quieter.
- **`.clone()` to escape a borrow error** the type system was trying to tell you something about.
