import type { DayEntry, IsoDate, StarRating, UserPillar } from '../types';
import { STRONG_THRESHOLD } from './constants';

const rating = (e: DayEntry, id: string): StarRating => e.ratings[id] ?? 0;

/* ------------------------------------------------------- Day classification */

export const isLoggedDay = (e: DayEntry, ids: string[]) =>
  ids.length > 0 && ids.every((id) => rating(e, id) > 0);

export const isFiveStarDay = (e: DayEntry, ids: string[]) =>
  ids.length > 0 && ids.every((id) => rating(e, id) >= STRONG_THRESHOLD);

export const isPerfectDay = (e: DayEntry, ids: string[]) =>
  ids.length > 0 && ids.every((id) => rating(e, id) === 5);

/** 0–25 for five pillars. Used to rank best/worst day of a week. */
export const dayScore = (e: DayEntry, ids: string[]) =>
  ids.reduce<number>((sum, id) => sum + rating(e, id), 0);

export const isPartialDay = (e: DayEntry, ids: string[]) =>
  ids.some((id) => rating(e, id) > 0) && !isLoggedDay(e, ids);

/* ------------------------------------------------------------------ Means -- */

/** Mean stars for one pillar, ignoring days it was not logged. */
export function pillarMean(entries: DayEntry[], pillarId: string): number {
  const vals = entries.map((e) => rating(e, pillarId)).filter((v) => v > 0);
  if (vals.length === 0) return 0;
  return vals.reduce<number>((a, b) => a + b, 0) / vals.length;
}

export function pillarLogCount(entries: DayEntry[], pillarId: string): number {
  return entries.filter((e) => rating(e, pillarId) > 0).length;
}

/** Mean stars across every pillar and every logged day. */
export function overallMean(entries: DayEntry[], ids: string[]): number {
  const vals = entries.flatMap((e) => ids.map((id) => rating(e, id))).filter((v) => v > 0);
  if (vals.length === 0) return 0;
  return vals.reduce<number>((a, b) => a + b, 0) / vals.length;
}

/** Distinct days with at least one rating — the denominator for ranking. */
export function activeDayCount(entries: DayEntry[], ids: string[]): number {
  return entries.filter((e) => ids.some((id) => rating(e, id) > 0)).length;
}

/* ---------------------------------------------------------------- Balance -- */

/**
 * Evenness of effort across pillars, 0–100. Built from the coefficient of
 * variation so it measures *spread*, not effort — see docs/FORMULAS.md §6.
 */
export function balanceScore(means: number[]): number {
  const present = means.filter((m) => m > 0);
  if (present.length < 2) return present.length === 1 ? 100 : 0;
  // Unlogged pillars count as zero: neglect must hurt the balance score.
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  if (mean === 0) return 0;
  const variance =
    means.reduce((sum, m) => sum + (m - mean) ** 2, 0) / means.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
}

/* ------------------------------------------------------------- Rank order -- */

export interface PillarRanking {
  pillar: UserPillar;
  mean: number;
  count: number;
}

/**
 * Pillars sorted weakest first. Zero-log pillars sort to the very top: the app
 * cares more about neglect than about a merely low average.
 */
export function rankPillars(entries: DayEntry[], pillars: UserPillar[]): PillarRanking[] {
  return pillars
    .map((pillar) => ({
      pillar,
      mean: pillarMean(entries, pillar.id),
      count: pillarLogCount(entries, pillar.id),
    }))
    .sort((a, b) => {
      if (a.count === 0 !== (b.count === 0)) return a.count === 0 ? -1 : 1;
      if (a.mean !== b.mean) return a.mean - b.mean;
      if (a.count !== b.count) return a.count - b.count;
      return a.pillar.slot - b.pillar.slot;
    });
}

export const weakestPillar = (entries: DayEntry[], pillars: UserPillar[]) =>
  rankPillars(entries, pillars)[0] ?? null;

export const strongestPillar = (entries: DayEntry[], pillars: UserPillar[]) => {
  const ranked = rankPillars(entries, pillars);
  return ranked[ranked.length - 1] ?? null;
};

/* ----------------------------------------------------------------- Trends -- */

/** Difference in mean stars between two windows, e.g. this week vs last. */
export function trend(current: DayEntry[], previous: DayEntry[], pillarId: string): number {
  const a = pillarMean(current, pillarId);
  const b = pillarMean(previous, pillarId);
  if (b === 0) return a === 0 ? 0 : a;
  return a - b;
}

/* ------------------------------------------------------------- Aggregates -- */

export interface WindowSummary {
  entries: DayEntry[];
  pillarIds: string[];
  means: Record<string, number>;
  counts: Record<string, number>;
  overall: number;
  balance: number;
  loggedDays: number;
  fiveStarDays: number;
  perfectDays: number;
  bestDay: { date: IsoDate; score: number } | null;
  hardestDay: { date: IsoDate; score: number } | null;
}

export function summarise(entries: DayEntry[], pillars: UserPillar[]): WindowSummary {
  const ids = pillars.map((p) => p.id);
  const means = Object.fromEntries(ids.map((id) => [id, pillarMean(entries, id)]));
  const counts = Object.fromEntries(ids.map((id) => [id, pillarLogCount(entries, id)]));

  const scored = entries
    .filter((e) => ids.some((id) => rating(e, id) > 0))
    .map((e) => ({ date: e.date, score: dayScore(e, ids) }))
    .sort((a, b) => b.score - a.score);

  return {
    entries,
    pillarIds: ids,
    means,
    counts,
    overall: overallMean(entries, ids),
    balance: balanceScore(ids.map((id) => means[id])),
    loggedDays: entries.filter((e) => isLoggedDay(e, ids)).length,
    fiveStarDays: entries.filter((e) => isFiveStarDay(e, ids)).length,
    perfectDays: entries.filter((e) => isPerfectDay(e, ids)).length,
    bestDay: scored[0] ?? null,
    hardestDay: scored.length > 1 ? scored[scored.length - 1] : null,
  };
}
