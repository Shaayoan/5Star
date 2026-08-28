import type { DayEntry, UserPillar } from '../types';
import { formatDate, fromIso } from '../dates';
import { pillarMean } from './analysis';
import { STRONG_THRESHOLD } from './constants';

/**
 * Patterns across pillars and across days — the things the raw numbers do not
 * show. "Your Mental averages 1.2★ higher on days you log Physical at 4★+" is
 * the kind of statement nobody expects and nobody could work out by eye.
 *
 * These are correlations over a small personal dataset, not science. Every
 * threshold below exists to stop the app confidently reporting noise, and every
 * insight carries the sample size it was drawn from so the user can judge it.
 */

/** Days needed on *each* side of a comparison before it is worth reporting. */
export const MIN_SAMPLE = 4;

/** Smallest gap that counts as a real difference rather than rounding. */
export const MIN_LIFT = 0.5;

/** Days of history before weekday patterns mean anything. */
export const MIN_DAYS_FOR_WEEKDAY = 14;

/** Occurrences of a given weekday before it can be called a pattern. */
export const MIN_WEEKDAY_SAMPLE = 3;

export type InsightKind = 'lift' | 'weekday' | 'weekend' | 'together';

export interface Insight {
  kind: InsightKind;
  /** Higher sorts first — roughly "how surprising and well-evidenced". */
  strength: number;
  text: string;
  /** Pillars involved, so the UI can colour the row. */
  pillarIds: string[];
  /** Human-readable basis, e.g. "9 days vs 6". */
  basis: string;
}

const rated = (e: DayEntry, id: string) => e.ratings[id] ?? 0;
const mean = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);

/* ------------------------------------------------------------------ lift -- */

/**
 * For each ordered pair, compare pillar A's average on days when pillar B was
 * strong against days when B was logged but weak. Both sides need `MIN_SAMPLE`
 * days, and A must actually be rated on those days.
 */
export function pillarLifts(entries: DayEntry[], pillars: UserPillar[]): Insight[] {
  const out: Insight[] = [];

  for (const a of pillars) {
    for (const b of pillars) {
      if (a.id === b.id) continue;

      const strongDays: number[] = [];
      const weakDays: number[] = [];

      for (const e of entries) {
        const bv = rated(e, b.id);
        const av = rated(e, a.id);
        if (!bv || !av) continue; // both must be logged that day
        if (bv >= STRONG_THRESHOLD) strongDays.push(av);
        else weakDays.push(av);
      }

      if (strongDays.length < MIN_SAMPLE || weakDays.length < MIN_SAMPLE) continue;

      const lift = mean(strongDays) - mean(weakDays);
      if (Math.abs(lift) < MIN_LIFT) continue;

      const better = lift > 0;
      out.push({
        kind: 'lift',
        // More evidence and a bigger gap both raise confidence.
        strength: Math.abs(lift) * Math.min(strongDays.length, weakDays.length),
        pillarIds: [a.id, b.id],
        text: better
          ? `${a.icon} ${a.name} averages ${lift.toFixed(1)}★ higher on days you log ${b.icon} ${b.name} at ${STRONG_THRESHOLD}★ or better.`
          : `${a.icon} ${a.name} averages ${Math.abs(lift).toFixed(1)}★ lower on days you log ${b.icon} ${b.name} at ${STRONG_THRESHOLD}★ or better.`,
        basis: `${strongDays.length} strong days vs ${weakDays.length} weaker ones`,
      });
    }
  }

  // One statement per pillar pair is plenty — keep the strongest direction.
  const seen = new Set<string>();
  return out
    .sort((x, y) => y.strength - x.strength)
    .filter((i) => {
      const key = [...i.pillarIds].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/* --------------------------------------------------------------- weekday -- */

/** The weekday a pillar reliably peaks or collapses on. */
export function weekdayPatterns(entries: DayEntry[], pillars: UserPillar[]): Insight[] {
  const logged = entries.filter((e) => pillars.some((p) => rated(e, p.id) > 0));
  if (logged.length < MIN_DAYS_FOR_WEEKDAY) return [];

  const out: Insight[] = [];

  for (const p of pillars) {
    const byDay = new Map<string, number[]>();
    for (const e of entries) {
      const v = rated(e, p.id);
      if (!v) continue;
      // Full weekday names, so the sentence reads "on Saturdays", not "on Sats".
      const key = formatDate(e.date, { weekday: 'long' });
      byDay.set(key, [...(byDay.get(key) ?? []), v]);
    }

    const overall = pillarMean(entries, p.id);
    if (overall === 0) continue;

    // Only the single most extreme weekday per pillar — listing Saturday *and*
    // Sunday separately says the same thing twice.
    let best: Insight | null = null;

    for (const [day, values] of byDay) {
      if (values.length < MIN_WEEKDAY_SAMPLE) continue;
      const diff = mean(values) - overall;
      if (Math.abs(diff) < MIN_LIFT) continue;

      const candidate: Insight = {
        kind: 'weekday',
        strength: Math.abs(diff) * values.length * 0.8,
        pillarIds: [p.id],
        text:
          diff > 0
            ? `${p.icon} ${p.name} is your strongest on ${day}s — ${diff.toFixed(1)}★ above its own average.`
            : `${p.icon} ${p.name} drops ${Math.abs(diff).toFixed(1)}★ below its average on ${day}s.`,
        basis: `${values.length} ${day}s`,
      };

      if (!best || candidate.strength > best.strength) best = candidate;
    }

    if (best) out.push(best);
  }

  return out.sort((a, b) => b.strength - a.strength);
}

/* --------------------------------------------------------------- weekend -- */

/** The weekend collapse, or the weekend rescue. */
export function weekendEffect(entries: DayEntry[], pillars: UserPillar[]): Insight | null {
  const ids = pillars.map((p) => p.id);
  const weekend: number[] = [];
  const weekday: number[] = [];

  for (const e of entries) {
    const day = fromIso(e.date).getDay(); // 0 Sun, 6 Sat
    for (const id of ids) {
      const v = rated(e, id);
      if (!v) continue;
      if (day === 0 || day === 6) weekend.push(v);
      else weekday.push(v);
    }
  }

  if (weekend.length < MIN_SAMPLE * 2 || weekday.length < MIN_SAMPLE * 2) return null;

  const diff = mean(weekend) - mean(weekday);
  if (Math.abs(diff) < 0.3) return null;

  return {
    kind: 'weekend',
    strength: Math.abs(diff) * 6,
    pillarIds: [],
    text:
      diff > 0
        ? `You score ${diff.toFixed(1)}★ higher at weekends than on weekdays.`
        : `You score ${Math.abs(diff).toFixed(1)}★ lower at weekends than on weekdays.`,
    basis: `${weekend.length} weekend ratings vs ${weekday.length} weekday`,
  };
}

/* ------------------------------------------------------------- assembled -- */

export interface InsightReport {
  insights: Insight[];
  /** Days with at least one rating — what everything above is drawn from. */
  sampleDays: number;
  /** True when there is simply not enough history yet to say anything. */
  tooEarly: boolean;
}

export function buildInsights(entries: DayEntry[], pillars: UserPillar[]): InsightReport {
  const sampleDays = entries.filter((e) => pillars.some((p) => rated(e, p.id) > 0)).length;

  const weekend = weekendEffect(entries, pillars);
  const insights = [
    ...pillarLifts(entries, pillars),
    ...weekdayPatterns(entries, pillars),
    ...(weekend ? [weekend] : []),
  ]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);

  return {
    insights,
    sampleDays,
    // Below two weeks of data any "pattern" is almost certainly coincidence.
    tooEarly: sampleDays < MIN_DAYS_FOR_WEEKDAY,
  };
}

/* ---------------------------------------------------------------- movers -- */

export interface Mover {
  pillar: UserPillar;
  current: number;
  previous: number;
  delta: number;
}

/**
 * Week-over-week change per pillar, biggest movement first. Pillars without
 * data on both sides are excluded — you cannot move from nothing.
 */
export function weekMovers(
  thisWeek: DayEntry[],
  lastWeek: DayEntry[],
  pillars: UserPillar[],
): Mover[] {
  return pillars
    .map((pillar) => {
      const current = pillarMean(thisWeek, pillar.id);
      const previous = pillarMean(lastWeek, pillar.id);
      return { pillar, current, previous, delta: current - previous };
    })
    .filter((m) => m.current > 0 && m.previous > 0 && Math.abs(m.delta) >= 0.1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** One plain sentence naming what rose and what fell. */
export function moversSentence(movers: Mover[]): string | null {
  const up = movers.filter((m) => m.delta > 0);
  const down = movers.filter((m) => m.delta < 0);
  if (up.length === 0 && down.length === 0) return null;

  const phrase = (m: Mover) =>
    `${m.pillar.name} ${m.delta > 0 ? 'up' : 'down'} ${Math.abs(m.delta).toFixed(1)}★ (${m.previous.toFixed(1)} → ${m.current.toFixed(1)})`;

  const parts: string[] = [];
  if (up.length) parts.push(up.slice(0, 3).map(phrase).join(', '));
  if (down.length) parts.push(down.slice(0, 3).map(phrase).join(', '));

  return `Against last week: ${parts.join('; ')}.`;
}
