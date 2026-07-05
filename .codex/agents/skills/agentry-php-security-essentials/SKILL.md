---
name: agentry-php-security-essentials
description: PHP security-essentials discipline — `declare(strict_types=1)`, prepared statements for every query, escape on output, strict `===` comparison, never `eval`/`extract` on input. Apply when working in any PHP file. Skip for a throwaway CLI spike with no untrusted input.
---

# PHP security essentials

PHP powers a huge share of the web, and it grew up with a set of defaults that make the insecure path the short one: string-built SQL queries, output that renders raw HTML, loose `==` comparisons with surprising rules, and functions that execute strings. None of these is a language flaw you cannot avoid — they are habits, and the secure habits cost the same keystrokes. This rule is the short list that prevents the vulnerabilities PHP applications actually ship: injection, XSS, and type-juggling auth bypasses.

## What the discipline enforces

- **`declare(strict_types=1);` at the top of every file.** Without it, PHP silently coerces types across function boundaries — a string `"0"` becomes `0`, a security check compares the wrong things. Strict types make a type mismatch an error at the call, not a silent coercion downstream.
- **Prepared statements for every query.** PDO (or mysqli) with bound parameters — `$stmt = $pdo->prepare('SELECT ... WHERE id = ?'); $stmt->execute([$id]);`. Never interpolate a value into SQL. The database parses structure and data on separate channels, so input can never become SQL.
- **Escape on output, in the right context.** `htmlspecialchars($value, ENT_QUOTES, 'UTF-8')` before echoing into HTML; the context-correct encoder for a URL, a JS string, or an attribute. Escaping happens at the point of output, not by trying to sanitize input on the way in.
- **Strict comparison for anything that matters.** `===`/`!==`, never `==`, when comparing tokens, hashes, or auth values. PHP's `==` type-juggling (`"0e123" == "0e456"` is true; `0 == "abc"` has changed across versions) turns loose comparison into an auth-bypass primitive. Use `hash_equals()` for token/HMAC comparison to also resist timing attacks.

## When you may be tempted to cut a corner

- **"This value is internal / an integer, concatenating it is fine."** Today. Then the query is reused with a request parameter, or the "integer" arrives as a string from `$_GET`. Bind it — the prepared statement costs nothing extra and the assumption rots.
- **"I'll escape the input when it arrives so I don't have to at output."** Input-time sanitizing is a blocklist that never covers every context — the same value is safe in HTML text and dangerous in an attribute or a URL. Escape at output, where you know the context.
- **"`==` is more forgiving and my test passed."** Forgiving is the problem. `==` on a password hash or a comparison against `0` is exactly where forgiving becomes a hole. Use `===`.

## What to do when you hit one

- **A query with a variable in it.** Rewrite with a prepared statement and bound parameters. For an identifier that cannot be bound (a table or column name from input), map it through an allowlist of permitted names.
- **Data echoed into a page.** Wrap it in the context-correct escaper at the echo site; in a template engine (Twig, Blade) rely on its auto-escaping and never mark untrusted input `|raw`.
- **A comparison in an auth or token path.** `hash_equals($known, $provided)` for secrets; `===` elsewhere.
- **Input reaching a dangerous sink.** There is no safe `eval`, `assert` on a string, `extract($_GET)`, or variable-variable (`$$name`) on user input — remove them. Use an explicit array/allowlist instead of `extract`.

## What you do not do

- **Interpolate or concatenate input into SQL.** Bind it.
- **Echo untrusted data unescaped**, or mark it `|raw`/`{!! !!}` in a template.
- **`==`/`!=` on tokens, hashes, or auth values** — use `===` / `hash_equals`.
- **`eval`, `assert($string)`, `extract()` on request data, or `$$variable` from input** — arbitrary-code and variable-injection sinks.
- **Skip `declare(strict_types=1)`** and rely on PHP's coercion to "just work."
- **Trust `$_GET`/`$_POST`/`$_COOKIE`/headers** as typed or safe — validate and bind.
