# Contributing to agentry

Thanks for considering a contribution. agentry is intentionally small. Every addition is evaluated against the same bar: does this earn its place in a curated repo?

## What to contribute

- **Bug fixes.** Always welcome. Reproduce the bug, fix it, add a check or test if reasonable.
- **New agents or skills.** Welcome if you can justify them. Before opening a PR, read 2–3 existing files in the same directory, match their format and depth, and write a short rationale in the PR description that names a concrete use case you have hit.
- **New harness adapters.** Welcome. Open an issue first so we can align on the source→target mapping before you implement.
- **Documentation improvements.** Welcome, especially additions to `docs/authoring.md` and `docs/architecture.md` based on real friction you experienced.

Contributions that touch `scripts/frontmatter.js` or `scripts/cursor-transform.js` should include a test in `tests/` that defends the new or changed behavior.

## Discipline

- **No speculative content.** Add what solves a real problem. "Might be useful" is not enough.
- **Match existing patterns.** New agents and skills should look and feel like the existing ones.
- **Quality over quantity.** Five excellent skills beats fifty mediocre ones. This is agentry's whole positioning.
- **Universal first, language rules second.** Agents, skills, and commands stay language- and framework-neutral. Language-specific discipline belongs in `rules/<language>/`, which is where every language rule lives — adding one there means adding its glob to `LANGUAGE_GLOBS` in `scripts/cursor-transform.js` so it auto-attaches in Cursor.
- **Sharp descriptions.** Every component's `description` field must name when to invoke it. Vague descriptions cause vague invocations.

## Local development workflow

```bash
git clone https://github.com/MANVENDRA-github/agentry.git
cd agentry
# Node 18 or newer required
npm run sync       # generate .claude/, .cursor/, .codex/, .opencode/ + MCP configs from source
npm run doctor     # check that everything looks right
# ... make your changes to agents/, skills/, docs/, scripts/ ...
npm run sync       # regenerate after every source change
npm run lint       # validate frontmatter on agents and skills
npm test           # run unit tests on extracted helpers
git add -A
git commit -m "feat: ..."
```

Generated output (`.claude/`, `.cursor/`, `.codex/`, `.opencode/`, `.claude-plugin/`, `.mcp.json`, and `opencode.json`) is committed alongside source so contributors can browse it on GitHub. Never edit any of it directly — it is wiped and rewritten by the next sync, and the `protect-generated-dirs` hook exists to stop you.

## Commit and PR conventions

- **Conventional commits.** Prefix every commit and PR title with one of: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`. The prefix tells reviewers what to expect.
- **One logical change per PR.** A new agent is one PR. Adding the agent and refactoring the sync engine in the same PR is two.
- **Include the regenerated harness files.** CI will fail the PR if your source changes don't produce a clean `npm run sync`.

## What gets rejected

- Speculative content with no real-world use case behind it.
- Language- or framework-specific **agents and skills** (a TypeScript-only reviewer, a Django-only skill). Language-specific discipline goes in `rules/<language>/` instead; agents and skills stay neutral.
- Marketing-style edits to the README. Functional > flashy.
- Changes that break sync determinism. CI catches this; please run `npm run sync` locally before committing.
- Components with vague descriptions or missing required frontmatter fields. `npm run lint` will catch these.

## License

By submitting a contribution you agree that it is licensed under the MIT License, same as the rest of the project.
