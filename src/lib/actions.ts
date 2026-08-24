'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from './auth';
import { addDays, seasonLabel, today as todayIso, weekStart } from './dates';
import {
  ensureProfileRow,
  ensureWeeklyQuests,
  grantActionXp,
  grantLogXp,
  recompute,
  revokeActionXp,
  revokeLogXp,
  type RecomputeResult,
} from './engine';
import { summarise, buildNarrative, narrativeToText } from './game';
import { MAX_PILLARS, MIN_PILLARS } from './game/constants';
import { getActivePillars, getCurrentSeason, getEntries, type DB } from './queries';
import type { IsoDate, Quest, StarRating } from './types';

/* --------------------------------------------------------------- profile -- */

export interface ProfilePatch {
  display_name?: string | null;
  timezone?: string;
}

/**
 * Client-callable wrapper around `ensureProfileRow`. Only revalidates when
 * something actually changed, so the common no-op case costs one query.
 */
export async function ensureProfile(patch: ProfilePatch = {}) {
  const { db, user } = await requireUser();
  const changed = await ensureProfileRow(db, user, patch);
  if (changed) revalidatePath('/settings');
}

/** Explicit save from the settings page. */
export async function updateProfile(patch: ProfilePatch) {
  const { db, user } = await requireUser();

  const clean: ProfilePatch = {};
  if (patch.display_name !== undefined) {
    clean.display_name = patch.display_name?.trim().slice(0, 60) || null;
  }
  if (patch.timezone) clean.timezone = patch.timezone.slice(0, 60);

  const { error } = await db.from('profiles').update(clean).eq('id', user.id);
  if (error) throw new Error(error.message);

  // Keep the auth metadata in step so a fresh profile row can be rebuilt from it.
  if (clean.display_name !== undefined) {
    await db.auth.updateUser({ data: { full_name: clean.display_name } });
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
}

export interface PillarPick {
  templateKey: string | null;
  name: string;
  icon: string;
  color: string;
  definition: string;
  actions: { label: string; xp: number }[];
}

/* ------------------------------------------------------------ onboarding -- */

async function createSeasonWithPillars(db: DB, userId: string, picks: PillarPick[]) {
  await db
    .from('seasons')
    .update({ is_current: false, ended_on: addDays(todayIso(), -1) })
    .eq('user_id', userId)
    .eq('is_current', true);

  const { data: season, error } = await db
    .from('seasons')
    .insert({ user_id: userId, name: seasonLabel(), is_current: true })
    .select()
    .single();

  if (error || !season) throw new Error(error?.message ?? 'Could not start a season');

  await db.from('user_pillars').update({ is_active: false }).eq('user_id', userId);

  const { data: pillars, error: pillarError } = await db
    .from('user_pillars')
    .insert(
      picks.map((p, i) => ({
        user_id: userId,
        season_id: season.id,
        slot: i + 1,
        template_key: p.templateKey,
        name: p.name,
        icon: p.icon,
        color: p.color,
        definition: p.definition,
        is_active: true,
      })),
    )
    .select();

  if (pillarError || !pillars) throw new Error(pillarError?.message ?? 'Could not save pillars');

  const actions = pillars.flatMap((pillar, i) =>
    (picks[i]?.actions ?? []).map((a, order) => ({
      user_id: userId,
      user_pillar_id: pillar.id,
      label: a.label,
      xp_value: a.xp,
      sort_order: order,
    })),
  );
  if (actions.length) await db.from('micro_actions').insert(actions);

  return { season, pillars };
}

function assertPickCount(picks: PillarPick[]) {
  if (picks.length < MIN_PILLARS || picks.length > MAX_PILLARS) {
    throw new Error(`Pick between ${MIN_PILLARS} and ${MAX_PILLARS} pillars`);
  }
}

export async function completeOnboarding(picks: PillarPick[]) {
  const { db, user } = await requireUser();
  assertPickCount(picks);

  await createSeasonWithPillars(db, user.id, picks);
  await db.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id);

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/** Re-picking pillars closes the current season and opens a fresh one, so the
 *  old numbers stay attached to the period they were earned in. */
export async function startNewSeason(picks: PillarPick[]) {
  const { db, user } = await requireUser();
  assertPickCount(picks);

  await createSeasonWithPillars(db, user.id, picks);
  revalidatePath('/dashboard');
  revalidatePath('/pillars');
  redirect('/dashboard');
}

/**
 * Adds one pillar to the season already in progress, so a user can grow past
 * five without throwing away the history they have built. The new pillar starts
 * at level 1 with no logs — it joins the tree as a fresh branch.
 */
export async function addPillar(pick: PillarPick) {
  const { db, user } = await requireUser();

  const season = await getCurrentSeason(db, user.id);
  if (!season) throw new Error('No season in progress');

  const existing = await getActivePillars(db, user.id);
  if (existing.length >= MAX_PILLARS) {
    throw new Error(`A season tops out at ${MAX_PILLARS} pillars`);
  }

  // Slots are unique per season and archived pillars still hold theirs, so take
  // the next number above everything the season has ever used.
  const { data: used } = await db
    .from('user_pillars')
    .select('slot')
    .eq('season_id', season.id)
    .order('slot', { ascending: false })
    .limit(1);

  const slot = ((used?.[0]?.slot as number | undefined) ?? 0) + 1;

  const { data: pillar, error } = await db
    .from('user_pillars')
    .insert({
      user_id: user.id,
      season_id: season.id,
      slot,
      template_key: pick.templateKey,
      name: pick.name.trim().slice(0, 40) || 'Pillar',
      icon: pick.icon,
      color: pick.color,
      definition: pick.definition.trim().slice(0, 160),
      is_active: true,
    })
    .select()
    .single();

  if (error || !pillar) throw new Error(error?.message ?? 'Could not add that pillar');

  if (pick.actions.length > 0) {
    await db.from('micro_actions').insert(
      pick.actions.map((a, order) => ({
        user_id: user.id,
        user_pillar_id: pillar.id,
        label: a.label,
        xp_value: a.xp,
        sort_order: order,
      })),
    );
  }

  revalidatePath('/dashboard');
  revalidatePath('/pillars');
  revalidatePath('/report');
}

/** Retires a pillar without deleting its history. */
export async function archivePillar(pillarId: string) {
  const { db, user } = await requireUser();

  const active = await getActivePillars(db, user.id);
  if (active.length <= MIN_PILLARS) {
    throw new Error(`A season needs at least ${MIN_PILLARS} pillars`);
  }

  await db
    .from('user_pillars')
    .update({ is_active: false })
    .eq('id', pillarId)
    .eq('user_id', user.id);

  revalidatePath('/dashboard');
  revalidatePath('/pillars');
  revalidatePath('/report');
}

/* ------------------------------------------------------------- daily log -- */

export async function setStars(
  pillarId: string,
  date: IsoDate,
  stars: StarRating,
  note?: string | null,
): Promise<RecomputeResult> {
  const { db, user } = await requireUser();
  const pillars = await getActivePillars(db, user.id);
  if (!pillars.some((p) => p.id === pillarId)) throw new Error('Unknown pillar');

  if (stars === 0) {
    await db
      .from('daily_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('user_pillar_id', pillarId)
      .eq('log_date', date);
    await revokeLogXp(db, user.id, pillarId, date);
  } else {
    await db.from('daily_logs').upsert(
      {
        user_id: user.id,
        user_pillar_id: pillarId,
        log_date: date,
        stars,
        ...(note !== undefined ? { note } : {}),
      },
      { onConflict: 'user_pillar_id,log_date' },
    );
    await grantLogXp(db, user.id, pillarId, date, stars);
  }

  const result = await recompute(db, user.id, pillars, date);
  revalidatePath('/dashboard');
  return result;
}

export async function setNote(pillarId: string, date: IsoDate, note: string) {
  const { db, user } = await requireUser();
  await db
    .from('daily_logs')
    .update({ note: note.trim() || null })
    .eq('user_id', user.id)
    .eq('user_pillar_id', pillarId)
    .eq('log_date', date);
  revalidatePath('/dashboard');
}

export async function toggleMicroAction(actionId: string, date: IsoDate) {
  const { db, user } = await requireUser();

  const { data: action } = await db
    .from('micro_actions')
    .select('id, user_pillar_id, xp_value')
    .eq('id', actionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!action) throw new Error('Unknown action');

  const { data: existing } = await db
    .from('action_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('micro_action_id', actionId)
    .eq('log_date', date)
    .maybeSingle();

  if (existing) {
    await db.from('action_logs').delete().eq('id', existing.id);
    await revokeActionXp(db, user.id, actionId, date);
  } else {
    await db.from('action_logs').insert({
      user_id: user.id,
      micro_action_id: actionId,
      user_pillar_id: action.user_pillar_id,
      log_date: date,
    });
    await grantActionXp(db, user.id, action.user_pillar_id, actionId, date, action.xp_value);
  }

  revalidatePath('/dashboard');
  return !existing;
}

/* ---------------------------------------------------------- pillar admin -- */

export async function updatePillar(
  pillarId: string,
  patch: { name?: string; icon?: string; color?: string; definition?: string },
) {
  const { db, user } = await requireUser();
  await db.from('user_pillars').update(patch).eq('id', pillarId).eq('user_id', user.id);
  revalidatePath('/pillars');
  revalidatePath('/dashboard');
}

export async function addMicroAction(pillarId: string, label: string, xp: number) {
  const { db, user } = await requireUser();
  const clean = label.trim();
  if (!clean) return;

  const { count } = await db
    .from('micro_actions')
    .select('id', { count: 'exact', head: true })
    .eq('user_pillar_id', pillarId);

  await db.from('micro_actions').insert({
    user_id: user.id,
    user_pillar_id: pillarId,
    label: clean.slice(0, 60),
    xp_value: Math.min(25, Math.max(1, Math.round(xp))),
    sort_order: count ?? 0,
  });
  revalidatePath('/pillars');
  revalidatePath('/dashboard');
}

export async function deleteMicroAction(actionId: string) {
  const { db, user } = await requireUser();
  await db
    .from('micro_actions')
    .update({ is_archived: true })
    .eq('id', actionId)
    .eq('user_id', user.id);
  revalidatePath('/pillars');
  revalidatePath('/dashboard');
}

/* --------------------------------------------------------------- quests -- */

/** Client-callable wrapper. Page renders should call `ensureWeeklyQuests`
 *  directly — it does the same work without revalidating. */
export async function ensureQuests(): Promise<Quest[]> {
  const { db, user } = await requireUser();
  const quests = await ensureWeeklyQuests(db, user.id);
  revalidatePath('/dashboard');
  return quests;
}

/* --------------------------------------------------------------- report -- */

/** Builds (and caches) the weekly report for the week containing `date`. */
export async function generateReport(date: IsoDate = todayIso()) {
  const { db, user } = await requireUser();
  const start = weekStart(date);
  const end = addDays(start, 6);

  const pillars = await getActivePillars(db, user.id);
  const entries = await getEntries(db, user.id, addDays(start, -7), end);
  const week = summarise(
    entries.filter((e) => e.date >= start),
    pillars,
  );
  const previous = summarise(
    entries.filter((e) => e.date < start),
    pillars,
  );

  const { count: questsDone } = await db
    .from('quests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('week_start', start)
    .eq('status', 'completed');

  const narrative = buildNarrative({
    week,
    previous,
    pillars,
    checkInStreak: 0,
    questsCompleted: questsDone ?? 0,
    newBadges: [],
  });

  await db.from('weekly_reports').upsert(
    {
      user_id: user.id,
      week_start: start,
      week_end: end,
      payload: {
        means: week.means,
        counts: week.counts,
        overall: week.overall,
        balance: week.balance,
        loggedDays: week.loggedDays,
        fiveStarDays: week.fiveStarDays,
      },
      narrative: narrativeToText(narrative),
    },
    { onConflict: 'user_id,week_start' },
  );

  revalidatePath('/report');
  return { start, end };
}

/* ----------------------------------------------------------------- auth -- */

export async function signOut() {
  const { db } = await requireUser();
  await db.auth.signOut();
  redirect('/login');
}
