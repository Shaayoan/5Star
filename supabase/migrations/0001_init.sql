-- 5 Star — initial schema
-- Every table is owned by a user and protected by row level security; a user can
-- only ever see or write their own rows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  timezone          text        not null default 'UTC',
  onboarded_at      timestamptz,
  freezes_available smallint    not null default 0 check (freezes_available between 0 and 2),
  freeze_granted_on date,
  created_at        timestamptz not null default now()
);

-- Mirror every new auth user into profiles so the app never has to branch on
-- "profile might not exist yet".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------- seasons --

-- A season is a run of pillar choices. Re-picking pillars closes the current
-- season and opens a new one, so historical stats stay attributable.
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  started_on date not null default current_date,
  ended_on   date,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index seasons_one_current_per_user
  on public.seasons (user_id) where is_current;

create index seasons_user_idx on public.seasons (user_id, started_on desc);

-- ------------------------------------------------------------ user_pillars --

create table public.user_pillars (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  season_id    uuid not null references public.seasons (id) on delete cascade,
  slot         smallint not null check (slot between 1 and 5),
  template_key text,
  name         text not null,
  icon         text not null default '⭐',
  color        text not null default '#f59e0b',
  definition   text not null default '',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (season_id, slot)
);

create index user_pillars_user_idx on public.user_pillars (user_id, is_active);

-- ----------------------------------------------------------- micro_actions --

create table public.micro_actions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  user_pillar_id uuid not null references public.user_pillars (id) on delete cascade,
  label          text not null,
  xp_value       smallint not null default 5 check (xp_value between 1 and 25),
  sort_order     smallint not null default 0,
  is_archived    boolean not null default false
);

create index micro_actions_pillar_idx on public.micro_actions (user_pillar_id, is_archived);

-- -------------------------------------------------------------- daily_logs --

create table public.daily_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  user_pillar_id uuid not null references public.user_pillars (id) on delete cascade,
  log_date       date not null,
  stars          smallint not null check (stars between 1 and 5),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_pillar_id, log_date)
);

create index daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_logs_touch
  before update on public.daily_logs
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- action_logs --

create table public.action_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  micro_action_id uuid not null references public.micro_actions (id) on delete cascade,
  user_pillar_id  uuid not null references public.user_pillars (id) on delete cascade,
  log_date        date not null,
  created_at      timestamptz not null default now(),
  unique (micro_action_id, log_date)
);

create index action_logs_user_date_idx on public.action_logs (user_id, log_date desc);

-- --------------------------------------------------------------- xp_events --

-- Append-only ledger. `dedupe_key` makes every award idempotent, so re-rating a
-- day corrects the existing row instead of stacking a second payout.
create table public.xp_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  user_pillar_id uuid references public.user_pillars (id) on delete cascade,
  source         text not null,
  amount         integer not null,
  log_date       date not null default current_date,
  dedupe_key     text not null,
  created_at     timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index xp_events_user_pillar_idx on public.xp_events (user_id, user_pillar_id);

-- ------------------------------------------------------------- user_badges --

create table public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  badge_key  text not null,
  earned_at  timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index user_badges_user_idx on public.user_badges (user_id);

-- ------------------------------------------------------------------ quests --

create table public.quests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  user_pillar_id uuid references public.user_pillars (id) on delete cascade,
  week_start     date not null,
  kind           text not null check (kind in ('focus', 'balance')),
  title          text not null,
  description    text not null,
  target_count   smallint not null,
  progress       smallint not null default 0,
  status         text not null default 'active' check (status in ('active', 'completed', 'expired')),
  xp_reward      integer not null default 150,
  created_at     timestamptz not null default now(),
  unique (user_id, week_start, kind)
);

create index quests_user_week_idx on public.quests (user_id, week_start desc);

-- ---------------------------------------------------------- weekly_reports --

create table public.weekly_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  week_end   date not null,
  payload    jsonb not null,
  narrative  text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ----------------------------------------------------------------- security --

alter table public.profiles       enable row level security;
alter table public.seasons        enable row level security;
alter table public.user_pillars   enable row level security;
alter table public.micro_actions  enable row level security;
alter table public.daily_logs     enable row level security;
alter table public.action_logs    enable row level security;
alter table public.xp_events      enable row level security;
alter table public.user_badges    enable row level security;
alter table public.quests         enable row level security;
alter table public.weekly_reports enable row level security;

create policy "profiles_owner" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array[
    'seasons', 'user_pillars', 'micro_actions', 'daily_logs',
    'action_logs', 'xp_events', 'user_badges', 'quests', 'weekly_reports'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || '_owner', t
    );
  end loop;
end;
$$;
