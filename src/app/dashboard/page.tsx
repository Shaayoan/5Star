import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ensureWeeklyQuests } from '@/lib/engine';
import { requireUser } from '@/lib/auth';
import { formatDate, lastNDays } from '@/lib/dates';
import { getDashboardData } from '@/lib/queries';
import { dayScore, maxDayScore } from '@/lib/game';
import { Card, CardTitle, EmptyState, StatTile } from '@/components/ui';
import { CheckIn } from '@/components/CheckIn';
import { WeekBars } from '@/components/Charts';
import { HumanLevelCard, QuestCard, RankPill, StreakCard } from '@/components/Gamification';
import { LifeTree } from '@/components/LifeTree';
import { PageTitle, Shell } from '@/components/Shell';

export default async function DashboardPage() {
  const { db, user } = await requireUser();
  const data = await getDashboardData(db, user.id);

  if (data.pillars.length === 0) redirect('/onboarding');

  // Idempotent — creates this week's quests the first time the dashboard is
  // opened after Monday, and does nothing on every later visit.
  const quests = data.quests.length ? data.quests : await ensureWeeklyQuests(db, user.id);

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
        title={`Today · ${formatDate(data.today, { weekday: 'long', month: 'long', day: 'numeric' })}`}
        subtitle={
          loggedToday === ids.length
            ? `All ${ids.length} logged. The week is yours to lose.`
            : `${loggedToday} of ${ids.length} pillars logged.`
        }
        action={
          <Link href="/report" className="text-sm text-gold-400 hover:underline">
            {'This week’s report →'}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
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

          <Card>
            <CardTitle>Last seven days</CardTitle>
            <WeekBars data={bars} max={maxDayScore(ids.length)} />
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
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

        <aside className="space-y-4">
          <HumanLevelCard
            level={data.human.level}
            progress={data.human.progress}
            xpIntoLevel={data.human.xpIntoLevel}
            xpForNextLevel={data.human.xpForNextLevel}
            totalXp={data.human.xp}
          />

          <RankPill rank={data.rank} />

          <StreakCard
            checkIn={data.checkIn.current}
            best={data.checkIn.best}
            atRisk={data.checkIn.atRisk}
            freezes={data.profile?.freezes_available ?? 0}
            starDays={data.starDays.current}
          />

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Balance"
              value={data.week.balance}
              sub="7-day evenness"
              accent={data.week.balance >= 70 ? '#10b981' : '#f59e0b'}
            />
            <StatTile
              label="Avg stars"
              value={data.week.overall.toFixed(1)}
              sub="this week"
            />
          </div>

          <Card className="p-2">
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
        </aside>
      </div>
    </Shell>
  );
}
