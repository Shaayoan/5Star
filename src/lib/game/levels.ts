import {
  HUMAN_LEVEL_K,
  MIN_RANKED_DAYS,
  PILLAR_LEVEL_K,
  STREAK_MILESTONE_BONUS,
  XP_PER_STAR,
} from './constants';
import type { StarRating } from '../types';

/* ------------------------------------------------------------------ XP ---- */

export function xpFromStars(stars: StarRating): number {
  return stars * XP_PER_STAR;
}

/** Every 7th day of a streak pays out, with multipliers at the big milestones. */
export function streakMilestoneXp(streakLength: number): number {
  if (streakLength <= 0 || streakLength % 7 !== 0) return 0;
  const multiplier = streakLength >= 100 ? 3 : streakLength >= 30 ? 2 : 1;
  return STREAK_MILESTONE_BONUS * multiplier;
}

/* --------------------------------------------------------------- Levels --- */

/** Cumulative XP required to *reach* level `n`. Level 1 costs nothing. */
export function cumulativeXpForLevel(n: number, k: number): number {
  return k * (n - 1) * n;
}

/** Inverse of the triangular curve — see docs/FORMULAS.md §3. */
function levelFromXp(xp: number, k: number): number {
  if (xp <= 0) return 1;
  return Math.floor((1 + Math.sqrt(1 + (4 * xp) / k)) / 2);
}

export interface LevelInfo {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
}

function describe(xp: number, k: number): LevelInfo {
  const level = levelFromXp(xp, k);
  const floorXp = cumulativeXpForLevel(level, k);
  const ceilXp = cumulativeXpForLevel(level + 1, k);
  const span = ceilXp - floorXp;
  const into = xp - floorXp;
  return {
    level,
    xp,
    xpIntoLevel: into,
    xpForNextLevel: span,
    progress: span > 0 ? Math.min(1, Math.max(0, into / span)) : 0,
  };
}

export const pillarLevel = (xp: number): LevelInfo => describe(xp, PILLAR_LEVEL_K);
export const humanLevel = (xp: number): LevelInfo => describe(xp, HUMAN_LEVEL_K);

/* ---------------------------------------------------------------- Ranks --- */

export type RankKey = 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'five_star';

export interface Rank {
  key: RankKey;
  name: string;
  color: string;
  /** Mean stars needed to reach this rank. */
  floor: number;
}

export const RANKS: Rank[] = [
  { key: 'bronze', name: 'Bronze', color: '#b45309', floor: 0 },
  { key: 'silver', name: 'Silver', color: '#94a3b8', floor: 2 },
  { key: 'gold', name: 'Gold', color: '#eab308', floor: 3 },
  { key: 'platinum', name: 'Platinum', color: '#22d3ee', floor: 3.8 },
  { key: 'five_star', name: '5-Star', color: '#f59e0b', floor: 4.5 },
];

export const UNRANKED: Rank = {
  key: 'unranked',
  name: 'Unranked',
  color: '#64748b',
  floor: 0,
};

export interface RankResult {
  rank: Rank;
  next: Rank | null;
  meanStars: number;
  loggedDays: number;
  daysToRank: number;
  /** 0–1 progress toward `next`. */
  progress: number;
}

/**
 * Rank from the rolling mean star rating. Below `MIN_RANKED_DAYS` distinct
 * logged days the user is deliberately left Unranked — a single great Tuesday
 * should not crown anyone.
 */
export function rankFor(meanStars: number, loggedDays: number): RankResult {
  if (loggedDays < MIN_RANKED_DAYS) {
    return {
      rank: UNRANKED,
      next: RANKS[0],
      meanStars,
      loggedDays,
      daysToRank: MIN_RANKED_DAYS - loggedDays,
      progress: loggedDays / MIN_RANKED_DAYS,
    };
  }
  let index = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (meanStars >= RANKS[i].floor) {
      index = i;
      break;
    }
  }
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const span = next ? next.floor - rank.floor : 1;
  return {
    rank,
    next,
    meanStars,
    loggedDays,
    daysToRank: 0,
    progress: next ? Math.min(1, Math.max(0, (meanStars - rank.floor) / span)) : 1,
  };
}
