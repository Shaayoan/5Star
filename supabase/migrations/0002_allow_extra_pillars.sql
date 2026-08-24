-- Five pillars stay the default, but a season may now run up to ten so a user
-- can add a sixth or seventh without abandoning the season they are in.

alter table public.user_pillars drop constraint user_pillars_slot_check;
alter table public.user_pillars add constraint user_pillars_slot_check
  check (slot between 1 and 10);
