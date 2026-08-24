#!/usr/bin/env bash
# One-step deploy to Vercel.
#
#   bash scripts/deploy.sh
#
# Links the project, pushes the two public Supabase vars, and ships to
# production. Safe to re-run: linking and env vars are skipped once they exist,
# so later runs are just a redeploy.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "✗ .env.local is missing — copy .env.example and fill it in first." >&2
  exit 1
fi

# Read the values without sourcing the file, so odd characters cannot execute.
get_env() {
  grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '\r'
}

SUPABASE_URL="$(get_env NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_KEY="$(get_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "✗ .env.local is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY." >&2
  exit 1
fi

VERCEL="npx --yes vercel@latest"

# The local folder is "5star2" but the Vercel project is "5star", so the project
# has to be named explicitly — otherwise `link --yes` would create a second one.
PROJECT="${VERCEL_PROJECT:-5star}"

echo "→ Linking to Vercel project '$PROJECT' (opens a browser on first run)…"
$VERCEL link --yes --project "$PROJECT"

# `vercel env add` fails if the variable already exists; that is fine on re-runs.
push_env() {
  local name="$1" value="$2"
  if printf '%s' "$value" | $VERCEL env add "$name" production >/dev/null 2>&1; then
    echo "→ Set $name"
  else
    echo "→ $name already set, leaving it alone"
  fi
}

push_env NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL"
push_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_KEY"

echo "→ Building and deploying to production…"
$VERCEL deploy --prod --yes

cat <<'DONE'

✓ Deployed — https://5star-iota.vercel.app

One thing left, in Supabase → Authentication → URL Configuration:
  • Site URL      → https://5star-iota.vercel.app
  • Redirect URLs → https://5star-iota.vercel.app/auth/callback
                    https://5star-*-shaayoanm-9717s-projects.vercel.app/auth/callback

The second entry covers preview deployments. Without these, magic links and
password-reset emails bounce back to localhost.
DONE
