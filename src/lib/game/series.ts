import type { DayEntry, IsoDate, UserPillar } from '../types';
import { balanceScore, overallMean, pillarMean } from './analysis';

/**
 * Time series for the trend chart.
 *
 * Raw daily values are far too jagged to read — one skipped day drops a pillar
 * to zero and the line looks like noise. Every series is therefore a trailing
 * rolling mean, the same way a stock chart shows a moving average rather than
 * every tick.
 */

export const ROLLING_DAYS = 7;

export interface SeriesPoint {
  date: IsoDate;
  /** Rolling mean stars across all pillars, 0–5. `null` when the window holds
   *  no data at all — a stretch with nothing logged is a gap in the line, not a
   *  crash to zero. */
  overall: number | null;
  /** Rolling balance score, 0–100, or `null` for an empty window. */
  balance: number | null;
  /** Rolling mean per pillar id, 0–5, or `null` if that pillar has nothing in
   *  the window. */
  pillars: Record<string, number | null>;
  /** Whether this day itself had any entry. */
  logged: boolean;
}

/**
 * One point per day. Each point looks back `ROLLING_DAYS` from itself, so the
 * value at any date answers "how was the week ending here?".
 */
export function buildSeries(entries: DayEntry[], pillars: UserPillar[]): SeriesPoint[] {
  const ids = pillars.map((p) => p.id);

  return entries.map((entry, i) => {
    const window = entries.slice(Math.max(0, i - ROLLING_DAYS + 1), i + 1);
    const means = ids.map((id) => pillarMean(window, id));
    const anyData = means.some((m) => m > 0);

    return {
      date: entry.date,
      overall: anyData ? Number(overallMean(window, ids).toFixed(2)) : null,
      balance: anyData ? balanceScore(means) : null,
      pillars: Object.fromEntries(
        ids.map((id, j) => [id, means[j] > 0 ? Number(means[j].toFixed(2)) : null]),
      ),
      logged: ids.some((id) => (entry.ratings[id] ?? 0) > 0),
    };
  });
}

/** Change between the first and last point that actually has data, for the
 *  ticker header. Gaps are skipped rather than counted as zeroes. */
export function seriesDelta(
  points: SeriesPoint[],
  read: (p: SeriesPoint) => number | null,
) {
  const values = points.map(read).filter((v): v is number => v !== null);

  if (values.length === 0) return { current: 0, change: 0, percent: 0, points: 0 };

  const current = values[values.length - 1];
  const start = values[0];
  const change = current - start;

  return {
    current,
    change,
    percent: start > 0 ? (change / start) * 100 : 0,
    points: values.length,
  };
}
