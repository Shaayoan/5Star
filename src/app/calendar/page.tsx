import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import {
  addDays,
  dayLabel,
  formatDate,
  fromIso,
  rangeDates,
  toIso,
  today as todayIso,
} from '@/lib/dates';
import { getActivePillars, getCalendarDays } from '@/lib/queries';
import { dayScore, isFiveStarDay, isLoggedDay, maxDayScore } from '@/lib/game';
import { Card, StatTile } from '@/components/ui';
import { DayRing } from '@/components/DayRing';
import { PageTitle, Shell } from '@/components/Shell';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** First of the month containing `iso`. */
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;

function shiftMonth(iso: string, by: number): string {
  const d = fromIso(monthStart(iso));
  d.setMonth(d.getMonth() + by);
  return toIso(d);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { db, user } = await requireUser();
  const params = await searchParams;

  const pillars = await getActivePillars(db, user.id);
  if (pillars.length === 0) redirect('/onboarding');

  const today = todayIso();
  const anchor =
    params.m && /^\d{4}-\d{2}$/.test(params.m) ? `${params.m}-01` : monthStart(today);

  const first = monthStart(anchor);
  const lastDay = shiftMonth(first, 1);
  const last = addDays(lastDay, -1);

  // Pad to whole weeks so the grid is always a clean rectangle.
  const leading = (fromIso(first).getDay() + 6) % 7;
  const gridStart = addDays(first, -leading);
  const trailing = 6 - ((fromIso(last).getDay() + 6) % 7);
  const gridEnd = addDays(last, trailing);

  const days = await getCalendarDays(db, user.id, gridStart, gridEnd);
  const cells = rangeDates(gridStart, gridEnd);

  const ids = pillars.map((p) => p.id);
  const inMonth = rangeDates(first, last)
    .map((d) => days.get(d))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const complete = inMonth.filter((d) => isLoggedDay(d, ids)).length;
  const fiveStar = inMonth.filter((d) => isFiveStarDay(d, ids)).length;
  const monthMax = maxDayScore(ids.length);
  const best = inMonth.reduce(
    (acc, d) => Math.max(acc, dayScore(d, ids)),
    0,
  );

  const isFuture = (d: string) => d > today;

  return (
    <Shell active="/calendar">
      <PageTitle
        title={formatDate(first, { month: 'long', year: 'numeric' })}
        subtitle="Every day of the month. Click any past day to fill it in."
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?m=${shiftMonth(first, -1).slice(0, 7)}`}
              aria-label="Previous month"
              className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-200 hover:bg-ink-700"
            >
              ←
            </Link>
            <Link
              href="/calendar"
              className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-200 hover:bg-ink-700"
            >
              Today
            </Link>
            <Link
              href={`/calendar?m=${shiftMonth(first, 1).slice(0, 7)}`}
              aria-label="Next month"
              className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-200 hover:bg-ink-700"
            >
              →
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Days logged" value={inMonth.length} sub="any pillar" />
        <StatTile label="Complete" value={complete} sub={`all ${ids.length} pillars`} />
        <StatTile label="Five-star" value={fiveStar} accent="#fbbf24" sub="every pillar 4★+" />
        <StatTile label="Best day" value={best > 0 ? `${best}/${monthMax}` : '—'} />
      </div>

      <Card className="p-3 sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="label-xs text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {cells.map((date) => {
            const day = days.get(date);
            const outside = date < first || date > last;
            const future = isFuture(date);
            const isToday = date === today;
            const logged = day ? isLoggedDay(day, ids) : false;

            const inner = (
              <>
                <span
                  className={cn(
                    'num text-[11px] leading-none',
                    isToday ? 'font-bold text-gold-400' : 'text-ink-400',
                  )}
                >
                  {Number(date.slice(8))}
                </span>

                <DayRing
                  pillars={pillars}
                  ratings={day?.ratings ?? {}}
                  size={34}
                />

                <span className="flex h-2 items-center gap-1">
                  {logged && (
                    <span
                      className="h-1 w-1 rounded-full bg-emerald-400"
                      title="Every pillar logged"
                    />
                  )}
                  {day?.backfilled && (
                    <span
                      className="h-1 w-1 rounded-full bg-ink-400"
                      title="Filled in after the fact"
                    />
                  )}
                </span>
              </>
            );

            const shell = cn(
              'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl',
              'border transition-colors',
              outside && 'opacity-30',
              future
                ? 'cursor-not-allowed border-transparent opacity-25'
                : 'border-[var(--border)] hover:border-gold-500/50 hover:bg-ink-800/60',
              isToday && 'border-gold-500/60 bg-gold-500/5',
            );

            if (future) {
              return (
                <div key={date} className={shell} aria-hidden="true">
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={date}
                href={`/calendar/${date}`}
                className={shell}
                aria-label={`${dayLabel(date)} ${formatDate(date)}${
                  logged ? ', fully logged' : day ? ', partly logged' : ', not logged'
                }`}
              >
                {inner}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <DayRing pillars={pillars} ratings={{}} size={16} />
            not logged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            all {ids.length} pillars logged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-ink-400" />
            filled in later
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {pillars.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </span>
            ))}
          </span>
        </div>
      </Card>
    </Shell>
  );
}
