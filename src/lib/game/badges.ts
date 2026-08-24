import { addDays, daysBetween } from '../dates';
import type { DayEntry, IsoDate, UserPillar } from '../types';
import { isFiveStarDay, isLoggedDay, isPerfectDay, pillarMean } from './analysis';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'legend';

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  xp: number;
}

export const BADGES: BadgeDefinition[] = [
  { key: 'first_light', name: 'First Light', description: 'Logged your very first day.', icon: '🌅', tier: 'bronze', xp: 25 },
  { key: 'full_house', name: 'Full House', description: 'Rated all five pillars on the same day.', icon: '🏠', tier: 'bronze', xp: 40 },
  { key: 'five_star_day', name: 'Five Star Day', description: 'Every pillar at 4★ or better in one day.', icon: '⭐', tier: 'silver', xp: 75 },
  { key: 'flawless', name: 'Flawless', description: 'Every pillar at a perfect 5★.', icon: '💎', tier: 'gold', xp: 150 },
  { key: 'week_one', name: 'Week One', description: 'Seven days of complete check-ins.', icon: '🗓️', tier: 'bronze', xp: 60 },
  { key: 'fortnight', name: 'Fortnight', description: 'Fourteen days without missing a check-in.', icon: '📆', tier: 'silver', xp: 120 },
  { key: 'iron_month', name: 'Iron Month', description: 'Thirty consecutive days. Unbroken.', icon: '🛡️', tier: 'gold', xp: 300 },
  { key: 'comeback', name: 'Comeback', description: 'Returned from a lapse and logged three days straight.', icon: '🔁', tier: 'silver', xp: 90 },
  { key: 'equilibrium', name: 'Equilibrium', description: 'A week with a balance score of 85 or higher.', icon: '⚖️', tier: 'gold', xp: 150 },
  { key: 'well_rounded', name: 'Well Rounded', description: 'A week with no pillar averaging below 3★.', icon: '🎯', tier: 'silver', xp: 110 },
  { key: 'centurion', name: 'Centurion', description: 'One hundred pillar logs recorded.', icon: '💯', tier: 'gold', xp: 200 },
  { key: 'ascendant', name: 'Ascendant', description: 'Took a single pillar to level 5.', icon: '🚀', tier: 'gold', xp: 200 },
  { key: 'quest_runner', name: 'Quest Runner', description: 'Completed five weekly quests.', icon: '🧭', tier: 'silver', xp: 130 },
  { key: 'season_finisher', name: 'Season Finisher', description: 'Saw a full season through to its close.', icon: '🏆', tier: 'legend', xp: 400 },
];

export const BADGES_BY_KEY = Object.fromEntries(BADGES.map((b) => [b.key, b])) as Record<
  string,
  BadgeDefinition
>;

export interface BadgeContext {
  entries: DayEntry[];
  pillars: UserPillar[];
  /** Trailing-week entries used for the weekly badges. */
  weekEntries: DayEntry[];
  weekBalance: number;
  checkInStreak: number;
  totalLogs: number;
  maxPillarLevel: number;
  questsCompleted: number;
  seasonsCompleted: number;
  earned: Set<string>;
  anchor: IsoDate;
}

/** True when the three days ending at `anchor` are complete check-ins and the
 *  three days before them were not — i.e. the user actually came back. */
function isComeback(entries: DayEntry[], ids: string[], anchor: IsoDate): boolean {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const complete = (d: IsoDate) => {
    const e = byDate.get(d);
    return e ? isLoggedDay(e, ids) : false;
  };
  const recentThree = [0, 1, 2].every((i) => complete(addDays(anchor, -i)));
  if (!recentThree) return false;
  const gapThree = [3, 4, 5].every((i) => !complete(addDays(anchor, -i)));
  if (!gapThree) return false;
  // Only a comeback if there was a life before the gap.
  return entries.some((e) => daysBetween(e.date, anchor) > 5 && isLoggedDay(e, ids));
}

/** Returns the keys newly earned by this context (never already-held ones). */
export function evaluateBadges(ctx: BadgeContext): string[] {
  const ids = ctx.pillars.map((p) => p.id);
  const earned: string[] = [];
  const award = (key: string, condition: boolean) => {
    if (condition && !ctx.earned.has(key)) earned.push(key);
  };

  award('first_light', ctx.totalLogs >= 1);
  award('full_house', ctx.entries.some((e) => isLoggedDay(e, ids)));
  award('five_star_day', ctx.entries.some((e) => isFiveStarDay(e, ids)));
  award('flawless', ctx.entries.some((e) => isPerfectDay(e, ids)));

  award('week_one', ctx.checkInStreak >= 7);
  award('fortnight', ctx.checkInStreak >= 14);
  award('iron_month', ctx.checkInStreak >= 30);
  award('comeback', isComeback(ctx.entries, ids, ctx.anchor));

  // `weekEntries` always holds seven calendar days, including empty ones, so the
  // gate has to count days that were actually completed — otherwise both weekly
  // badges would unlock on a user's very first day.
  const completeDaysThisWeek = ctx.weekEntries.filter((e) => isLoggedDay(e, ids)).length;

  award('equilibrium', ctx.weekBalance >= 85 && completeDaysThisWeek >= 5);
  award(
    'well_rounded',
    ids.length > 0 &&
      completeDaysThisWeek >= 5 &&
      ids.every((id) => pillarMean(ctx.weekEntries, id) >= 3),
  );

  award('centurion', ctx.totalLogs >= 100);
  award('ascendant', ctx.maxPillarLevel >= 5);
  award('quest_runner', ctx.questsCompleted >= 5);
  award('season_finisher', ctx.seasonsCompleted >= 1);

  return earned;
}
