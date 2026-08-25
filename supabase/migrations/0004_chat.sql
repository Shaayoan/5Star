-- v2: conversational logging.

-- A pillar can be excluded from the chat entirely. Financial and Relational are
-- where people are least comfortable narrating their day to a model, so opting
-- out has to be per pillar, not all-or-nothing.
alter table public.user_pillars
  add column chat_enabled boolean not null default true;

-- One conversation per day, so re-opening the chat continues where it left off
-- rather than starting cold.
create table public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index chat_sessions_user_idx on public.chat_sessions (user_id, log_date desc);

create trigger chat_sessions_touch
  before update on public.chat_sessions
  for each row execute function public.touch_updated_at();

alter table public.chat_sessions enable row level security;

create policy "chat_sessions_owner" on public.chat_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.chat_sessions from anon;
