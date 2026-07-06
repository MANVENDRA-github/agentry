---
name: config-safety
description: "YAML gotchas when authoring or editing `.yml`/`.yaml` files: quote ambiguous scalars to defeat the Norway problem (`no`/`off`/`yes` parse as booleans, `1.20` truncates to a float, leading-zero values become octal or strings), indent with spaces and never tabs, reject duplicate keys, and keep anchors/aliases minimal. Invoke whenever writing or modifying a YAML config, CI, or manifest file, where a value that reads correctly can parse wrong with no error."
language: yaml
---

# YAML config safety

YAML looks like a format where what you type is what you get, and that is exactly the trap. It has an untyped scalar layer that guesses a value's type from its shape, so `country: no` is the boolean `false`, `version: 1.20` is the float `1.2`, `zip: 08544` is either an error or a string depending on the parser's octal rules, and `time: 22:22` is the integer `1342` (base-60). None of these is a syntax error — the file parses cleanly and the wrong value flows into your program, surfacing as a bug only when something reads it. The discipline is to stop trusting the guesser: quote anything whose type is not obvious, indent with spaces, and never let two keys or a stray tab change the document's meaning silently.

## What the discipline enforces

- **Quote every ambiguous scalar.** If a string could be read as a boolean, number, date, or null, wrap it in quotes so it stays a string. `"no"`, `"off"`, `"yes"`, `"true"`, `"null"`, `"~"`, a version like `"1.20"`, a leading-zero code like `"08544"`, a time like `"22:22"`. The quotes cost two characters and remove the guess entirely.
- **Indent with spaces, never tabs.** The YAML spec forbids tabs for indentation; a single tab is a parse error at best and, mixed with spaces, a structure that nests differently than it looks. Set the editor to two spaces and make the setting part of the repo (`.editorconfig`).
- **Every key in a mapping is unique.** A duplicate key is not an error in most parsers — the last one silently wins, so a `timeout:` defined twice quietly discards the first value. Treat a duplicate key as a bug and enable a linter that rejects it.
- **Keep anchors and aliases minimal and local.** `&anchor`/`*alias` and merge keys (`<<:`) are useful for a small shared block, but a web of anchors across a large file makes the effective value of a key impossible to read at the point of use — and a YAML bomb (an alias expanded exponentially) is a denial-of-service. Use them sparingly, close to their definition.

## When you may be tempted to cut a corner

- **"It's obviously a string, it doesn't need quotes."** Obvious to you; the parser reads `no`, `on`, `y`, `1.10`, and `09` by rule, not by intent. The value that "obviously" reads right is the one that parses wrong and ships. Quote the ambiguous cases uniformly rather than adjudicating each one.
- **"Tabs and spaces look the same in my editor."** They look the same and parse differently — that is the entire hazard. Turn on whitespace rendering, or better, let a linter and `.editorconfig` enforce spaces so the question never comes up.
- **"One anchor saves me repeating this block."** One is fine. The corner is the tenth, when the file's real configuration lives in a merge chain three anchors deep and no reader can tell what a given service actually gets. Prefer a little repetition over an unreadable indirection.

## What to do when you hit one

- **A value that parsed as the wrong type.** Quote it. A country code `no`, a feature flag string `off`, a Git SHA that happens to be all digits, a phone number with a leading `+` or `0` — wrap in single or double quotes so it is unambiguously a string. Use single quotes unless you need escape sequences.
- **A version or decimal that lost a digit.** `1.20` became `1.2` and `2.0` became `2` because they parsed as floats. Quote them as strings (`"1.20"`) — a version is an identifier, not a number you do arithmetic on.
- **A leading-zero value.** `08` or `09` errors as an invalid octal (YAML 1.1) or parses as a decimal string differently across versions; `0755` silently becomes octal. Quote any leading-zero value that is really a string (zip code, employee id, permission you mean literally), and write real octal explicitly (`0o755` in YAML 1.2) only when you mean a number.
- **A duplicate key or a tab.** Delete the duplicate (decide which value is correct — the parser already silently chose the last) and replace tabs with spaces. Add a linter step so the next one is caught at commit, not in production.

## What you do not do

- **Leave an ambiguous scalar unquoted** — a bare `no`/`yes`/`on`/`off`, a version, a leading-zero code, a time or date-shaped string — and trust the parser to keep it a string. It will not.
- **Indent with tabs, or mix tabs and spaces.** Spaces only, enforced by config, not by vigilance.
- **Ship a file with a duplicate key** because it parsed without complaint. The silent last-wins is the bug.
- **Build a deep chain of anchors, aliases, and merge keys** that hides a key's effective value, or accept an alias-expansion (YAML bomb) from untrusted input.
- **Load untrusted YAML with a full/unsafe loader** that instantiates arbitrary types (`yaml.load` without `SafeLoader`, a language binding that constructs objects). Use the safe/typed loader for anything you did not write.
