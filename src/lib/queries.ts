import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, lastNDays, today as todayIso, weekStart } from './dates';
import type {
  DayEntry,
  IsoDate,
  MicroAction,
  Profile,
  Quest,
  Season,
  StarRating,
  UserPillar,
} from './types';
import {
  ROLLING_WINDOW,
  WEEK_WINDOW,
  checkInStreak,
  humanLevel,
  overallMean,
  pillarLevel,
  pillarMean,
  pillarStreak,
  rankFor,
  starDayStreak,
  summarise,
  activeDayCount,
  trend,
  type WindowSummary,
} from './game';

export type DB = SupabaseClient;

/** How far back the dashboard reads. Enough for a 30-day rank window, a
 *  comeback check, and last week's comparison, in a single round trip. */
const HISTORY_DAYS = 90;

export async function getProfile(db: DB, userId: string): Promise<Profile | null> {
  const { data } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getCurrentSeason(db: DB, userId: string): Promise<Season | null> {
  const { data } = await db
    .from('seasons')
    .select('*')
    .eq('user_id', userId)
    .eq('is_current', true)
    .maybeSingle();
  return (data as Season) ?? null;
}

export async function getActivePillars(db: DB, userId: string): Promise<UserPillar[]> {
  const { data } = await db
    .from('user_pillars')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('slot');
  return (data as UserPillar[]) ?? [];
}

export async function getMicroActions(db: DB, userId: string): Promise<MicroAction[]> {
  const { data } = await db
    .from('micro_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('sort_order');
  return (data as MicroAction[]) ?? [];
}

/** Turn raw `daily_logs` rows into one `DayEntry` per calendar day. Days with no
 *  logs at all are still present, so streak maths sees the gaps. */
export async function getEntries(
  db: DB,
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<DayEntry[]> {
  const { data } = await db
    .from('daily_logs')
    .select('user_pillar_id, log_date, stars, note')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to);

  const byDate = new Map<IsoDate, DayEntry>();
  for (const row of (data ?? []) as {
    user_pillar_id: string;
    log_date: string;
    stars: number;
    note: string | null;
  }[]) {
    const entry = byDate.get(row.log_date) ?? { date: row.log_date, ratings: {}, notes: {} };
    entry.ratings[row.user_pillar_id] = row.stars as StarRating;
    entry.notes![row.user_pillar_id] = row.note;
    byDate.set(row.log_date, entry);
  }

  const out: DayEntry[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(byDate.get(d) ?? { date: d, ratings: {}, notes: {} });
  }
  return out;
}

/** One calendar day as the calendar page needs it: the ratings, plus whether
 *  anything was written in late. */
export interface CalendarDay {
  date: IsoDate;
  ratings: Record<string, StarRating>;
  /** True when at least one rating was written more than a day after the date it
   *  belongs to. Backfilling is allowed, but it should be visible — otherwise
   *  streaks are trivially gameable and the history stops being trustworthy. */
  backfilled: boolean;
}

export async function getCalendarDays(
  db: DB,
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Map<IsoDate, CalendarDay>> {
  const { data } = await db
    .from('daily_logs')
    .select('user_pillar_id, log_date, stars, created_at')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to);

  const days = new Map<IsoDate, CalendarDay>();

  for (const row of (data ?? []) as {
    user_pillar_id: string;
    log_date: string;
    stars: number;
    created_at: string;
  }[]) {
    const day = days.get(row.log_date) ?? {
      date: row.log_date,
      ratings: {},
      backfilled: false,
    };
    day.ratings[row.user_pillar_id] = row.stars as StarRating;

    // `created_at` is an instant; comparing its calendar date against the day
    // being logged is enough to spot an entry written well after the fact.
    const writtenOn = row.created_at.slice(0, 10);
    if (writtenOn > addDays(row.log_date, 1)) day.backfilled = true;

    days.set(row.log_date, day);
  }

  return days;
}

export async function getXpTotals(db: DB, userId: string) {
  const { data } = await db
    .from('xp_events')
    .select('user_pillar_id, amount')
    .eq('user_id', userId);

  const byPillar: Record<string, number> = {};
  let total = 0;
  for (const row of (data ?? []) as { user_pillar_id: string | null; amount: number }[]) {
    total += row.amount;
    if (row.user_pillar_id) {
      byPillar[row.user_pillar_id] = (byPillar[row.user_pillar_id] ?? 0) + row.amount;
    }
  }
  return { byPillar, total };
}

export async function getBadgeKeys(db: DB, userId: string): Promise<Set<string>> {
  const { data } = await db.from('user_badges').select('badge_key').eq('user_id', userId);
  return new Set(((data ?? []) as { badge_key: string }[]).map((r) => r.badge_key));
}

export async function getBadges(db: DB, userId: string) {
  const { data } = await db
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  return (data ?? []) as { id: string; badge_key: string; earned_at: string }[];
}

export async function getQuests(db: DB, userId: string, week: IsoDate): Promise<Quest[]> {
  const { data } = await db
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', week);
  return (data as Quest[]) ?? [];
}

export async function getActionLogDates(db: DB, userId: string, date: IsoDate) {
  const { data } = await db
    .from('action_logs')
    .select('micro_action_id')
    .eq('user_id', userId)
    .eq('log_date', date);
  return new Set(((data ?? []) as { micro_action_id: string }[]).map((r) => r.micro_action_id));
}

/* ------------------------------------------------------------- Dashboard -- */

export interface PillarView {
  pillar: UserPillar;
  xp: number;
  level: number;
  levelProgress: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: number;
  bestStreak: number;
  streakAtRisk: boolean;
  avg7: number;
  avg30: number;
  weekTrend: number;
  logCount30: number;
  todayStars: StarRating;
  todayNote: string | null;
  actions: MicroAction[];
}

export interface DashboardData {
  profile: Profile | null;
  season: Season | null;
  pillars: UserPillar[];
  views: PillarView[];
  entries: DayEntry[];
  week: WindowSummary;
  lastWeek: WindowSummary;
  month: WindowSummary;
  human: ReturnType<typeof humanLevel>;
  rank: ReturnType<typeof rankFor>;
  checkIn: ReturnType<typeof checkInStreak>;
  starDays: ReturnType<typeof starDayStreak>;
  quests: Quest[];
  badgeKeys: Set<string>;
  completedActionIds: Set<string>;
  today: IsoDate;
}

/**
 * One assembly point for everything the dashboard, report and pillar pages
 * render. Four queries total; all the derived numbers come from `lib/game`.
 */
export async function getDashboardData(
  db: DB,
  userId: string,
  /** The user's own calendar day — see lib/userDate.ts. Defaults to the
   *  server's, which is only correct in development. */
  anchor: IsoDate = todayIso(),
): Promise<DashboardData> {
  const from = addDays(anchor, -(HISTORY_DAYS - 1));

  const [profile, season, pillars, entries, xp, badgeKeys, actions, completedActionIds] =
    await Promise.all([
      getProfile(db, userId),
      getCurrentSeason(db, userId),
      getActivePillars(db, userId),
      getEntries(db, userId, from, anchor),
      getXpTotals(db, userId),
      getBadgeKeys(db, userId),
      getMicroActions(db, userId),
      getActionLogDates(db, userId, anchor),
    ]);

  const quests = await getQuests(db, userId, weekStart(anchor));

  const ids = pillars.map((p) => p.id);
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const pick = (dates: IsoDate[]) =>
    dates.map((d) => byDate.get(d) ?? { date: d, ratings: {} as Record<string, StarRating> });

  const weekDates = lastNDays(WEEK_WINDOW, anchor);
  const prevWeekDates = lastNDays(WEEK_WINDOW, addDays(anchor, -WEEK_WINDOW));
  const monthDates = lastNDays(ROLLING_WINDOW, anchor);

  const weekEntries = pick(weekDates);
  const prevEntries = pick(prevWeekDates);
  const monthEntries = pick(monthDates);

  const freezes = profile?.freezes_available ?? 0;
  const todayEntry = byDate.get(anchor);

  const views: PillarView[] = pillars.map((pillar) => {
    const pXp = xp.byPillar[pillar.id] ?? 0;
    const lvl = pillarLevel(pXp);
    const streak = pillarStreak(entries, pillar.id, anchor, freezes);
    return {
      pillar,
      xp: pXp,
      level: lvl.level,
      levelProgress: lvl.progress,
      xpIntoLevel: lvl.xpIntoLevel,
      xpForNextLevel: lvl.xpForNextLevel,
      streak: streak.current,
      bestStreak: streak.best,
      streakAtRisk: streak.atRisk,
      avg7: pillarMean(weekEntries, pillar.id),
      avg30: pillarMean(monthEntries, pillar.id),
      weekTrend: trend(weekEntries, prevEntries, pillar.id),
      logCount30: monthEntries.filter((e) => (e.ratings[pillar.id] ?? 0) > 0).length,
      todayStars: (todayEntry?.ratings[pillar.id] ?? 0) as StarRating,
      todayNote: todayEntry?.notes?.[pillar.id] ?? null,
      actions: actions.filter((a) => a.user_pillar_id === pillar.id),
    };
  });

  return {
    profile,
    season,
    pillars,
    views,
    entries,
    week: summarise(weekEntries, pillars),
    lastWeek: summarise(prevEntries, pillars),
    month: summarise(monthEntries, pillars),
    human: humanLevel(xp.total),
    rank: rankFor(
      overallMean(monthEntries, ids),
      activeDayCount(monthEntries, ids),
    ),
    checkIn: checkInStreak(entries, ids, anchor, freezes),
    starDays: starDayStreak(entries, ids, anchor),
    quests,
    badgeKeys,
    completedActionIds,
    today: anchor,
  };
}
