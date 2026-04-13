#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-$(pwd)}"

cd "$REPO_ROOT"

if [ ! -f "dist/main/index.js" ] || [ ! -f "dist/preflight/index.js" ]; then
  echo "Expected committed dist bundles are missing. Run 'npm run build' and commit dist/."
  exit 1
fi

status="$(git status --porcelain --untracked-files=all -- dist)"
if [ -n "$status" ]; then
  echo "Committed dist bundles are out of date. Run 'npm run build' and commit dist/."
  echo "$status"
  exit 1
fi
