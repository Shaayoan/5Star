# 5 Star — Build Checkpoints

> Credit-saving protocol: each phase is self-contained. To resume in a fresh session,
> read this file only, find the first phase not marked `DONE`, and continue from there.
> Do **not** re-read the whole codebase — the "Files" column tells you what already exists.

Legend: `DONE` = shipped & compiles · `WIP` = in progress · `TODO` = not started

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 0 | Project scaffold (Next 16 + TS + Tailwind 4 + deps) | DONE | `package.json`, `src/app/*` |
| 1 | Design docs: formulas, schema notes | DONE | `docs/FORMULAS.md`, `docs/SCHEMA.md` |
| 2 | Pure game engine (XP, levels, ranks, streaks, balance, badges, quests) | DONE | `src/lib/game/*` |
| 3 | Pillar catalog + shared types | DONE | `src/lib/catalog.ts`, `src/lib/types.ts` |
| 4 | Database migration + RLS + seed | DONE | `supabase/migrations/0001_init.sql` |
| 5 | Supabase clients, middleware, auth routes | DONE | `src/lib/supabase/*`, `src/middleware.ts`, `src/app/auth/*` |
| 6 | Design system / UI primitives | DONE | `src/app/globals.css`, `src/components/ui/*` |
| 7 | Feature components (stars, radar, trend, tree, badges, quests) | DONE | `src/components/*` |
| 8 | Data access layer (queries + mutations) | DONE | `src/lib/queries.ts`, `src/lib/actions.ts` |
| 9 | Pages: landing, login, onboarding | DONE | `src/app/page.tsx`, `src/app/login/*`, `src/app/onboarding/*` |
| 10 | Pages: dashboard / daily check-in | DONE | `src/app/dashboard/*` |
| 11 | Pages: weekly report | DONE | `src/app/report/*` |
| 12 | Pages: pillars manager, badges, seasons | DONE | `src/app/pillars/*`, `src/app/badges/*` |
| 13 | Build green + lint clean + landing/login verified in browser | DONE | — |
| 14 | Supabase wired up: schema applied, RLS hardened, auth verified live | DONE | `.env.local`, `supabase/migrations/*` |
| 15 | Accounts: signup/signin/magic link/reset, profile + timezone persistence | DONE | `src/app/login/*`, `src/app/auth/*`, `src/app/settings/*` |
| 16 | Pillars beyond five: add mid-season, retire, tree grows a branch | DONE | `supabase/migrations/0002_*`, `src/components/LifeTree.tsx` |
| 17 | Deploy to Vercel | DONE | live at https://5star-iota.vercel.app |
| 18 | Connect production env vars + Supabase auth URLs | TODO | `scripts/deploy.sh` |
| 19 | v2 conversational logging, on Gemini | DONE | `src/lib/ai/*`, `src/app/chat/*`, `supabase/migrations/0004_chat.sql` |
| 20 | Calendar with click-to-backfill | DONE | `src/app/calendar/*`, `src/components/DayRing.tsx` |
| 21 | Trend chart on the report | DONE | `src/lib/game/series.ts`, `src/components/TrendChart.tsx` |

## Live environment

- **Project**: `Shaayoan's Project` — ref `mxzvtrpaukvpmarrzqqr`, region `ap-southeast-1`.
- Credentials are in `.env.local` (gitignored). `.env.example` shows the shape.
- Migrations `0001`–`0004` are applied. Add new numbered files; never edit an applied one.
- **AI**: `GEMINI_API_KEY` drives the chat and the deeper weekly review. Model names go stale
  fast — both are overridable via `GEMINI_CHAT_MODEL` / `GEMINI_NARRATIVE_MODEL`. As of the
  last check `gemini-2.5-flash` and `gemini-2.5-pro` are both retired for new keys, and Pro
  returns 429 on the free tier, so both jobs default to `gemini-3.6-flash`.
- A throwaway account (`verify@fivestar.test`) was created during testing and holds some
  sample logs. Its password is not recorded here on purpose. Remove it with:
  `delete from auth.users where email = 'verify@fivestar.test';` (cascades to all its data).

### Remaining advisor warnings, and why

- *Tables visible in the GraphQL schema to `authenticated`* — inherent to any RLS-protected
  table the app reads. Rows are still filtered by `auth.uid()`; only schema shape is
  discoverable. Not actionable without breaking the app.
- *`public.rls_auto_enable()` is anon-executable* — pre-existing in this project, not part of
  5 Star. Left alone deliberately.
- *Leaked password protection disabled* — worth turning on at
  **Authentication → Policies**; it checks new passwords against HaveIBeenPwned. Dashboard
  setting, not automatable from here.

### One dashboard setting is not automatable

`mailer_autoconfirm` is **false**, so a new signup must click a confirmation email before it
gets a session. To make signup instant:
**Authentication → Sign In / Providers → Email → turn off "Confirm email"**.

This cannot be done from here — the Supabase MCP exposes no auth-config tool (only database,
migrations, advisors, branches and edge functions), and no browser session with the Supabase
dashboard is available. Verify the change afterwards with:

```
GET https://mxzvtrpaukvpmarrzqqr.supabase.co/auth/v1/settings
```

`mailer_autoconfirm: true` means signup now logs straight in.

## Production

| | |
|---|---|
| Vercel project | `5star` (`prj_GhXYXOjLjVLAdjoHTHHXxyiYw43z`), team `shaayoanm-9717s-projects` |
| Production URL | https://5star-iota.vercel.app |
| Deployed from | a drag-and-drop upload of the local `5star2` folder, not git |

**The local folder (`5star2`) and the Vercel project (`5star`) have different names**, so any
CLI command must name the project explicitly or it will create a second project:
`vercel link --yes --project 5star`. `scripts/deploy.sh` already does this.

## Phase 18 — connecting production

The first deploy went up without environment variables, so the live site renders the
"Setup required" screen. Fix with one command:

```
bash scripts/deploy.sh
```

That links to the existing `5star` project, pushes `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`, and redeploys.

Then, in Supabase → **Authentication → URL Configuration**:

- **Site URL** → `https://5star-iota.vercel.app`
- **Redirect URLs** → `https://5star-iota.vercel.app/auth/callback`
  and `https://5star-*-shaayoanm-9717s-projects.vercel.app/auth/callback` for previews

Neither Vercel env vars nor Supabase auth URLs are reachable from the MCP tools available
here — the Vercel MCP has no env-var tool and the Supabase MCP has no auth-config tool.

## Resume notes

- **Env**: copy `.env.example` → `.env.local`. Without Supabase env vars the app renders a
  "Setup required" screen instead of crashing (`src/lib/supabase/env.ts`).
- **Schema changes**: add a new numbered file in `supabase/migrations/`, never edit `0001_init.sql`.
- **Formulas** live in one place: `src/lib/game/`. They are pure functions with no imports from
  Next/Supabase, so they can be unit-tested or reused by a future mobile client.
- **Next step (phase 18)**: run `bash scripts/deploy.sh` to push env vars to Vercel, then set
  the Supabase auth URLs. Add `GEMINI_API_KEY` to Vercel too, or the chat is unavailable in
  production while still working locally.
- **Known debt**: the write path still lives in Next server actions, so a future mobile client
  cannot reuse it. Moving `commitProposals` / `setStars` / `recompute` into a Supabase Edge
  Function is the prerequisite for the iPhone app.
