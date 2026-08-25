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
# Optional: without it the app still works, /chat just shows a setup screen.
GEMINI_KEY="$(get_env GEMINI_API_KEY)"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "✗ .env.local is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY." >&2
  exit 1
fi

if [ -z "$GEMINI_KEY" ]; then
  echo "! No GEMINI_API_KEY in .env.local — the AI chat will be unavailable in production."
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

# Stored on the project so future dashboard redeploys keep working. This is
# best-effort: it fails when the variable already exists, which is fine. The
# --build-env flags below are what actually guarantee this build gets them.
push_env() {
  local name="$1" value="$2" env
  for env in production preview development; do
    if printf '%s' "$value" | $VERCEL env add "$name" "$env" 2>&1 | tail -1; then :; fi
  done
}

echo "→ Storing env vars on the project…"
push_env NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL"
push_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_KEY"
[ -n "$GEMINI_KEY" ] && push_env GEMINI_API_KEY "$GEMINI_KEY"

echo "→ Env vars currently on the project:"
$VERCEL env ls 2>&1 | sed 's/^/    /' || true

# ----------------------------------------------------------------- deploy --

# Next.js inlines NEXT_PUBLIC_* at build time, so the values must be present
# during the build itself. Passing them as --build-env makes this deploy work
# even if the `env add` calls above were rejected.
echo "→ Building and deploying to production (about a minute)…"
BUILD_ENV=(
  --build-env "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
  --build-env "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY"
)
# GEMINI_API_KEY is read at request time, not build time, so it only needs to be
# stored on the project — but passing it here too keeps the two paths identical.
[ -n "$GEMINI_KEY" ] && BUILD_ENV+=(--build-env "GEMINI_API_KEY=$GEMINI_KEY")

$VERCEL deploy --prod --yes "${BUILD_ENV[@]}"

# ------------------------------------------------------------------ check --

echo "→ Verifying the live site…"
sleep 3
if curl -fsS https://5star-iota.vercel.app | grep -qi "setup required"; then
  echo
  echo "✗ The live site still says 'Setup required' — the build did not see the"
  echo "  Supabase variables. Send this output to Claude and it can read the"
  echo "  Vercel build logs directly."
  exit 1
fi

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
