---
name: api-design
description: Designing a clean, consistent API contract before implementing it — resource naming, error shapes, versioning, pagination, idempotency, and compatibility. Invoke when adding or changing an endpoint, RPC, or any interface other code will call. Protocol-agnostic. Skip for purely internal helpers with one caller.
---

# API design

The contract comes before the code. An API is a promise to its callers, and the expensive mistakes are made in the shape of that promise, not in the implementation behind it. A bad implementation is a refactor away from good; a bad contract, once callers depend on it, is a breaking change away from good — and breaking changes cost everyone who integrated. Design the contract deliberately, before you build it.

This applies to any interface other code calls across a boundary: a REST endpoint, an RPC method, a GraphQL field, a library's public function, a webhook payload. The protocol differs; the principles do not.

## When to invoke

- Adding a new endpoint, RPC, public function, or event others will consume.
- Changing the shape of an existing contract — request, response, or error.
- Designing a payload other systems will parse (a webhook, a message, an export format).

Skip it for a private helper with a single in-module caller. There the contract is cheap to change because you change every caller at once.

## Design the contract first

Before writing the handler, pin down — on paper or in a stub — the full contract:

- **The resource or operation.** What noun or verb does this expose, and what does it model?
- **Inputs.** Every parameter: name, type, required-or-optional, default, and validation rule. What makes a request invalid, and what happens when it is.
- **Outputs.** The success response shape, field by field, and the status or result that signals success.
- **Errors.** Every failure mode the caller must distinguish, and how each is reported.

If you cannot write the contract down clearly, the caller cannot use it clearly. The struggle to specify it is the design surfacing its own gaps.

## Principles

- **Consistency over local cleverness.** The most important property of an API is that it behaves like the rest of the API around it. Match the existing naming, casing, pagination, error shape, and auth conventions of the surface you are extending — even ones you would have designed differently. A consistent surface that is 80% ideal beats a patchwork of locally-optimal endpoints. Find the existing pattern and follow it before inventing a new one.
- **Name for the consumer, not the implementation.** Resource and field names describe what the caller works with, not how you store or compute it. Do not leak table names, internal enums, or implementation details into the contract — they become a promise you did not mean to make.
- **Predictable shapes.** A collection is always a list, even when it has one element. An optional field is consistently absent or consistently null — pick one. The same concept has the same name everywhere. Surprise is the enemy; a caller should be able to guess the next field correctly.
- **Make invalid states unrepresentable where you can.** Required things required, mutually exclusive options modeled so both cannot be sent, enums instead of free strings for fixed sets. The contract should reject nonsense at the edge, not absorb it.

## Errors are part of the contract

The error path is designed, not improvised. Callers branch on it.

- **Distinguishable failures.** A caller must be able to tell "you sent bad input" from "you are not allowed" from "it does not exist" from "we broke" — different categories, programmatically distinguished (status codes, error codes), because the caller does different things for each.
- **Actionable messages.** Say what was wrong and, where possible, how to fix it. "Invalid request" wastes the caller's time; "field `email` is required" does not.
- **Stable error codes.** If callers branch on an error identifier, that identifier is part of the contract — changing it is a breaking change. Treat it with the same care as a field name.
- **No internal leakage.** Stack traces, SQL fragments, and internal paths do not belong in a response a client sees. They are both a usability failure and a security one.

## Designing for change

Contracts outlive the code behind them, and callers you cannot see depend on them. Design so you can evolve without breaking.

- **Additive change is safe; subtractive and reshaping change is not.** Adding an optional field rarely breaks a caller. Removing a field, renaming one, tightening a type, or changing a default does. Sort your intended change into the right bucket before shipping it.
- **Version at the boundary, not in a thousand `if`s.** When a breaking change is unavoidable, version the contract (path, header, or explicit new operation) rather than quietly changing behavior under callers who did not opt in.
- **Pagination, filtering, and limits from the start.** Any collection that can grow needs a bound on what one call returns. Retrofitting pagination onto an endpoint that returned everything is a breaking change; designing it in is free.
- **Idempotency where retries happen.** Operations that create or mutate, and that a client might retry after a timeout, should define what a duplicate call does — an idempotency key, an upsert semantic, a safe-to-repeat guarantee. Undefined retry behavior is a data-corruption bug waiting for a flaky network.

## Anti-patterns

- **Designing the contract by writing the handler.** The implementation's convenience leaks into the interface, and the caller inherits your storage decisions as permanent promises.
- **A new convention per endpoint.** Snake_case here, camelCase there; `items` in one list and `results` in the next; a different error shape each time. Each inconsistency is a thing every caller must learn and remember.
- **Leaking internals.** Database column names, internal status enums, and implementation details in the public shape. You cannot change them later without a breaking change.
- **Unversioned breaking changes.** Reshaping a response under live callers because "it's a small change." It is small for you and outage-shaped for them.
- **Ignoring the error path until something fails.** Errors invented ad hoc at implementation time are inconsistent, unhelpful, and impossible to branch on reliably.
