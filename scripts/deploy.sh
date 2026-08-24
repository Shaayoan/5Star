#!/usr/bin/env bash
# One-step production setup.
#
#   bash scripts/deploy.sh
#
# Logs into Vercel if needed, links this folder to the existing "5star" project,
# pushes the Supabase env vars, and deploys to production. Safe to re-run — the
# login, link and env vars are all skipped once they exist, so later runs are
# just a redeploy.

set -euo pipefail
cd "$(dirname "$0")/.."

VERCEL="npx --yes vercel@latest"

# The local folder is "5star2" but the Vercel project is "5star", so the project
# must be named explicitly or `link --yes` would create a second one.
PROJECT="${VERCEL_PROJECT:-5star}"

# ---------------------------------------------------------------- env vars --

if [ ! -f .env.local ]; then
  echo "✗ .env.local is missing — copy .env.example and fill it in first." >&2
  exit 1
fi

# Read values without sourcing the file, so odd characters cannot execute.
get_env() {
  grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '\r'
}

SUPABASE_URL="$(get_env NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_KEY="$(get_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "✗ .env.local is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY." >&2
  exit 1
fi

# ------------------------------------------------------------------ login --

if $VERCEL whoami >/dev/null 2>&1; then
  echo "→ Already signed in to Vercel as $($VERCEL whoami 2>/dev/null)"
else
  echo "→ Signing in to Vercel. Pick 'Continue with GitHub' (or whichever you"
  echo "  used) and approve it in the browser window that opens."
  $VERCEL login
fi

# ------------------------------------------------------------------- link --

echo "→ Linking this folder to Vercel project '$PROJECT'…"
$VERCEL link --yes --project "$PROJECT"

# --------------------------------------------------------------- env vars --

# `vercel env add` fails if the variable already exists; that is fine on re-runs.
push_env() {
  local name="$1" value="$2" env
  for env in production preview development; do
    printf '%s' "$value" | $VERCEL env add "$name" "$env" >/dev/null 2>&1 || true
  done
  echo "→ $name is set"
}

push_env NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL"
push_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_KEY"

# ----------------------------------------------------------------- deploy --

echo "→ Building and deploying to production (about a minute)…"
$VERCEL deploy --prod --yes

cat <<'DONE'

────────────────────────────────────────────────────────────
✓ Live and connected: https://5star-iota.vercel.app

Two toggles left, in the Supabase dashboard. Both are optional —
email + password signup already works without them. They only affect
emailed links and signup friction:

1. Turn off the confirmation email so signup logs you straight in:
   https://supabase.com/dashboard/project/mxzvtrpaukvpmarrzqqr/auth/providers
   → expand "Email" → untick "Confirm email" → Save

2. Point magic links and password resets at the live site:
   https://supabase.com/dashboard/project/mxzvtrpaukvpmarrzqqr/auth/url-configuration
   → Site URL:      https://5star-iota.vercel.app
   → Redirect URLs: https://5star-iota.vercel.app/auth/callback
────────────────────────────────────────────────────────────
DONE
