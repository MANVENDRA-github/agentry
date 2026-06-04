---
name: agentry-search-first
description: Research-before-coding methodology — before writing new code, search the codebase, docs, and dependencies for existing solutions, established patterns, and built-in capabilities. Invoke before building something non-trivial, especially in an unfamiliar codebase. Skip for throwaway spikes.
---

# Search first

Before you write new code of any substance, search for what already exists. The codebase may already have the utility you are about to build; a dependency may already provide the capability you are about to hand-roll; the problem you are solving may already be solved three directories over, in a specific style you should match. Searching first is the difference between adding to a codebase and fighting it.

## When to use this skill (and when not to)

Use it before building anything non-trivial — a utility, a feature, a fix that adds real logic. It pays off most in an unfamiliar codebase, where you do not yet know what exists or how things are done.

Skip it only for genuine throwaway spikes — code that will not outlive the hour and that nobody else will read. For anything that ships or that someone else maintains, search first.

## Why

The cost is asymmetric. Searching costs a few minutes. Not searching costs hours building something that already existed — and then the duplicate has to be maintained forever, drifting from the original and leaving the next reader unsure which one to use.

Searching first does a second job too: it surfaces the codebase's established patterns. Code written after a search matches the conventions around it; code written without one introduces a second way of doing the same thing, and every "second way" is a tax on everyone who reads the code later.

## The approach

1. Search the codebase for existing utilities, helpers, or features that already solve part of the problem. Search by what the thing does, not only by what you would name it — the existing version may be named differently than you expect.
2. Check the dependencies and the standard library. The capability may be one import away. Hand-rolling what a well-tested library already provides is how subtle bugs get born.
3. Look at how similar problems were solved elsewhere in the same codebase. Find the closest existing analog and read it — it shows you both a working solution and the local conventions.
4. Only then write — and write in the style the search revealed, reusing what you found rather than duplicating it.

## What to search for specifically

- **Utilities you might be about to reinvent.** Date formatting, validation, retries, parsing — the generic helpers a mature codebase usually already has.
- **Similar features to mirror.** If you are adding the third endpoint, the first two show you the expected shape.
- **Established conventions.** Error handling, logging, naming, file organization. New code should be consistent with these, not introduce a competing style.
- **Library capabilities that replace hand-rolled code.** Before writing the logic, check whether something you already depend on does it.

## Knowing when to stop

Search to inform, not to stall. The goal is to avoid reinventing and to match conventions — not to read the entire codebase before writing a line. Once you have found the relevant prior art and learned the local conventions, stop searching and start building. A search that never ends is just procrastination with a respectable name.

## Anti-patterns

- **Skipping the search because "I know how to build this."** You probably do. But the codebase may already have it, or may do it a specific way that yours will clash with. Knowing how is not knowing what already exists.
- **Reinventing a utility that exists three directories over.** The most common and most wasteful outcome — a second `formatDate` or `parseConfig` that does almost the same thing, slightly differently, forever.
- **Ignoring established conventions.** Introducing a second error-handling style, a second logging approach, a second way to organize a module. Each one fragments the codebase and forces the next reader to learn both.
- **Searching forever.** Using "more research" to avoid committing to code. Past the point where you have found the prior art and the conventions, more searching adds nothing but delay.
