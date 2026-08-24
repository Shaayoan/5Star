-- Nothing in 5 Star is readable before signing in. RLS already blocks the rows;
-- revoking also removes the tables from the anon GraphQL schema.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'seasons', 'user_pillars', 'micro_actions', 'daily_logs',
    'action_logs', 'xp_events', 'user_badges', 'quests', 'weekly_reports'
  ]
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- Trigger helpers are never meant to be called over REST. Revoking from `anon`
-- alone leaves the implicit PUBLIC grant in place, which is what actually
-- exposes them at /rest/v1/rpc/.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
