#!/usr/bin/env bash
# One-step push to GitHub.
#
#   bash scripts/push-github.sh https://github.com/<you>/<repo>.git
#
# Create the repo on github.com first — empty, with NO README, .gitignore or
# licence, otherwise the histories diverge and the push is rejected.
# Git Credential Manager handles the login.

set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:-}"

if [ -z "$REMOTE" ]; then
  cat >&2 <<'USAGE'
✗ Missing the repository URL.

  1. Go to https://github.com/new
  2. Name it (e.g. "5-star"), pick Public or Private, and create it EMPTY —
     do not tick README, .gitignore or licence.
  3. Re-run with the URL it shows you:

     bash scripts/push-github.sh https://github.com/<you>/<repo>.git
USAGE
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ You have uncommitted changes. Commit them first, then re-run." >&2
  git status --short >&2
  exit 1
fi

# `master` is what `create-next-app` initialises; GitHub defaults to `main`.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "→ Renaming branch $BRANCH → main"
  git branch -M main
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "→ Updating existing 'origin' remote"
  git remote set-url origin "$REMOTE"
else
  echo "→ Adding 'origin' remote"
  git remote add origin "$REMOTE"
fi

echo "→ Pushing to $REMOTE"
git push -u origin main

cat <<DONE

✓ Pushed. Your code is at ${REMOTE%.git}

Note: .env.local is gitignored, so your Supabase credentials did NOT go up.
Anyone cloning this needs to copy .env.example to .env.local and fill it in.
DONE
