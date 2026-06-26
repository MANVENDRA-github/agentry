#!/usr/bin/env bash
# agentry installer (Unix/macOS)
#
# Copies generated agentry content from this repo into your AI harness's
# expected location. Run `npm run sync` first to produce the generated files.
# Never edit the generated directories directly — they are wiped by the next sync.
#
# Usage:
#   ./scripts/install.sh --target claude              # install to ~/.claude/
#   ./scripts/install.sh --target claude --project    # install to ./.claude/
#   ./scripts/install.sh --target cursor              # install to ./.cursor/
#   ./scripts/install.sh --target codex               # install to ~/.agents/skills/
#   ./scripts/install.sh --target codex --project    # install to ./.agents/skills/
#   ./scripts/install.sh --target claude --uninstall  # remove installed files
#   ./scripts/install.sh --help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET=""
SCOPE=""
USER_FLAG=0
PROJECT_FLAG=0
UNINSTALL=0

usage() {
  cat <<'EOF'
Usage: install.sh --target <name> [--user|--project] [--uninstall] [--help]

Targets:
  claude    Claude Code config (default scope: --user)
  cursor    Cursor project config (default scope: --project)
  codex     Codex skills (default scope: --user)

Flags:
  --user        Install to user-level location (claude, codex)
  --project     Install to current working directory's project location
  --uninstall   Remove agentry-installed files instead of copying
  --help, -h    Show this help and exit

Examples:
  ./scripts/install.sh --target claude
  ./scripts/install.sh --target claude --project
  ./scripts/install.sh --target cursor
  ./scripts/install.sh --target codex
  ./scripts/install.sh --target codex --project
  ./scripts/install.sh --target claude --uninstall
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      if [[ $# -lt 2 ]]; then
        echo "Error: --target requires a value" >&2
        exit 1
      fi
      TARGET="$2"
      shift 2
      ;;
    --target=*)
      TARGET="${1#--target=}"
      shift
      ;;
    --user)       USER_FLAG=1; shift ;;
    --project)    PROJECT_FLAG=1; shift ;;
    --uninstall)  UNINSTALL=1; shift ;;
    --help|-h)    usage; exit 0 ;;
    *)
      echo "Error: unknown argument '$1'" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Error: --target is required" >&2
  usage >&2
  exit 1
fi

case "$TARGET" in
  claude|cursor|codex) ;;
  *)
    echo "Error: unknown target '$TARGET'. Valid: claude, cursor, codex" >&2
    exit 1
    ;;
esac

if [[ $USER_FLAG -eq 1 && $PROJECT_FLAG -eq 1 ]]; then
  echo "Error: cannot specify both --user and --project" >&2
  exit 1
fi

if [[ $USER_FLAG -eq 1 ]]; then
  SCOPE="user"
elif [[ $PROJECT_FLAG -eq 1 ]]; then
  SCOPE="project"
elif [[ "$TARGET" == "claude" || "$TARGET" == "codex" ]]; then
  SCOPE="user"
else
  SCOPE="project"
fi

if [[ "$TARGET" == "cursor" && "$SCOPE" == "user" ]]; then
  echo "Error: Cursor has no user-level config directory. Use --project." >&2
  exit 1
fi

if [[ "$TARGET" == "claude" ]]; then
  SRC_DIR="$REPO_ROOT/.claude"
  if [[ "$SCOPE" == "user" ]]; then
    DEST_DIR="$HOME/.claude"
  else
    DEST_DIR="$PWD/.claude"
  fi
  SUBDIRS=("agents" "skills" "commands" "rules" "hooks")
elif [[ "$TARGET" == "cursor" ]]; then
  SRC_DIR="$REPO_ROOT/.cursor"
  DEST_DIR="$PWD/.cursor"
  SUBDIRS=("agents" "rules")
else
  # codex: skills live under .agents/skills/ at the destination. The src path
  # points at .codex/agents (one level above the skills/ subdir), so the
  # generic loop below works: src_sub = SRC_DIR/skills, dest_sub = DEST_DIR/skills.
  SRC_DIR="$REPO_ROOT/.codex/agents"
  if [[ "$SCOPE" == "user" ]]; then
    DEST_DIR="$HOME/.agents"
  else
    DEST_DIR="$PWD/.agents"
  fi
  SUBDIRS=("skills")
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Error: Generated directory not found at $SRC_DIR" >&2
  echo "Run 'npm run sync' first." >&2
  exit 1
fi

# Uninstall removes only entries whose names match what's currently in the
# repo's generated dir — user-authored files in the destination are preserved.
if [[ $UNINSTALL -eq 1 ]]; then
  echo "Uninstalling $TARGET from $DEST_DIR"
  for subdir in "${SUBDIRS[@]}"; do
    src_sub="$SRC_DIR/$subdir"
    dest_sub="$DEST_DIR/$subdir"
    [[ -d "$src_sub" ]] || continue
    [[ -d "$dest_sub" ]] || continue
    shopt -s nullglob
    for entry in "$src_sub"/*; do
      name="$(basename "$entry")"
      target_path="$dest_sub/$name"
      if [[ -e "$target_path" ]]; then
        rm -rf "$target_path"
        echo "  - removed $target_path"
      fi
    done
    shopt -u nullglob
  done
  echo "Uninstalled $TARGET from $DEST_DIR"
  exit 0
fi

echo "Installing $TARGET to $DEST_DIR"
for subdir in "${SUBDIRS[@]}"; do
  src_sub="$SRC_DIR/$subdir"
  [[ -d "$src_sub" ]] || continue
  dest_sub="$DEST_DIR/$subdir"
  mkdir -p "$dest_sub"
  shopt -s nullglob
  for entry in "$src_sub"/*; do
    name="$(basename "$entry")"
    target_path="$dest_sub/$name"
    if [[ -d "$entry" ]]; then
      rm -rf "$target_path"
      cp -R "$entry" "$target_path"
    else
      cp "$entry" "$target_path"
    fi
    echo "  + $target_path"
  done
  shopt -u nullglob
done
echo "Installed $TARGET to $DEST_DIR"
