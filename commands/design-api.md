---
description: Design an API contract with the api-designer agent before implementing it.
argument-hint: [endpoint | RPC | feature the interface is for]
---

Invoke the `api-designer` agent to design the contract for: $ARGUMENTS

$ARGUMENTS describes the interface to design — an endpoint, an RPC, a feature's public surface, or a change to an existing one. If it names an existing interface, the agent should read the current shape first so the design stays consistent with it and the compatibility implications are explicit.

If $ARGUMENTS is empty, ask what interface to design — the resource or operation, and the protocol/framework if it is fixed — before delegating. Do not guess a surface to design.

The agent produces the contract (resources, request/response and error shapes, pagination, idempotency, versioning), not an implementation.
