import 'server-only';
import type { User } from '@supabase/supabase-js';
import { addDays, today as todayIso, weekStart } from './dates';
import type { DB } from './queries';
import { getActivePillars, getEntries, getQuests } from './queries';
import type { IsoDate, Profile, Quest, UserPillar, XpSource } from './types';
import {
  BADGES_BY_KEY,
  DAYS_PER_FREEZE,
  generateQuests,
  FIVE_STAR_DAY_BONUS,
  MAX_FREEZES,
  PERFECT_DAY_BONUS,
  balanceScore,
  checkInStreak,
  evaluateBadges,
  isFiveStarDay,
  isPerfectDay,
  isQuestComplete,
  pillarLevel,
  pillarMean,
  questProgress,
  streakMilestoneXp,
} from './game';

/** Everything downstream of writing a log lives here: bonus XP, streak
 *  milestones, freezes, quest progress and badges. Called after every mutation
 *  so the numbers on screen are never stale.
 *
 *  Nothing in this module calls `revalidatePath` — these functions run during
 *  page render as well as from server actions, and revalidating mid-render is
 *  not allowed. The thin wrappers in `actions.ts` add revalidation where it is
 *  actually needed. */

const HISTORY = 90;

/* ------------------------------------------------------- profile bootstrap -- */

/**
 * Guarantees a profile row exists for this user. The `on_auth_user_created`
 * trigger normally handles it; this covers accounts created before the trigger
 * existed, and fills in a timezone once the browser reports one.
 */
export async function ensureProfileRow(
  db: DB,
  user: User,
  patch: { display_name?: string | null; timezone?: string } = {},
): Promise<boolean> {
  const { data: existing } = await db
    .from('profiles')
    .select('id, display_name, timezone')
    .eq('id', user.id)
    .maybeSingle<Pick<Profile, 'id' | 'display_name' | 'timezone'>>();

  const fallbackName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? null;

  if (!existing) {
    await db.from('profiles').insert({
      id: user.id,
      display_name: patch.display_name ?? fallbackName,
      timezone: patch.timezone ?? (user.user_metadata?.timezone as string | undefined) ?? 'UTC',
    });
    return true;
  }

  const update: { display_name?: string | null; timezone?: string } = {};
  if (patch.timezone && patch.timezone !== existing.timezone) update.timezone = patch.timezone;
  if (!existing.display_name && (patch.display_name ?? fallbackName)) {
    update.display_name = patch.display_name ?? fallbackName;
  }
  if (Object.keys(update).length === 0) return false;

  await db.from('profiles').update(update).eq('id', user.id);
  return true;
}

/* ---------------------------------------------------------- quest bootstrap -- */

/**
 * Creates this week's quests if they do not exist yet. Idempotent, and safe to
 * call from a page render.
 */
export async function ensureWeeklyQuests(
  db: DB,
  userId: string,
  anchor: IsoDate = todayIso(),
): Promise<Quest[]> {
  const week = weekStart(anchor);
  const existing = await getQuests(db, userId, week);
  if (existing.length > 0) return existing;

  const pillars = await getActivePillars(db, userId);
  if (pillars.length === 0) return [];

  const lastWeek = await getEntries(db, userId, addDays(week, -7), addDays(week, -1));
  const drafts = generateQuests(lastWeek, pillars);
  if (drafts.length === 0) return [];

  const { data } = await db
    .from('quests')
    .upsert(
      drafts.map((d) => ({ ...d, user_id: userId, week_start: week })),
      { onConflict: 'user_id,week_start,kind' },
    )
    .select();

  return (data ?? []) as Quest[];
}

interface XpRow {
  user_id: string;
  user_pillar_id: string | null;
  source: XpSource;
  amount: number;
  log_date: IsoDate;
  dedupe_key: string;
}

async function grantXp(db: DB, row: XpRow) {
  await db.from('xp_events').upsert(row, { onConflict: 'user_id,dedupe_key' });
}

async function revokeXp(db: DB, userId: string, dedupeKey: string) {
  await db.from('xp_events').delete().eq('user_id', userId).eq('dedupe_key', dedupeKey);
}

/** XP for a single pillar rating. Re-rating the same day corrects the ledger
 *  rather than paying out twice. */
export async function grantLogXp(
  db: DB,
  userId: string,
  pillarId: string,
  date: IsoDate,
  stars: number,
) {
  await grantXp(db, {
    user_id: userId,
    user_pillar_id: pillarId,
    source: 'daily_log',
    amount: stars * 10,
    log_date: date,
    dedupe_key: `log:${pillarId}:${date}`,
  });
}

export async function revokeLogXp(db: DB, userId: string, pillarId: string, date: IsoDate) {
  await revokeXp(db, userId, `log:${pillarId}:${date}`);
}

export async function grantActionXp(
  db: DB,
  userId: string,
  pillarId: string,
  actionId: string,
  date: IsoDate,
  xp: number,
) {
  await grantXp(db, {
    user_id: userId,
    user_pillar_id: pillarId,
    source: 'micro_action',
    amount: xp,
    log_date: date,
    dedupe_key: `action:${actionId}:${date}`,
  });
}

export async function revokeActionXp(db: DB, userId: string, actionId: string, date: IsoDate) {
  await revokeXp(db, userId, `action:${actionId}:${date}`);
}

export interface RecomputeResult {
  newBadges: string[];
  completedQuests: string[];
  fiveStarDay: boolean;
  perfectDay: boolean;
  checkInStreak: number;
}

export async function recompute(
  db: DB,
  userId: string,
  pillars: UserPillar[],
  date: IsoDate = todayIso(),
  /** The user's own calendar day, for streak maths. */
  anchor: IsoDate = todayIso(),
): Promise<RecomputeResult> {
  const ids = pillars.map((p) => p.id);
  const thisWeek = weekStart(anchor);

  // Every await here is a round trip to Singapore, so anything that does not
  // depend on another result runs together. Sequential awaits were what made a
  // single star tap feel slow.
  const [entries, profileResult, questsBefore] = await Promise.all([
    getEntries(db, userId, addDays(anchor, -(HISTORY - 1)), anchor),
    db
      .from('profiles')
      .select('freezes_available, freeze_granted_on')
      .eq('id', userId)
      .maybeSingle(),
    getQuests(db, userId, thisWeek),
  ]);

  const byDate = new Map(entries.map((e) => [e.date, e]));
  const dayEntry = byDate.get(date) ?? { date, ratings: {} };

  /* ---- day bonuses -------------------------------------------------- */

  const fiveStar = isFiveStarDay(dayEntry, ids);
  const perfect = isPerfectDay(dayEntry, ids);

  await Promise.all([
    fiveStar
      ? grantXp(db, {
          user_id: userId,
          user_pillar_id: null,
          source: 'five_star_day',
          amount: FIVE_STAR_DAY_BONUS,
          log_date: date,
          dedupe_key: `fsd:${date}`,
        })
      : revokeXp(db, userId, `fsd:${date}`),
    perfect
      ? grantXp(db, {
          user_id: userId,
          user_pillar_id: null,
          source: 'perfect_day',
          amount: PERFECT_DAY_BONUS,
          log_date: date,
          dedupe_key: `perfect:${date}`,
        })
      : revokeXp(db, userId, `perfect:${date}`),
  ]);

  /* ---- streak milestones and freezes --------------------------------- */

  const profileRow = profileResult.data;
  const freezesHeld = profileRow?.freezes_available ?? 0;
  const streak = checkInStreak(entries, ids, anchor, freezesHeld);

  const milestone = streakMilestoneXp(streak.current);
  const weekEntries = entries.filter((e) => e.date >= thisWeek);
  const completedQuests: string[] = [];

  // Streak payout, the freeze grant and every quest update are independent of
  // each other, so they all go out at once rather than one after another.
  // Supabase query builders are thenable but not real Promises.
  const writes: PromiseLike<unknown>[] = [];

  if (milestone > 0) {
    writes.push(
      grantXp(db, {
        user_id: userId,
        user_pillar_id: null,
        source: 'streak_milestone',
        amount: milestone,
        log_date: anchor,
        dedupe_key: `streak:${streak.current}`,
      }),
    );
  }

  // One freeze per full week of check-ins, granted at most once per day.
  if (
    streak.current > 0 &&
    streak.current % DAYS_PER_FREEZE === 0 &&
    freezesHeld < MAX_FREEZES &&
    profileRow?.freeze_granted_on !== anchor
  ) {
    writes.push(
      db
        .from('profiles')
        .update({ freezes_available: freezesHeld + 1, freeze_granted_on: anchor })
        .eq('id', userId),
    );
  }

  for (const quest of questsBefore) {
    const progress = questProgress(quest, weekEntries, ids);
    const done = isQuestComplete(progress, quest.target_count);
    if (progress === quest.progress && (!done || quest.status === 'completed')) continue;

    writes.push(
      db
        .from('quests')
        .update({ progress, status: done ? 'completed' : 'active' })
        .eq('id', quest.id),
    );

    if (done && quest.status !== 'completed') {
      completedQuests.push(quest.id);
      writes.push(
        grantXp(db, {
          user_id: userId,
          user_pillar_id: quest.user_pillar_id,
          source: 'quest',
          amount: quest.xp_reward,
          log_date: anchor,
          dedupe_key: `quest:${quest.id}`,
        }),
      );
    }
  }

  if (writes.length > 0) await Promise.all(writes);

  /* ---- badges -------------------------------------------------------- */

  const [{ data: badgeRows }, { count: logCount }, { count: questsDone }, { count: seasonsDone }, xpRes] =
    await Promise.all([
      db.from('user_badges').select('badge_key').eq('user_id', userId),
      db.from('daily_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      db
        .from('quests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed'),
      db
        .from('seasons')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_current', false),
      db.from('xp_events').select('user_pillar_id, amount').eq('user_id', userId),
    ]);

  const held = new Set(((badgeRows ?? []) as { badge_key: string }[]).map((r) => r.badge_key));

  const xpByPillar: Record<string, number> = {};
  for (const row of (xpRes.data ?? []) as { user_pillar_id: string | null; amount: number }[]) {
    if (row.user_pillar_id) {
      xpByPillar[row.user_pillar_id] = (xpByPillar[row.user_pillar_id] ?? 0) + row.amount;
    }
  }
  const maxPillarLevel = ids.length
    ? Math.max(...ids.map((id) => pillarLevel(xpByPillar[id] ?? 0).level))
    : 1;

  const weekWindow = entries.slice(-7);
  const newBadges = evaluateBadges({
    entries,
    pillars,
    weekEntries: weekWindow,
    weekBalance: balanceScore(ids.map((id) => pillarMean(weekWindow, id))),
    checkInStreak: streak.current,
    totalLogs: logCount ?? 0,
    maxPillarLevel,
    questsCompleted: questsDone ?? 0,
    seasonsCompleted: seasonsDone ?? 0,
    earned: held,
    anchor,
  });

  if (newBadges.length > 0) {
    // Both the badges and all of their XP go in as two batched upserts rather
    // than one round trip per badge.
    const xpRows = newBadges
      .map((key) => BADGES_BY_KEY[key])
      .filter(Boolean)
      .map((def) => ({
        user_id: userId,
        user_pillar_id: null,
        source: 'badge' as const,
        amount: def.xp,
        log_date: anchor,
        dedupe_key: `badge:${def.key}`,
      }));

    await Promise.all([
      db.from('user_badges').upsert(
        newBadges.map((key) => ({ user_id: userId, badge_key: key })),
        { onConflict: 'user_id,badge_key' },
      ),
      xpRows.length
        ? db.from('xp_events').upsert(xpRows, { onConflict: 'user_id,dedupe_key' })
        : Promise.resolve(),
    ]);
  }

  return {
    newBadges,
    completedQuests,
    fiveStarDay: fiveStar,
    perfectDay: perfect,
    checkInStreak: streak.current,
  };
}
