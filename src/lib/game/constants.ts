/** Tuning constants for the whole game layer. Documented in docs/FORMULAS.md. */

/** Five is the shape of the app and the default a new season starts with, but a
 *  user may run more if their life genuinely has more axes to it. */
export const DEFAULT_PILLAR_COUNT = 5;
export const MIN_PILLARS = 5;
export const MAX_PILLARS = 10;

/** Highest possible total for one day, given how many pillars are active. */
export const maxDayScore = (pillarCount: number) => pillarCount * 5;

/** Minimum stars for a day to keep a pillar streak alive. */
export const STREAK_THRESHOLD = 3;

/** Minimum stars for a pillar to count as "hit" on a five-star day. */
export const STRONG_THRESHOLD = 4;

export const XP_PER_STAR = 10;
export const FIVE_STAR_DAY_BONUS = 50;
export const PERFECT_DAY_BONUS = 100;
export const QUEST_REWARD = 150;
export const STREAK_MILESTONE_BONUS = 25;

/** Level curve coefficients: cumulative XP for level n is `k * (n-1) * n`. */
export const PILLAR_LEVEL_K = 50;
export const HUMAN_LEVEL_K = 250;

/** Days of data required before a rank is assigned. */
export const MIN_RANKED_DAYS = 10;

/** Freezes protect a streak from a single missed day. */
export const MAX_FREEZES = 2;
export const DAYS_PER_FREEZE = 7;

export const ROLLING_WINDOW = 30;
export const WEEK_WINDOW = 7;
