# 5 Star — Data Model

Source of truth is `supabase/migrations/0001_init.sql`. This file explains *why* the tables
are shaped the way they are.

```
auth.users
   └── profiles              1:1  timezone, freezes, onboarded_at
   └── seasons               1:N  one row is_current per user
         └── user_pillars    1:N  slot 1–10, unique per season (5 is the default)
               ├── micro_actions   tappable presets, per pillar
               ├── daily_logs      one row per (pillar, date), 1–5 stars
               └── action_logs     one row per (action, date)
   ├── xp_events             append-only ledger, unique (user_id, dedupe_key)
   ├── user_badges           unique (user_id, badge_key)
   ├── quests                unique (user_id, week_start, kind)
   └── weekly_reports        unique (user_id, week_start), cached payload + narrative
```

## Decisions worth knowing

**Seasons, not a settings screen.** Pillar choices belong to a season. Re-picking closes the
current season (`is_current = false`, `ended_on` set) and opens a new one, so a chart of last
March still knows which pillars were being scored then. A partial unique index enforces
exactly one current season per user.

**Adding a pillar is not re-picking.** `addPillar` appends to the season already running, at
the next unused slot, keeping every streak and XP total. `archivePillar` flips `is_active`
rather than deleting, so a retired pillar's logs stay in the history. Slots are never reused
inside a season, which is why the next slot is `max(slot) + 1` and not `count + 1`.

**`daily_logs` has no zero.** `stars` is constrained to 1–5; "not logged" is the *absence* of
a row. This keeps a bad day and an unlogged day distinguishable, which every streak, mean and
balance calculation depends on.

**XP is a ledger, not a counter.** `xp_events` is append-only with a `dedupe_key` such as
`log:<pillar>:<date>` or `fsd:<date>`. Re-rating a day upserts on that key, so corrections
adjust the ledger instead of paying out twice, and any total can be recomputed from scratch.

**Dates are `date`, not `timestamptz`.** A check-in belongs to the user's local calendar day.
Storing an instant would make "today" flip at the wrong hour for anyone outside UTC.

**RLS on every table.** Each policy is `auth.uid() = user_id`, wrapped as `(select auth.uid())`
so Postgres evaluates it once per query rather than once per row. `profiles` keys on `id`
instead of `user_id`; the loop at the bottom of the migration generates the rest.

**Cascades everywhere.** Deleting an auth user removes every row they own; deleting a pillar
removes its logs, actions and XP. There is no soft-delete to reason about.
