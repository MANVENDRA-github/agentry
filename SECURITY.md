# Security policy

## What agentry is, in security terms

agentry generates configuration that AI coding harnesses read and act on. It ships no server, opens no ports, and makes no network calls. Its `hooks/` are shell and Node scripts that a harness executes on your machine, and its `mcp/` files describe servers the harness launches. So the realistic threat is not a remote attacker — it is content in this repo causing your harness to run something you did not intend, or leaking something you did not mean to share.

That makes the following in-scope:

- A hook that executes attacker-influenced input, or that fails open when it should block.
- An MCP server definition that inlines a secret, or points at a package that is not what it claims.
- A sync bug that writes outside the generated directories, or that lets source content escape into an unintended file.
- An agent, skill, or rule whose instructions would lead a harness to exfiltrate credentials, disable a safety check, or run a destructive command.
- A dependency with a known advisory.

Out of scope:

- Vulnerabilities in the harnesses themselves (Claude Code, Cursor, Codex, OpenCode) — report those to their maintainers.
- Vulnerabilities in MCP servers agentry merely references (`@modelcontextprotocol/server-filesystem`, `mcp-server-git`) — report those upstream.
- A harness executing a hook you installed on purpose. That is the feature.

## Reporting a vulnerability

**Do not open a public issue.**

Use GitHub's private reporting: go to the [Security tab](https://github.com/MANVENDRA-github/agentry/security/advisories/new) and open a draft advisory. It reaches the maintainer directly and stays private until a fix ships.

Include what you would want to receive: the affected file and version, what an attacker can do, and the smallest reproduction you can manage. A concrete repro is worth more than a severity score.

You should get an acknowledgement within **7 days**. If a report is valid, expect a fix or a public advisory within **30 days**, and credit in the advisory unless you ask otherwise.

## Supported versions

agentry is installed by cloning, not from a package registry, so there is no back-porting. Fixes land on `main` and go out in the next tagged release. If you are running an older tag, upgrade rather than expecting a patch release.

| Version | Supported |
| --- | --- |
| Latest tagged release | Yes |
| `main` | Yes |
| Anything older | No — upgrade |

## What agentry does on your behalf

Worth knowing before you run `npm run sync`:

- **Sync wipes and rewrites** `.claude/`, `.cursor/`, `.codex/`, `.opencode/`, `.mcp.json`, and `opencode.json`. It writes nowhere else. If you have hand-edited those, your edits are gone — that is by design, and `protect-generated-dirs` exists to warn you first.
- **Hooks are not installed automatically.** The files in `hooks/` are copied into `.claude/hooks/`, but nothing wires them into your `settings.json` unless you do it yourself. Read a hook before you enable it.
- **MCP definitions launch processes.** `mcp/filesystem.json` and `mcp/git.json` run `npx` and `uvx` respectively, which fetch packages at launch. Pin or vendor them if that is not acceptable in your environment.
- **No secrets belong in `mcp/`.** Reference an environment variable the harness expands. A literal credential in an `mcp/*.json` is committed, synced into four generated files, and pushed.

## Dependencies

agentry has **no dependencies at all** — no runtime, no dev, no lockfile. It runs on the Node standard library and `node:test`. That is deliberate: the smallest supply chain is the one you do not have.

Dependabot (`.github/dependabot.yml`) watches the npm manifest and the GitHub Actions used by the workflows, grouped and updated weekly. In practice only the Actions entry has anything to do. Security advisories are opened immediately rather than waiting for the weekly schedule.
