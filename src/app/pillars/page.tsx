import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { getDashboardData } from '@/lib/queries';
import { Card, Chip } from '@/components/ui';
import { PageTitle, Shell } from '@/components/Shell';
import { PillarManager } from './PillarManager';

export default async function PillarsPage() {
  const { db, user } = await requireUser();
  const data = await getDashboardData(db, user.id);
  if (data.pillars.length === 0) redirect('/onboarding');

  const stats = Object.fromEntries(
    data.views.map((v) => [
      v.pillar.id,
      { level: v.level, xp: v.xp, streak: v.streak, avg30: v.avg30 },
    ]),
  );

  const actions = data.views.flatMap((v) => v.actions);

  return (
    <Shell active="/pillars">
      <PageTitle
        title="Your pillars"
        subtitle="Rename them, redefine them, and tune what counts."
        action={
          data.season && (
            <Chip tone="gold">
              {data.season.name} · since {formatDate(data.season.started_on)}
            </Chip>
          )
        }
      />

      <Card className="mb-4 bg-ink-900/40 text-sm text-ink-300">
        A pillar you cannot describe in one sentence is a pillar you will not score honestly.
        Keep each definition concrete enough that a stranger could tell whether you hit it.
      </Card>

      <PillarManager pillars={data.pillars} actions={actions} stats={stats} />
    </Shell>
  );
}
