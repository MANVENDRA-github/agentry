# Changelog

All notable changes to agentry are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — infrastructure and content expansion

### Added

**Infrastructure and docs:**
- `CHANGELOG.md`, `CONTRIBUTING.md`.
- `docs/architecture.md` — sync design and adapter pattern.
- `docs/authoring.md` — how to write new agents and skills.
- `.github/workflows/sync-check.yml` — CI that catches sync drift and frontmatter errors.
- `scripts/doctor.js` (`npm run doctor`) — install and source health check.
- `scripts/lint-frontmatter.js` (`npm run lint`) — frontmatter validation.

**Agents:**
- `planner` — produces implementation plans before code is written.
- `debugger` — hypothesis-driven root-cause investigation.
- `pr-describer` — generates PR descriptions from a diff.

**Skills:**
- `session-handoff` — structured handoff notes for resuming work.
- `git-commit-craft` — conventional commits with explained motivation.
- `error-debugging` — in-conversation debugging discipline (companion to the `debugger` agent).
- `code-review` — self-review discipline (companion to the `code-reviewer` agent).

**Commands** (Claude Code only):
- `/plan`, `/review`, `/debug`, `/commit`, `/handoff` — slash-command wrappers for the most-used agents and skills.

### Changed

- `package.json` adds `doctor` and `lint` npm scripts.
- Plugin manifest version bumped to `0.2.0`.

## [0.1.0] — initial release

### Added

- Source-of-truth directories: `agents/`, `skills/`.
- Sync engine (`scripts/sync-harnesses.js`) with adapters for Claude Code and Cursor.
- One agent: `code-reviewer` — correctness, security, maintainability, conventions.
- One skill: `tdd-workflow` — red-green-refactor with discipline checks.
- Installers: `scripts/install.sh` (Unix/macOS), `scripts/install.ps1` (Windows).
- Plugin manifest at `.claude-plugin/plugin.json` for Claude Code.

### Architecture

- Single source of truth in top-level directories; generated harness directories are regenerated on every sync.
- v0.1 supports two harnesses (Claude Code, Cursor); more planned for v0.3+.
