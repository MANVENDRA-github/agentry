---
name: mcp-authoring
description: Build a well-behaved Model Context Protocol server — tool and resource design, input schemas, structured errors, transport choice (stdio vs remote), and secret handling. Invoke when writing or extending an MCP server other tools will call. Skip for consuming an existing server.
---

# MCP authoring

The discipline of building a Model Context Protocol server that an agent can actually use well. An MCP server exposes tools, resources, and prompts to an AI client; the quality of that interface decides whether the model calls it correctly or flails. The server is an API whose primary consumer is a language model, and that consumer has specific failure modes — it cannot see your source, it reads your tool descriptions literally, and it will pass whatever your schema allows. Design for that reader.

This is for building or extending a server; skip it when you are merely consuming one.

## When to invoke

- Writing a new MCP server, or adding a tool, resource, or prompt to an existing one.
- Designing the schema, descriptions, or error behavior of an MCP tool other agents will call.
- Deciding how a server authenticates, handles secrets, or chooses a transport.

## When NOT to invoke

- Configuring or consuming a server someone else wrote — that is a config task, not an authoring one.
- A throwaway local experiment you will not expose to a model or another user.

## The model is your API consumer — design for it

- **The description is the contract.** A tool's `description` is the only thing the model reads to decide when and how to call it. State what it does, when to use it, and what it returns, in plain imperative language. "Searches the order database by customer email and returns matching orders" beats "order lookup." A vague description is a tool the model misuses or ignores.
- **Schemas are guardrails, not suggestions.** Define every input with a JSON Schema: types, which are required, enums for fixed sets, formats and bounds where they apply. The model passes what the schema permits — so make invalid calls unrepresentable rather than validating them by hand and erroring.
- **Name tools for the task, not your internals.** `create_invoice`, not `db_insert_invoices_row`. The name is part of the description; it should read like the capability, not the implementation.
- **Return what the model can use next.** Structured, concise results — the fields that inform the next step, not a raw dump of your internal object. Large blobs that belong to addressable state are resources, not tool return values.
- **Keep one tool to one job.** A single tool with a `mode` flag that does five different things is harder for the model to call correctly than five clear tools. Split by task.

## Errors, transport, and secrets

- **Errors are instructions to the model.** When a call fails, say what was wrong and what to do — "`email` is required" or "no order found for that id; check the id and retry." A bare "error" or a leaked stack trace teaches the model nothing and wastes a turn. Distinguish a bad-input error (the model can fix it) from a server fault (it cannot).
- **Choose the transport for the deployment.** stdio for a local server the client launches as a subprocess; a remote transport (HTTP/SSE) for a hosted service multiple clients reach. Match what the harness expects, and declare it clearly.
- **Secrets come from the environment, never the code.** A key or token the server needs is read from an environment variable or secret store the host expands — never hardcoded, never in the manifest, never logged. agentry's own `mcp/*.json` convention is exactly this: reference an env var the harness fills in.
- **Least privilege.** A server scoped to a directory should not serve the whole filesystem; one that reads should not also delete unless that is its job. The narrowest capability that does the task is the safest one to hand a model.

## Anti-patterns

- **Terse or missing descriptions.** The single biggest cause of tool misuse. The model cannot infer intent from a name alone; if you would not understand the tool from its description, neither will it.
- **Loose schemas.** `args: object` with no shape means the model guesses the fields and the server validates by hand — exactly the brittleness the schema exists to remove.
- **Leaking internals in results or errors.** Table names, stack traces, internal ids the model cannot act on. They confuse the consumer and expose the implementation.
- **Hardcoded secrets.** A key in the source or the server config is a credential leak the moment the repo is shared, and a rotation nightmare regardless.
- **The kitchen-sink tool.** One overloaded tool with many optional fields and modes, where the valid combinations live only in your head. The model cannot see your head. Split it.
