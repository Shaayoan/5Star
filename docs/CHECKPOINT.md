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
| 17 | Deploy to Vercel | BLOCKED | see below |

## Live environment

- **Project**: `Shaayoan's Project` — ref `mxzvtrpaukvpmarrzqqr`, region `ap-southeast-1`.
- Credentials are in `.env.local` (gitignored). `.env.example` shows the shape.
- Migrations `0001`–`0003` are applied. Add new numbered files; never edit an applied one.
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

## Phase 17 — deploying (blocked on a Vercel permission)

The Vercel MCP connection can read projects but **cannot create one**:

```
403 forbidden — "You don't have permission to create a project."
```

Tried on both the team scope (`team_b8Cc7ydWfftlFFUq3Si7ugYP`, hobby plan) and the personal
scope; identical error. The only existing project is `aribid-itc`, which belongs to a
different app — deploying into it would replace that app's production deployment, so it was
left alone.

**To unblock, either:**

- **A — create the project first.** Make an empty Vercel project named `5-star`. Once it
  exists, `deploy_to_vercel` should succeed, since only *creation* is forbidden.
- **B — deploy from the CLI.** `npx vercel link` → `npx vercel env add …` → `npx vercel --prod`.
  Full commands in the README's Deploying section.
- **C — re-authorize the Vercel connector** with project-creation permission, then retry.

After the first successful deploy, set Supabase → **Authentication → URL Configuration** →
**Site URL** to the deployed origin and add `https://<domain>/auth/callback` to
**Redirect URLs**, or every emailed link bounces back to localhost.

## Resume notes

- **Env**: copy `.env.example` → `.env.local`. Without Supabase env vars the app renders a
  "Setup required" screen instead of crashing (`src/lib/supabase/env.ts`).
- **Schema changes**: add a new numbered file in `supabase/migrations/`, never edit `0001_init.sql`.
- **Formulas** live in one place: `src/lib/game/`. They are pure functions with no imports from
  Next/Supabase, so they can be unit-tested or reused by a future mobile client.
- **Next step (phase 14)**: create a Supabase project, run the migration, set env vars, `vercel deploy`.
