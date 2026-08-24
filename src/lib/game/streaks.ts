import { addDays, daysBetween, today as todayIso } from '../dates';
import type { DayEntry, IsoDate, StarRating } from '../types';
import { DAYS_PER_FREEZE, MAX_FREEZES, STREAK_THRESHOLD, STRONG_THRESHOLD } from './constants';

export interface StreakResult {
  current: number;
  best: number;
  /** How many stored freezes the current streak is leaning on. */
  freezesUsed: number;
  /** True when today has not yet qualified but yesterday did — the streak is alive
   *  but at risk, which the UI nudges about. */
  atRisk: boolean;
}

const EMPTY: StreakResult = { current: 0, best: 0, freezesUsed: 0, atRisk: false };

/**
 * Walk backwards from today counting qualifying days. A streak survives if the
 * most recent qualifying day is today *or* yesterday; single-day gaps further
 * back may be paid for with a freeze.
 */
function computeStreak(
  qualifying: Set<IsoDate>,
  anchor: IsoDate,
  freezes: number,
): StreakResult {
  if (qualifying.size === 0) return EMPTY;

  const sorted = [...qualifying].sort();
  let best = 0;
  let run = 0;
  let prev: IsoDate | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }

  const todayQualifies = qualifying.has(anchor);
  const yesterday = addDays(anchor, -1);
  if (!todayQualifies && !qualifying.has(yesterday)) {
    return { current: 0, best, freezesUsed: 0, atRisk: false };
  }

  let cursor = todayQualifies ? anchor : yesterday;
  let current = 0;
  let freezesUsed = 0;
  for (;;) {
    if (qualifying.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    // A single missed day can be covered by a stored freeze.
    if (freezesUsed < freezes && qualifying.has(addDays(cursor, -1))) {
      freezesUsed += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }

  return { current, best, freezesUsed, atRisk: !todayQualifies };
}

const ratingOf = (entry: DayEntry, pillarId: string): StarRating =>
  entry.ratings[pillarId] ?? 0;

/** Consecutive days this pillar scored at least `STREAK_THRESHOLD`. */
export function pillarStreak(
  entries: DayEntry[],
  pillarId: string,
  anchor: IsoDate = todayIso(),
  freezes = 0,
): StreakResult {
  const qualifying = new Set(
    entries.filter((e) => ratingOf(e, pillarId) >= STREAK_THRESHOLD).map((e) => e.date),
  );
  return computeStreak(qualifying, anchor, freezes);
}

/** Consecutive days where *every* active pillar was logged at all. */
export function checkInStreak(
  entries: DayEntry[],
  pillarIds: string[],
  anchor: IsoDate = todayIso(),
  freezes = 0,
): StreakResult {
  if (pillarIds.length === 0) return EMPTY;
  const qualifying = new Set(
    entries.filter((e) => pillarIds.every((id) => ratingOf(e, id) > 0)).map((e) => e.date),
  );
  return computeStreak(qualifying, anchor, freezes);
}

/** Consecutive five-star days — every pillar at 4★ or better. */
export function starDayStreak(
  entries: DayEntry[],
  pillarIds: string[],
  anchor: IsoDate = todayIso(),
): StreakResult {
  if (pillarIds.length === 0) return EMPTY;
  const qualifying = new Set(
    entries
      .filter((e) => pillarIds.every((id) => ratingOf(e, id) >= STRONG_THRESHOLD))
      .map((e) => e.date),
  );
  return computeStreak(qualifying, anchor, 0);
}

/**
 * Freezes accrue one per `DAYS_PER_FREEZE` days of check-in streak, capped.
 * Returns the number the user should now hold, given what they already had.
 */
export function freezesEarned(streakLength: number, alreadyHeld: number): number {
  if (streakLength === 0 || streakLength % DAYS_PER_FREEZE !== 0) return alreadyHeld;
  return Math.min(MAX_FREEZES, alreadyHeld + 1);
}
