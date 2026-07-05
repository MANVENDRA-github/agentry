---
name: agentry-cpp-resource-safety
description: C++ resource-safety discipline — every resource owned by an RAII object, smart pointers over raw owning pointers, no naked `new`/`delete`. Apply when working in any C++ file. Skip for a throwaway spike or a constrained embedded context with its own allocation rules.
---

# C++ resource safety

C++ hands you manual control over memory, files, locks, and sockets, and with it every way to leak them, use them after they are freed, or free them twice. The language's answer is RAII: tie a resource's lifetime to an object's scope, so acquisition is construction and release is destruction, and the compiler runs your cleanup automatically — even when an exception unwinds the stack. Modern C++ is the discipline of never owning a resource by hand when a type can own it for you. A raw owning pointer is a bug you have not hit yet.

## What the discipline enforces

- **Every resource lives in an RAII wrapper.** Memory in `unique_ptr`/`shared_ptr`, files in `fstream`, locks in `lock_guard`/`unique_lock`, arbitrary resources in a small custom guard. The destructor releases it; scope exit — normal or exceptional — is your cleanup.
- **Ownership is expressed in the type.** `unique_ptr<T>` for a single owner (the default), `shared_ptr<T>` only when ownership is genuinely shared, a raw `T*` or `T&` for a *non-owning* observer that must outlive nothing. The reader knows who frees what by looking at the type.
- **No naked `new`/`delete`.** Create with `make_unique`/`make_shared`; never write `delete`. A hand-managed `new` is a leak on every early return and every throw between it and its `delete`.
- **Rule of zero.** A class whose members are all RAII types needs no destructor, copy, or move — the compiler-generated ones are correct. If you must write one of the five (destructor, copy/move ctor, copy/move assign), you owe all five (rule of five). Prefer designing so you write none.

## When you may be tempted to cut a corner

- **"A raw `new` here is simpler."** It is simpler until the function throws or returns early between the `new` and the `delete`, and then it leaks. `make_unique` is the same line count and exception-safe.
- **"`shared_ptr` everywhere is easiest."** Shared ownership has a cost (atomic refcount) and a hazard (cycles that never free). Default to `unique_ptr`; reach for `shared_ptr` only when the lifetime is truly shared.
- **"I'll remember to `delete` it."** On the happy path, maybe. On the third early-return added six months later, no. Ownership you have to remember is ownership you will forget.

## What to do when you hit one

- **A raw owning pointer in existing code.** Wrap it: return/store `unique_ptr<T>`, and hand out a raw `T*`/`T&` only as a non-owning view. The owner is unambiguous; the observers borrow.
- **A function that returns a pointer to a local.** Never do this — the local is destroyed on return. Return by value (move is cheap), or return an owning `unique_ptr` if the caller takes ownership.
- **A resource that isn't memory** (a C API handle, a mutex, a transaction). Write a tiny RAII guard: acquire in the constructor, release in the destructor, delete the copy operations. Now it cannot leak.
- **A dangling reference or use-after-free.** Trace ownership: who frees it, and does any observer outlive the owner? Fix the lifetime, and lean on `-fsanitize=address` / a static analyzer to confirm.

## What you do not do

- **`new`/`delete` by hand** for something a smart pointer can own.
- **Own a resource through a raw pointer.** Raw pointers observe; they do not own.
- **Return a reference or pointer to a local** or to a container element you then invalidate.
- **`shared_ptr` as the default** — it hides single ownership behind a refcount and invites cycles.
- **Write a destructor without the rest of the five**, or write any of them when rule-of-zero would do.
- **Ignore sanitizer or static-analyzer findings** about leaks and lifetimes — they are reporting the bug RAII exists to prevent.
