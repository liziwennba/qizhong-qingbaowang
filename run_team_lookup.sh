#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${TEAM_LOOKUP_PORT:-8000}"
REMOTE="${TEAM_GIT_REMOTE:-origin}"
if [ -n "${TEAM_GIT_BRANCH:-}" ]; then
  BRANCH="$TEAM_GIT_BRANCH"
else
  BRANCH="$(git branch --show-current 2>/dev/null || true)"
  BRANCH="${BRANCH:-main}"
fi
AUTO_PUSH_FLAG=""
if [ "${TEAM_AUTO_PUSH:-0}" = "1" ]; then
  AUTO_PUSH_FLAG="--auto-push"
fi

python3 start_local_server.py   --port "$PORT"   --git-remote "$REMOTE"   --git-branch "$BRANCH"   $AUTO_PUSH_FLAG
