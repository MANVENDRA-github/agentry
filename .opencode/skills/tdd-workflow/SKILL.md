---
name: tdd-workflow
description: Test-first development with explicit red-green-refactor loops. Invoke when implementing a feature with well-defined inputs and outputs, fixing a reproducible bug, or refactoring code that already has tests. Skip for exploratory spikes, UI-heavy work, or one-off scripts where test overhead exceeds value.
---

# TDD workflow

Test-driven development, applied for real. The goal is to catch real failures with tests that mean something — not to inflate coverage numbers or perform a ritual. If TDD does not fit the task, say so and pick a different approach.

## When TDD is the right call

- Implementing a new feature where the inputs and outputs are well-defined before you write code.
- Fixing a reproducible bug: write the failing test that reproduces the bug, then make it pass.
- Refactoring code that already has reasonable test coverage. The tests are your safety net.
- Working on pure logic — parsers, validators, transformers, calculations — where behavior is easy to assert.

## When TDD is the wrong call

- Exploratory spikes where the API shape is unknown. Sketch with scratch code first, then TDD the parts you decide to keep.
- UI-heavy work where wiring tests around layout and interaction costs more than the bugs they catch. Use snapshot or visual regression checks sparingly instead.
- One-off scripts, migrations, or glue code that will not outlive the week.
- Code that is mostly side effects on external systems (network, filesystem, third-party APIs) where a meaningful test requires more scaffolding than the code itself.

If the user asks for TDD on the wrong kind of task, surface the mismatch rather than blindly applying the loop.

## The loop

### RED — write the failing test

- One behavior per test. If the test name has "and" in it, split it.
- Name the test as a plain-English sentence describing the behavior — `returns 404 when the user does not exist`, not `test1` or `userTest`.
- Write the assertion before the setup. Decide what success looks like, then arrange whatever inputs are needed to assert it.
- Run the test. Confirm it fails for the **right reason** — an assertion failure, not an import error, a typo in the function name, or a missing setup.
- If the failure mode is wrong, fix the test setup first. A test that fails for the wrong reason is not a real red.

### GREEN — make it pass with the minimum code

- Write the simplest implementation that makes the new test pass. Hardcoding a return value is allowed here if it satisfies every test currently in the suite.
- Resist adding behavior the tests do not require yet. Each new behavior is a new test in the next loop.
- Re-run the entire suite. Nothing else should have regressed. If something did, that regression is the next thing to investigate.

### REFACTOR — improve the code without changing behavior

- Extract duplication. Rename things that have become clearly named wrong. Tighten types or contracts.
- Run all tests after each refactor step. The tests are the safety net — use them.
- If you cannot refactor without breaking tests, the tests are coupled to implementation. Loosen them to assert on behavior, not internals, before continuing.
- The refactor step is optional per loop but mandatory across the feature. Skipping it forever produces working code that nobody wants to touch.

### Repeat

Pick the next behavior the current code does not handle. Write the test for it. Back to RED.

## Coverage

Aim for roughly 80% line coverage as a **sanity check, not a target.** A suite at 100% with shallow tests is worse than one at 60% with rigorous ones. If you find yourself adding tests just to lift the number, stop.

**Cover deliberately:**

- The full public API surface — every exported function or method that callers use.
- Every documented error path. If the spec says "throws X when Y," there is a test for it.
- The edge cases the spec calls out: empty input, single element, maximum size, boundary values, concurrent access.

**Acceptable gaps:**

- Logging and debug code.
- Generated code (parser output, ORM scaffolding, OpenAPI clients).
- Defensive guards that should never execute in practice — assertions of invariants enforced elsewhere.

## Verifying you actually did TDD

Before declaring the work done, ask:

- Does each test fail when I temporarily break the code it covers? If a test still passes after the underlying behavior is broken, the test is asserting on the wrong thing.
- Did at least one test catch a real mistake during development? If not, the tests may have been written after the fact to confirm code that already worked.
- Is there any behavior I added without a corresponding test? If yes, either add the test now or remove the behavior.

If you wrote all the code first and then wrote tests around it, that is fine for some tasks — but call it what it is. It is not TDD.

## Anti-patterns

- **Tests that satisfy coverage and assert nothing.** A test with no real assertion — or one that asserts `result !== null` and stops there — wastes review time and creates false confidence.
- **Tests that mirror the implementation.** A behavior-preserving refactor should leave tests passing. If the refactor breaks them, they were testing internals, not behavior.
- **Excessive mocking.** When the mock setup is longer than the code under test, the test is exercising the mock, not the system. Mock at boundaries you do not own; use real objects for code you control.
- **Shared mutable fixtures.** A fixture mutated by one test leaks state into the next. Use factory functions that produce fresh data per test.
- **One test that exercises five behaviors.** When it fails, you do not know which behavior broke. Split it.
