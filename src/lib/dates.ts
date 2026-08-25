import type { IsoDate } from './types';

/** All date maths in the app runs on `YYYY-MM-DD` strings in the user's local
 *  timezone. Using strings (not Date objects) avoids the classic UTC-offset bug
 *  where "today" flips at 5pm for anyone west of Greenwich. */

export function toIso(d: Date): IsoDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Today" according to the machine running this code. On a browser that is the
 *  user's own clock; on Vercel it is UTC, which is why server code must use
 *  `todayIn` with the user's stored timezone instead. */
export function today(): IsoDate {
  return toIso(new Date());
}

/**
 * "Today" in a specific IANA timezone, e.g. `Asia/Dubai`.
 *
 * A check-in belongs to the user's calendar day, not the server's. Rendering the
 * dashboard with the server's date meant anyone east of UTC saw yesterday for
 * the first hours of their morning, and logs written then landed on the wrong
 * day — which streaks, the calendar and the weekly report all inherited.
 *
 * `en-CA` is used because it formats as `YYYY-MM-DD`.
 */
export function todayIn(timeZone: string | null | undefined): IsoDate {
  if (!timeZone) return today();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    // An unknown zone should never take the app down.
    return today();
  }
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = fromIso(b).getTime() - fromIso(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-anchored week start. */
export function weekStart(iso: IsoDate = today()): IsoDate {
  const d = fromIso(iso);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}

export function weekEnd(iso: IsoDate = today()): IsoDate {
  return addDays(weekStart(iso), 6);
}

/** Inclusive list of dates from `start` to `end`. */
export function rangeDates(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = start; daysBetween(d, end) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The last `n` days ending at `end`, oldest first. */
export function lastNDays(n: number, end: IsoDate = today()): IsoDate[] {
  return rangeDates(addDays(end, -(n - 1)), end);
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function dayLabel(iso: IsoDate): string {
  return DAY_LABELS[(fromIso(iso).getDay() + 6) % 7];
}

export function formatDate(iso: IsoDate, opts?: Intl.DateTimeFormatOptions): string {
  return fromIso(iso).toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric' });
}

export function formatRange(start: IsoDate, end: IsoDate): string {
  return `${formatDate(start)} – ${formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** Hour 0–23 in the given timezone, for time-of-day greetings. */
export function hourIn(timeZone: string | null | undefined): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timeZone ?? 'UTC',
        hour: '2-digit',
        hour12: false,
      }).format(new Date()),
    );
  } catch {
    return new Date().getHours();
  }
}

export function greeting(timeZone: string | null | undefined): string {
  const h = hourIn(timeZone);
  if (h < 5) return 'Still up';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/** "Q3 2026" style label used to name a new season. */
export function seasonLabel(iso: IsoDate = today()): string {
  const d = fromIso(iso);
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}
