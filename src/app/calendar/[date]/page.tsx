import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { addDays, daysBetween, formatDate, today as todayIso } from '@/lib/dates';
import {
  getActionLogDates,
  getActivePillars,
  getEntries,
  getMicroActions,
  getXpTotals,
} from '@/lib/queries';
import { dayScore, maxDayScore, pillarLevel, pillarStreak } from '@/lib/game';
import { Card, Chip, StatTile } from '@/components/ui';
import { CheckIn } from '@/components/CheckIn';
import { PageTitle, Shell } from '@/components/Shell';

/**
 * One past day, editable. The schema always supported this — `daily_logs` is
 * keyed by date and the XP ledger is idempotent — so backfilling reuses exactly
 * the same write path as logging today.
 */
export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const today = todayIso();
  if (date > today) redirect('/calendar');

  const { db, user } = await requireUser();

  const pillars = await getActivePillars(db, user.id);
  if (pillars.length === 0) redirect('/onboarding');

  const [entries, actions, completed, xp] = await Promise.all([
    getEntries(db, user.id, addDays(date, -89), today),
    getMicroActions(db, user.id),
    getActionLogDates(db, user.id, date),
    getXpTotals(db, user.id),
  ]);

  const entry = entries.find((e) => e.date === date);
  const ids = pillars.map((p) => p.id);
  const daysAgo = daysBetween(date, today);
  const score = entry ? dayScore(entry, ids) : 0;
  const loggedCount = ids.filter((id) => (entry?.ratings[id] ?? 0) > 0).length;

  return (
    <Shell active="/calendar">
      <PageTitle
        title={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        subtitle={
          daysAgo === 0
            ? 'Today'
            : daysAgo === 1
              ? 'Yesterday — filling this in counts, and is marked as late'
              : `${daysAgo} days ago — filling this in counts, and is marked as late`
        }
        action={
          <div className="flex gap-2">
            <Link
              href={`/calendar/${addDays(date, -1)}`}
              className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-700"
            >
              ← {formatDate(addDays(date, -1))}
            </Link>
            {date < today && (
              <Link
                href={`/calendar/${addDays(date, 1)}`}
                className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-700"
              >
                {formatDate(addDays(date, 1))} →
              </Link>
            )}
            <Link
              href="/calendar"
              className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-700"
            >
              Month
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Logged" value={`${loggedCount}/${ids.length}`} sub="pillars" />
        <StatTile
          label="Day score"
          value={`${score}/${maxDayScore(ids.length)}`}
          accent={score >= maxDayScore(ids.length) * 0.8 ? '#fbbf24' : undefined}
        />
        <StatTile
          label="When"
          value={daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
          sub={formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' })}
        />
      </div>

      {daysAgo > 1 && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <Chip tone="neutral">Backfill</Chip>
            <p className="text-sm text-ink-300">
              Anything you write here is recorded as filled in after the fact and shows a
              marker on the calendar. Streaks and XP still count — the marker exists so your
              own history stays honest, not to penalise you.
            </p>
          </div>
        </Card>
      )}

      <CheckIn
        date={date}
        completedActionIds={[...completed]}
        pillars={pillars.map((pillar) => {
          const pXp = xp.byPillar[pillar.id] ?? 0;
          const lvl = pillarLevel(pXp);
          return {
            id: pillar.id,
            name: pillar.name,
            icon: pillar.icon,
            color: pillar.color,
            definition: pillar.definition,
            level: lvl.level,
            levelProgress: lvl.progress,
            xpIntoLevel: lvl.xpIntoLevel,
            xpForNextLevel: lvl.xpForNextLevel,
            streak: pillarStreak(entries, pillar.id, today).current,
            todayStars: entry?.ratings[pillar.id] ?? 0,
            todayNote: entry?.notes?.[pillar.id] ?? null,
            actions: actions.filter((a) => a.user_pillar_id === pillar.id),
          };
        })}
      />
    </Shell>
  );
}
