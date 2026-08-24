import { requireUser } from '@/lib/auth';
import { getBadges } from '@/lib/queries';
import { BADGES } from '@/lib/game';
import { BadgeGrid } from '@/components/Gamification';
import { Card, StatTile } from '@/components/ui';
import { PageTitle, Shell } from '@/components/Shell';

export default async function BadgesPage() {
  const { db, user } = await requireUser();
  const rows = await getBadges(db, user.id);

  const earned = new Set(rows.map((r) => r.badge_key));
  const earnedAt = Object.fromEntries(rows.map((r) => [r.badge_key, r.earned_at]));
  const xpEarned = BADGES.filter((b) => earned.has(b.key)).reduce((s, b) => s + b.xp, 0);

  return (
    <Shell active="/badges">
      <PageTitle
        title="Badges"
        subtitle={`${earned.size} of ${BADGES.length} unlocked`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Unlocked" value={`${earned.size}/${BADGES.length}`} />
        <StatTile label="Badge XP" value={xpEarned.toLocaleString()} accent="#fbbf24" />
        <StatTile
          label="Latest"
          value={rows[0] ? BADGES.find((b) => b.key === rows[0].badge_key)?.icon ?? '—' : '—'}
          sub={rows[0] ? new Date(rows[0].earned_at).toLocaleDateString() : 'none yet'}
        />
      </div>

      <Card className="p-4">
        <BadgeGrid earned={earned} earnedAt={earnedAt} />
      </Card>
    </Shell>
  );
}
