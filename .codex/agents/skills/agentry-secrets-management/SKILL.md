---
name: agentry-secrets-management
description: Handle a secret across its whole lifecycle — keep it out of source and image layers, inject it at runtime via environment or a secret store, scope each credential to least privilege, and rotate on a schedule and immediately after exposure. Invoke when code needs an API key, DB password, token, or private key, or when wiring how an app obtains its secrets. Complements the secret-scan hook (which only blocks committing a literal) and security-review (which only flags secrets in your diff). Skip for code that handles no credentials.
---

# Secrets management

A secret is a credential that grants access — an API key, a database password, a token, a private key — and the whole game is controlling who can read it and cutting off anyone who shouldn't. The default mistakes are cheap to make and expensive to unwind: a key hardcoded in a source file, one shared secret reused across dev, staging, and prod, a `.env` committed "just for a moment." The costliest is the one nobody plans for — no rotation path. When a secret leaks and you cannot rotate it cleanly, a five-minute cutover becomes a multi-day scramble across every service that hardcoded it. This skill is about handling a secret across its whole life: keep it out of the tree, inject it at runtime, scope it tightly, and be able to rotate it on a Tuesday afternoon without an incident.

This complements two narrower tools. The secret-scan hook blocks committing a literal that matches a pattern; security-review flags a secret that appears in your diff. Both catch a secret at the moment it enters the repo — neither tells you how the app should obtain, scope, or rotate the credential in the first place. That is this skill.

## When to invoke

- Writing code that needs a credential — an API key, DB password, OAuth token, signing key, webhook secret, or private key.
- Wiring how an application obtains its secrets: env vars, a `.env` loader, a secret manager, a mounted file, a CI/CD variable.
- Adding a new environment or a new service that needs an existing credential — the moment you would otherwise copy a secret to a second place.
- Reacting to a suspected or confirmed leak: a key pushed to a public repo, a token in a log, a credential in a screenshot.

## When NOT to invoke

- Code that handles no credentials — pure logic, a UI component, a data transform with no auth.
- The narrow act of "did I just commit a literal key" — the secret-scan hook already guards that mechanically.

## Keep it out of source and image layers

- **Never hardcode a secret in source.** Not in a constant, not in a config file that ships, not in a comment, not in a test fixture. Once it is in a commit it is in the history forever, and rewriting history across every clone and fork is not a remediation you want to run under pressure.
- **`.env` is for local development and is git-ignored, always.** Add `.env` (and `.env.*`) to `.gitignore` before you write the first line into it. Commit a `.env.example` with the *keys* and dummy values so a new developer knows what to set — never the real values.
- **No secrets baked into an image layer.** A value in an `ENV`, an `ARG`, or a `COPY`ed file lives in the layer history and is recoverable even if a later layer deletes it. Inject at runtime or use a build-time secret mount (`RUN --mount=type=secret`) that does not persist. (See the containerization skill for the image side of this.)
- **Keep them out of the places secrets leak sideways** — CI logs, error messages, log lines, exception dumps, client-side bundles, and URLs (a token in a query string lands in access logs and browser history). Scrub before you log; keep secrets server-side.

## Inject at runtime, scoped to least privilege

- **The app reads its secrets from the environment at runtime, not from the tree.** Environment variables for the simple case; a secret manager (Vault, AWS/GCP/Azure secret managers, SOPS-encrypted files, a platform's secret store) when you need audit logs, versioning, and access control. The code references a *name*; the value arrives from outside.
- **Fail fast on a missing secret.** Read required secrets at startup and exit with a clear message if one is absent (`ENV.fetch("DB_PASSWORD")`), so a misconfiguration fails at boot, not at 3am on the first request that needed it.
- **One distinct secret per environment.** Dev, staging, and prod each get their own credential. A shared secret means a dev-machine compromise is a prod compromise, and rotating one forces rotating all. Separate credentials contain the blast radius and let you rotate independently.
- **Scope each credential to least privilege.** A key that only reads should not be able to write; a service's DB account gets only the tables and rights it uses; a token is scoped to the narrowest set of permissions and the shortest sensible lifetime. When the credential leaks, least privilege is the difference between "attacker read one bucket" and "attacker owned the account."
- **Prefer short-lived, automatically-issued credentials** where the platform offers them — OIDC federation in CI instead of a long-lived cloud key, IAM roles instead of static access keys, a token service instead of a permanent secret. A credential that expires on its own is one you cannot forget to rotate.

## Rotate — on a schedule and immediately after exposure

- **Build the rotation path before you need it.** The reason rotation is painful is that nobody designed for it. A credential the app reads by *name* from a secret store can be swapped centrally; one hardcoded in ten services must be hunted down in ten places. Design so that changing a secret is a config change, not a code change and redeploy.
- **Rotate on a schedule.** Every secret has a maximum age. Rotating routinely means the mechanism is exercised and trusted, so the emergency rotation — the one that matters — is a procedure you have run, not one you are improvising.
- **Rotate immediately on any suspected exposure.** A key pushed to a repo (even a private one, even force-pushed away), a token in a shared log, a credential a departing employee held — treat it as compromised and rotate now. Revoking is cheap; assuming it is fine is how the breach report reads.
- **Support overlap during cutover.** Where you can, provision the new secret alongside the old, roll consumers over, then revoke the old one — so rotation is zero-downtime instead of a coordinated flip that risks an outage. This is exactly the capability a leak-day scramble wishes it had.

## Anti-patterns

- **A hardcoded key in source.** In history forever; rotating it is the *only* real fix, so make sure you can.
- **A committed `.env`.** Git-ignore it before first use; commit a `.env.example` with dummy values instead.
- **One shared secret across every environment.** A dev leak becomes a prod incident and you cannot rotate one without rotating all. One credential per environment.
- **An over-privileged credential** — an admin key where a read-only scope would do. Scope to least privilege so a leak is survivable.
- **No rotation path** — secrets hardcoded across many services so changing one means a code hunt and redeploy. Reference secrets by name from a store you can swap centrally.
- **A secret in a log, an error message, a URL, or a client bundle.** It persists and it ships. Keep secrets server-side and scrub the error path, where whole request objects get dumped.
- **"I force-pushed the leaked key away, so it's fine."** It was public/pulled/cached; it is compromised. Rotate it.
- **A long-lived static cloud key** where the platform offers short-lived federated credentials. The permanent secret is the one you forget to rotate.
