import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import {
  addDays,
  formatDate,
  formatRange,
  lastNDays,
  today as todayIso,
  weekStart,
} from '@/lib/dates';
import { getActivePillars, getEntries, getQuests } from '@/lib/queries';
import {
  buildNarrative,
  checkInStreak,
  maxDayScore,
  rankPillars,
  summarise,
} from '@/lib/game';
import { BalanceRadar, Heatmap, WeekBars } from '@/components/Charts';
import { Card, CardDescription, CardTitle, Chip, EmptyState, StatTile } from '@/components/ui';
import { StarDisplay } from '@/components/StarPicker';
import { PageTitle, Shell } from '@/components/Shell';
import { dayScore } from '@/lib/game';
import { isAiConfigured } from '@/lib/ai/config';
import { alpha } from '@/lib/utils';
import { DeepReview } from './DeepReview';

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { db, user } = await requireUser();
  const params = await searchParams;

  const pillars = await getActivePillars(db, user.id);
  if (pillars.length === 0) redirect('/onboarding');

  const thisWeek = weekStart(todayIso());
  const start = params.w && /^\d{4}-\d{2}-\d{2}$/.test(params.w) ? weekStart(params.w) : thisWeek;
  const end = addDays(start, 6);
  const isCurrentWeek = start === thisWeek;

  // Pull three weeks so the comparison and the streak both have context.
  const entries = await getEntries(db, user.id, addDays(start, -30), end);
  const inWeek = entries.filter((e) => e.date >= start && e.date <= end);
  const inPrev = entries.filter((e) => e.date >= addDays(start, -7) && e.date < start);

  const week = summarise(inWeek, pillars);
  const previous = summarise(inPrev, pillars);
  const ids = pillars.map((p) => p.id);

  const quests = await getQuests(db, user.id, start);
  const questsDone = quests.filter((q) => q.status === 'completed').length;

  const { data: cachedReport } = await db
    .from('weekly_reports')
    .select('narrative')
    .eq('user_id', user.id)
    .eq('week_start', start)
    .maybeSingle<{ narrative: string | null }>();
  const cachedNarrative = cachedReport?.narrative ?? null;

  const narrative = buildNarrative({
    week,
    previous,
    pillars,
    checkInStreak: checkInStreak(entries, ids, isCurrentWeek ? todayIso() : end).current,
    questsCompleted: questsDone,
    newBadges: [],
  });

  const ranked = rankPillars(inWeek, pillars);
  const focus = ranked[0];

  const radar = pillars.map((p) => ({
    pillar: p.name,
    icon: p.icon,
    current: Number((week.means[p.id] ?? 0).toFixed(2)),
    previous: Number((previous.means[p.id] ?? 0).toFixed(2)),
  }));

  const bars = inWeek.map((e) => ({
    date: e.date,
    score: dayScore(e, ids),
    label: formatDate(e.date, { weekday: 'short' }),
  }));

  const dayMax = maxDayScore(ids.length);
  const heatDates = lastNDays(30, end);
  const ratings = Object.fromEntries(entries.map((e) => [e.date, e.ratings]));

  const hasData = week.entries.some((e) => ids.some((id) => (e.ratings[id] ?? 0) > 0));
  const hadPreviousWeek = previous.entries.some((e) =>
    ids.some((id) => (e.ratings[id] ?? 0) > 0),
  );

  return (
    <Shell active="/report">
      <PageTitle
        title="Weekly report"
        subtitle={formatRange(start, end)}
        action={
          <div className="flex gap-2 text-sm">
            <Link
              href={`/report?w=${addDays(start, -7)}`}
              className="rounded-lg bg-ink-800 px-3 py-1.5 text-ink-200 hover:bg-ink-700"
            >
              ← Previous
            </Link>
            {!isCurrentWeek && (
              <Link
                href={`/report?w=${addDays(start, 7)}`}
                className="rounded-lg bg-ink-800 px-3 py-1.5 text-ink-200 hover:bg-ink-700"
              >
                Next →
              </Link>
            )}
          </div>
        }
      />

      {!hasData ? (
        <Card>
          <EmptyState icon="📭" title="Nothing logged this week">
            Rate your pillars on the Today page and this report fills itself in.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Avg stars"
              value={week.overall.toFixed(1)}
              sub={deltaLabel(week.overall, previous.overall, hadPreviousWeek)}
            />
            <StatTile
              label="Balance"
              value={week.balance}
              sub={deltaLabel(week.balance, previous.balance, hadPreviousWeek, 0)}
              accent={week.balance >= 70 ? '#10b981' : '#f59e0b'}
            />
            <StatTile
              label="Full days"
              value={`${week.loggedDays}/7`}
              sub={`all ${ids.length} logged`}
            />
            <StatTile label="Five-star days" value={week.fiveStarDays} sub={`${week.perfectDays} flawless`} accent="#fbbf24" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Balance</CardTitle>
              <CardDescription>This week against last — the shape is the point.</CardDescription>
              <BalanceRadar data={radar} />
            </Card>

            <Card>
              <CardTitle>The write-up</CardTitle>
              <p className="mt-3 text-[15px] leading-relaxed">{narrative.headline}</p>
              {narrative.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="mt-2 text-sm leading-relaxed text-ink-300"
                  dangerouslySetInnerHTML={{ __html: bold(p) }}
                />
              ))}
              {narrative.bullets.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-ink-300">
                  {narrative.bullets.map((b, i) => (
                    <li key={i}>· {b}</li>
                  ))}
                </ul>
              )}
              <p className="mt-4 rounded-lg bg-gold-500/10 px-3 py-2 text-sm text-gold-300">
                {narrative.closing}
              </p>

              <DeepReview
                weekStart={start}
                cached={cachedNarrative}
                available={isAiConfigured}
              />
            </Card>
          </div>

          <Card>
            <CardTitle>Pillar by pillar</CardTitle>
            <div className="mt-3 divide-y divide-[var(--border)]">
              {pillars.map((p) => {
                const mean = week.means[p.id] ?? 0;
                const prev = previous.means[p.id] ?? 0;
                const delta = mean - prev;
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-lg"
                      style={{ background: alpha(p.color, 0.15) }}
                    >
                      {p.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-ink-400">
                        {week.counts[p.id] ?? 0} of 7 days logged
                      </p>
                    </div>
                    <StarDisplay value={Math.round(mean)} color={p.color} />
                    <span className="num w-12 text-right font-semibold">{mean.toFixed(1)}</span>
                    <Chip tone={delta > 0.05 ? 'good' : delta < -0.05 ? 'bad' : 'neutral'}>
                      {delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '—'} {Math.abs(delta).toFixed(1)}
                    </Chip>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Day by day</CardTitle>
              <CardDescription>Total stars out of {dayMax}.</CardDescription>
              <WeekBars data={bars} max={dayMax} />
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-400">
                {week.bestDay && (
                  <Chip tone="good">
                    Best · {formatDate(week.bestDay.date, { weekday: 'long' })} (
                    {week.bestDay.score}/{dayMax})
                  </Chip>
                )}
                {week.hardestDay && (
                  <Chip tone="neutral">
                    Hardest · {formatDate(week.hardestDay.date, { weekday: 'long' })} (
                    {week.hardestDay.score}/{dayMax})
                  </Chip>
                )}
              </div>
            </Card>

            <Card>
              <CardTitle>Next week</CardTitle>
              <CardDescription>Where the cheapest points are.</CardDescription>
              {focus && (
                <div
                  className="mt-3 rounded-xl p-4"
                  style={{ background: alpha(focus.pillar.color, 0.1), border: `1px solid ${alpha(focus.pillar.color, 0.3)}` }}
                >
                  <p className="text-2xl">{focus.pillar.icon}</p>
                  <p className="mt-1 font-semibold">{focus.pillar.name}</p>
                  <p className="mt-1 text-sm text-ink-300">
                    {focus.count === 0
                      ? 'Not logged once this week. Anything above zero is progress.'
                      : `Averaged ${focus.mean.toFixed(1)}★ across ${focus.count} ${focus.count === 1 ? 'day' : 'days'}. Target 4★ on four days.`}
                  </p>
                </div>
              )}
              {quests.length > 0 && (
                <div className="mt-3 space-y-2">
                  {quests.map((q) => (
                    <div key={q.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink-300">{q.title}</span>
                      <Chip tone={q.status === 'completed' ? 'good' : 'neutral'}>
                        {q.progress}/{q.target_count}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <CardTitle>Last thirty days</CardTitle>
            <CardDescription>Every pillar, every day. Gaps show up as dark rows.</CardDescription>
            <div className="mt-3">
              <Heatmap dates={heatDates} pillars={pillars} ratings={ratings} />
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}

/** A delta against a week that was never logged is not a delta — showing
 *  "▲ 4.8 vs last week" for a first-ever week overstates the achievement. */
function deltaLabel(
  current: number,
  previous: number,
  hasPrevious: boolean,
  digits = 1,
): string {
  if (!hasPrevious) return 'first week of data';
  const d = current - previous;
  if (Math.abs(d) < (digits === 0 ? 1 : 0.05)) return 'flat vs last week';
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(digits)} vs last week`;
}

/** The narrative marks pillar names with `**` — the only markup it emits. */
function bold(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-ink-50">$1</strong>');
}
