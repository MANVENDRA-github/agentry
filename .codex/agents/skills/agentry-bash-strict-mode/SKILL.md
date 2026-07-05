---
name: agentry-bash-strict-mode
description: Bash strict-mode discipline — start with `set -euo pipefail`, quote every expansion, prefer `[[ ]]`, clean up with `trap`. Apply when writing any Bash or shell script. Skip for a one-line throwaway at an interactive prompt.
---

# Bash strict mode

Bash's defaults are optimized for an interactive prompt, not for a script you trust to run unattended: an unset variable expands to nothing, a failed command is shrugged off, an unquoted variable is split into words and glob-expanded. Each default is a way for a script to keep running after it has already gone wrong — and in a script that touches files, that is how `rm -rf "$dir/"` becomes `rm -rf /` when `$dir` is empty. Strict mode and disciplined quoting turn those silent failures into loud, early ones.

## What the discipline enforces

- **`set -euo pipefail` at the top of every script.** `-e` exits on an unhandled command failure; `-u` treats an unset variable as an error instead of an empty string; `-o pipefail` makes a pipeline fail if any stage fails, not just the last. Together they stop a script the moment reality diverges from your assumption.
- **Quote every expansion.** `"$var"`, `"$@"`, `"${arr[@]}"`. An unquoted expansion is word-split and glob-expanded — a value with a space or a `*` silently becomes multiple arguments or a directory listing. Quoting is the default, not the exception.
- **`[[ ]]` over `[ ]`.** The `[[ ]]` conditional does not word-split its operands and supports `&&`/`||`/pattern matching safely. `[ ]` is a command whose quoting pitfalls cause real bugs.
- **Deterministic temp files and cleanup.** `mktemp` for temp files (never a fixed `/tmp/name` an attacker can predict or a parallel run can clobber), and a `trap ... EXIT` to remove them however the script ends.

## When you may be tempted to cut a corner

- **"`set -e` is annoying, it exits when I expect a failure."** Then handle that failure explicitly: `cmd || true` for a genuinely optional command, or `if cmd; then` when you branch on it. The annoyance is `set -e` correctly catching a case you hadn't handled.
- **"Quoting everything is noisy."** The noise is a value with a space away from a bug. Unquoted `$var` is the single most common shell defect; the quotes are cheaper than the incident.
- **"It's just a quick script."** Quick scripts graduate to cron jobs and CI steps. The habit has to be uniform, because the day it matters is the day you forgot.

## What to do when you hit one

- **A variable that might be unset under `-u`.** Give it a default where that is intended: `"${VAR:-default}"`, or `"${1:?usage: ...}"` to fail with a message when a required argument is missing.
- **A command whose failure is acceptable.** Make it explicit: `cmd || true`, or capture and check `rc=$?`. Don't disable `-e` for the whole script to accommodate one line.
- **A destructive path built from a variable.** Guard it before you use it: check the variable is non-empty (`: "${dir:?}"`) and quote it (`rm -rf -- "$dir"`). An empty or `-`-leading value should never reach `rm`.
- **Data you need to iterate.** Read it safely (`while IFS= read -r line; do ...; done < file`), not by parsing `ls` or splitting an unquoted command substitution.

## What you do not do

- **Ship a script without `set -euo pipefail`** (or an explicit, commented reason a flag is off).
- **Leave an expansion unquoted** — `$var`, `$@`, `$(cmd)` — where word-splitting or globbing can change its meaning.
- **`rm -rf $var`** unquoted and unguarded. Quote it, guard it non-empty, and prefer `--` to stop option injection.
- **Parse the output of `ls`** or rely on unquoted command substitution to split fields.
- **Use a fixed, predictable temp path** instead of `mktemp`, or leave temp files behind because you skipped the `trap`.
- **Ignore a non-zero exit** by not checking it — that is the failure `pipefail` and `-e` are there to surface.
