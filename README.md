# 5 Star

A gamified life-balance tracker. Pick the five pillars you actually care about, rate them
daily, and get an honest weekly report on which one you have been neglecting.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, hand-rolled primitives in `src/components/ui` |
| Charts | Recharts (radar, bars) + hand-built SVG (life tree, heatmap) |
| Backend | Supabase — Postgres, Auth, Row Level Security |
| Hosting | Vercel |

## Getting started

```bash
npm install
npm run dev
```

The Supabase project is already provisioned and its credentials are in `.env.local`
(gitignored). On a fresh clone, copy `.env.example` to `.env.local` and fill it in — without
env vars the app boots to a "Setup required" screen rather than crashing.

### Supabase

The schema in `supabase/migrations/` is applied to project `mxzvtrpaukvpmarrzqqr`
(ap-southeast-1). To point at a different project:

1. Create a project at [supabase.com](https://supabase.com).
2. Run every file in `supabase/migrations/` in order, in the **SQL Editor**.
3. Copy **Project Settings → API → Project URL** and the **publishable key** into `.env.local`.

**Email confirmation is on**, so a new signup must click a link before it gets a session. For
a faster development loop turn off **Authentication → Sign In / Providers → Email → Confirm
email**. Leave it on in production.

In production also set **Authentication → URL Configuration → Site URL** to your deployed
origin and add `/auth/callback` to the redirect allowlist, or emailed links bounce to
localhost.

## Accounts

- Email + password, magic link, and password reset all work; `/auth/callback` handles both the
  PKCE `code` and `token_hash` email-link styles and routes recovery links to `/auth/reset`.
- A `profiles` row is created by an `auth.users` trigger, with `ensureProfileRow` as a safety
  net for accounts that predate it.
- The browser's IANA timezone is captured at signup and synced once per session; it decides
  when a user's day rolls over. Display name and timezone are editable at `/settings`.

## How it works

- **Seasons** — a set of pillar choices. Re-picking pillars closes the season and opens a
  new one, so old stats stay attached to the period they were earned in.
- **Five by default, up to ten** — five is the floor and the shape of the app, but you can add
  a sixth or seventh mid-season from `/pillars` without losing any history. The life tree
  grows a new branch, and the radar, heatmap and daily totals all scale with the count.
- **Daily check-in** — one to five stars per pillar, plus tappable micro-actions and an
  optional note. Re-rating a day corrects the XP ledger instead of paying out twice.
- **XP and levels** — an append-only `xp_events` ledger with a `dedupe_key`, so every total is
  recomputable and every award is idempotent.
- **Weekly report** — radar chart, balance score, per-pillar deltas, best and hardest day, a
  30-day heatmap, and a written verdict.
- **Quests** — every Monday the app targets the weakest pillar with a hittable goal.
- **Badges** — fourteen of them, evaluated after every write.

Every formula is specified in [`docs/FORMULAS.md`](docs/FORMULAS.md) and implemented as pure
functions in `src/lib/game/` — no Next or Supabase imports, so a future mobile client can
share them verbatim.

## Project layout

```
src/
  app/            routes: landing, login, auth, onboarding, dashboard, report,
                  pillars, badges, settings
  components/     UI primitives, charts, life tree, check-in
  lib/
    game/         pure scoring engine (XP, levels, ranks, streaks, balance, badges, quests)
    queries.ts    read layer — one assembly point for the dashboard
    actions.ts    server actions (writes)
    engine.ts     post-write recompute: bonuses, streaks, quests, badges
supabase/
  migrations/     SQL schema + RLS
docs/
  CHECKPOINT.md   build phases — read this first when resuming work
  FORMULAS.md     the spec every number satisfies
```

## Deploying

Vercel CLI, from the project root. The first run prompts you to log in and link a project.

```bash
npx vercel link
```

Push the two public env vars into the linked project (values are in `.env.local`):

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
```

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

Then ship it:

```bash
npx vercel --prod
```

Both variables are `NEXT_PUBLIC_*` — they are compiled into the browser bundle by design. The
Supabase publishable key is meant to be public; Row Level Security is what protects the data,
not the key.

### After the first deploy

In Supabase → **Authentication → URL Configuration**:

- set **Site URL** to the deployed origin, and
- add `https://<your-domain>/auth/callback` to **Redirect URLs**.

Without this, magic links and password-reset emails redirect back to `localhost:3000`.
