import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ensureWeeklyQuests } from '@/lib/engine';
import { requireUser } from '@/lib/auth';
import { userToday } from '@/lib/userDate';
import { formatDate, greeting, lastNDays } from '@/lib/dates';
import { getDashboardData } from '@/lib/queries';
import { dayScore, maxDayScore } from '@/lib/game';
import { Card, CardTitle, EmptyState, StatTile } from '@/components/ui';
import { CheckIn } from '@/components/CheckIn';
import { WeekBars } from '@/components/Charts';
import { QuestCard } from '@/components/Gamification';
import { Hero } from '@/components/Hero';
import { LifeTree } from '@/components/LifeTree';
import { PageTitle, Shell } from '@/components/Shell';

export default async function DashboardPage() {
  const { db, user } = await requireUser();
  const data = await getDashboardData(db, user.id, await userToday(db, user.id));

  if (data.pillars.length === 0) redirect('/onboarding');

  // Idempotent — creates this week's quests the first time the dashboard is
  // opened after Monday, and does nothing on every later visit.
  const quests = data.quests.length ? data.quests : await ensureWeeklyQuests(db, user.id, data.today);

  const ids = data.pillars.map((p) => p.id);
  const weekDates = lastNDays(7, data.today);
  const byDate = new Map(data.entries.map((e) => [e.date, e]));

  const bars = weekDates.map((d) => {
    const entry = byDate.get(d) ?? { date: d, ratings: {} };
    return { date: d, score: dayScore(entry, ids), label: formatDate(d, { weekday: 'short' }) };
  });

  const loggedToday = data.views.filter((v) => v.todayStars > 0).length;
  const colorFor = (pillarId: string | null) =>
    data.pillars.find((p) => p.id === pillarId)?.color;

  return (
    <Shell active="/dashboard">
      <PageTitle
        title={formatDate(data.today, { weekday: 'long', month: 'long', day: 'numeric' })}
        subtitle={
          data.profile?.display_name
            ? `${greeting(data.profile.timezone)}, ${data.profile.display_name}.`
            : undefined
        }
        action={
          <div className="flex gap-2">
            <Link
              href="/chat"
              className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-ink-200 transition-colors hover:bg-ink-700"
            >
              💬 Talk it through
            </Link>
            <Link
              href="/report"
              className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-gold-400 transition-colors hover:bg-ink-700"
            >
              {'Report →'}
            </Link>
          </div>
        }
      />

      <div className="mb-4 animate-rise">
        <Hero
          level={data.human.level}
          levelProgress={data.human.progress}
          xpIntoLevel={data.human.xpIntoLevel}
          xpForNextLevel={data.human.xpForNextLevel}
          totalXp={data.human.xp}
          rank={data.rank}
          streak={data.checkIn.current}
          bestStreak={data.checkIn.best}
          atRisk={data.checkIn.atRisk}
          freezes={data.profile?.freezes_available ?? 0}
          starDayStreak={data.starDays.current}
          loggedToday={loggedToday}
          pillarCount={ids.length}
          balance={data.week.balance}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <CheckIn
            date={data.today}
            completedActionIds={[...data.completedActionIds]}
            pillars={data.views.map((v) => ({
              id: v.pillar.id,
              name: v.pillar.name,
              icon: v.pillar.icon,
              color: v.pillar.color,
              definition: v.pillar.definition,
              level: v.level,
              levelProgress: v.levelProgress,
              xpIntoLevel: v.xpIntoLevel,
              xpForNextLevel: v.xpForNextLevel,
              streak: v.streak,
              todayStars: v.todayStars,
              todayNote: v.todayNote,
              actions: v.actions,
            }))}
          />

          <Card className="card-lift">
            <CardTitle>Last seven days</CardTitle>
            <WeekBars data={bars} max={maxDayScore(ids.length)} />
          </Card>

          <div className="stagger grid gap-3 sm:grid-cols-2">
            {quests.length === 0 ? (
              <Card className="sm:col-span-2">
                <EmptyState icon="🧭" title="Quests unlock next Monday">
                  Once there is a week of data behind you, 5 Star sets a target on whichever
                  pillar you neglected most.
                </EmptyState>
              </Card>
            ) : (
              quests.map((q) => (
                <QuestCard key={q.id} quest={q} color={colorFor(q.user_pillar_id)} />
              ))
            )}
          </div>
        </div>

        <aside className="stagger min-w-0 space-y-4">
          <Card className="p-2 card-lift">
            <LifeTree
              className="w-full"
              vitality={data.week.overall / 5}
              branches={data.views.map((v) => ({
                id: v.pillar.id,
                name: v.pillar.name,
                icon: v.pillar.icon,
                color: v.pillar.color,
                mean: v.avg7,
                streak: v.streak,
              }))}
            />
            <p className="pb-2 text-center text-xs text-ink-400">
              Your tree this week — bare branches are the pillars going quiet.
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Avg stars"
              value={data.week.overall.toFixed(1)}
              sub="this week"
              accent="#fbbf24"
            />
            <StatTile
              label="Five-star"
              value={data.week.fiveStarDays}
              sub="days this week"
            />
          </div>
        </aside>
      </div>
    </Shell>
  );
}
