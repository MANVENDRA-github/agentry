---
name: injection-safety
description: SQL injection-safety discipline — every user value goes through a bound parameter, never string-built SQL, allowlist the identifiers that can't be bound. Apply when writing or reviewing any SQL or query-building code. Skip only for a fixed, fully-static query with no external input anywhere in it.
language: sql
---

# SQL injection safety

SQL injection is the oldest serious web vulnerability and still one of the most common, because the unsafe way — pasting a value into a query string — is the way that looks easiest. The fix is not clever escaping; it is refusing to build queries out of strings at all. A bound parameter sends the query structure and the data on separate channels, so a value can never be reinterpreted as SQL no matter what it contains. Treat every value that did not come from your own source code as hostile, and there is nothing to escape.

## What the discipline enforces

- **Parameterize every value, always.** Use bound parameters / prepared statements (`WHERE id = ?`, `= $1`, `= :id`) for every user-supplied value. The database receives the data as data; it is never parsed as SQL.
- **Never concatenate or interpolate input into a query.** `"... WHERE name = '" + name + "'"` and its f-string/template equivalents are the vulnerability. There is no safe amount of input to concatenate.
- **Identifiers that can't be bound go through an allowlist.** Table names, column names, `ORDER BY` targets, and `ASC`/`DESC` cannot be parameters. When they must come from input, map the input against a fixed allowlist of permitted values — never pass it through.
- **Least privilege at the connection.** The application's DB account has only the rights it needs (no `DROP`, no access to other schemas). A successful injection is far less damaging against a constrained account.

## When you may be tempted to cut a corner

- **"This value is an integer / from a dropdown, it's safe."** It is safe until the schema changes, the endpoint is reused, or the client is bypassed. Parameterize it anyway — the cost is zero and the assumption rots.
- **"I'll just escape the quotes."** Manual escaping is a blocklist, and blocklists lose: encodings, comment tricks, and second-order injection route around them. Binding is a structural guarantee; escaping is a guess.
- **"It's an internal admin tool, no attackers."** Internal input is still input, and internal tools handle the most dangerous privileges. The habit has to be uniform or it fails at the worst moment.

## What to do when you hit one

- **A query built by string concatenation.** Rewrite it with bound parameters. If you are using an ORM or query builder, use its parameter-binding API, not its raw-SQL escape hatch with an interpolated value.
- **A dynamic column or sort order from input.** Validate the input against an explicit allowlist (`{"name", "created_at"}`) and use the matched constant. Reject anything not on the list.
- **A `LIKE` with user input.** Bind the value *and* escape the `%`/`_` wildcards in the data so a user can't turn a prefix search into a full scan or change its meaning.
- **A raw fragment in an ORM** (`.whereRaw`, `text()`, `@Query` with concatenation). Move the input into a bound parameter; keep only static SQL in the fragment.

## What you do not do

- **Interpolate or concatenate any external value into SQL.** Bind it.
- **Rely on manual escaping or quoting** as your injection defense. Use parameters.
- **Pass user input as a table/column/identifier** without an allowlist mapping.
- **Use an ORM's raw-SQL escape hatch with an unbound value** — the ORM's safety is exactly the part you'd be bypassing.
- **Run the app on a high-privilege DB account** "to avoid permission errors." Grant the minimum; injection blast radius is a function of privilege.
