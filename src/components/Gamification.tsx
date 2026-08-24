import { BADGES, type BadgeDefinition } from '@/lib/game';
import type { Quest } from '@/lib/types';
import type { RankResult } from '@/lib/game/levels';
import { Card, CardTitle, Chip, EmptyState, Progress } from '@/components/ui';
import { alpha, cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Rank -- */

export function RankPill({ rank }: { rank: RankResult }) {
  const { rank: r, next, progress, daysToRank } = rank;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-xs">Rank</p>
          <p className="text-xl font-bold" style={{ color: r.color }}>
            {r.name}
          </p>
        </div>
        <div
          className="grid h-12 w-12 place-items-center rounded-full text-xl"
          style={{ background: alpha(r.color, 0.15), border: `1px solid ${alpha(r.color, 0.35)}` }}
        >
          ★
        </div>
      </div>

      <Progress value={progress} color={r.color} height={6} />

      <p className="text-xs text-ink-400">
        {r.key === 'unranked'
          ? `${daysToRank} more logged ${daysToRank === 1 ? 'day' : 'days'} to get ranked.`
          : next
            ? `${rank.meanStars.toFixed(2)}★ average — ${next.floor.toFixed(1)}★ reaches ${next.name}.`
            : `${rank.meanStars.toFixed(2)}★ average. Top rank held.`}
      </p>
    </Card>
  );
}

/* ---------------------------------------------------------------- Quests -- */

export function QuestCard({ quest, color }: { quest: Quest; color?: string }) {
  const pct = Math.min(1, quest.progress / Math.max(1, quest.target_count));
  const done = quest.status === 'completed';
  const tint = color ?? 'var(--color-gold-500)';

  return (
    <div
      className={cn('card p-4', done && 'border-emerald-500/40')}
      style={!done ? { borderColor: alpha(tint, 0.3) } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-xs">{quest.kind === 'focus' ? 'Focus quest' : 'Balance quest'}</p>
          <p className="mt-0.5 font-semibold">{quest.title}</p>
        </div>
        <Chip tone={done ? 'good' : 'gold'}>{done ? 'Complete' : `+${quest.xp_reward} XP`}</Chip>
      </div>

      <p className="mt-2 text-sm text-ink-300">{quest.description}</p>

      <div className="mt-3 flex items-center gap-3">
        <Progress value={pct} color={done ? '#10b981' : tint} height={6} />
        <span className="num shrink-0 text-xs text-ink-400">
          {quest.progress}/{quest.target_count}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Badges -- */

const TIER_COLOR: Record<BadgeDefinition['tier'], string> = {
  bronze: '#b45309',
  silver: '#94a3b8',
  gold: '#eab308',
  legend: '#a855f7',
};

export function BadgeGrid({
  earned,
  earnedAt,
  compact = false,
}: {
  earned: Set<string>;
  earnedAt?: Record<string, string>;
  compact?: boolean;
}) {
  const list = compact ? BADGES.filter((b) => earned.has(b.key)) : BADGES;

  if (compact && list.length === 0) {
    return <EmptyState icon="🏅" title="No badges yet">Log a day to open your first one.</EmptyState>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {list.map((b) => {
        const has = earned.has(b.key);
        const color = TIER_COLOR[b.tier];
        return (
          <div
            key={b.key}
            className={cn('card p-3 text-center transition-opacity', !has && 'opacity-45')}
            style={has ? { borderColor: alpha(color, 0.4), background: alpha(color, 0.06) } : undefined}
          >
            <div className="text-2xl" style={{ filter: has ? undefined : 'grayscale(1)' }}>
              {b.icon}
            </div>
            <p className="mt-1 text-sm font-semibold">{b.name}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{b.description}</p>
            {has && earnedAt?.[b.key] && (
              <p className="mt-1 text-[10px] text-ink-400">
                {new Date(earnedAt[b.key]).toLocaleDateString()}
              </p>
            )}
            {!has && <p className="mt-1 text-[10px] text-ink-400">Locked · +{b.xp} XP</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Human level -- */

export function HumanLevelCard({
  level,
  progress,
  xpIntoLevel,
  xpForNextLevel,
  totalXp,
}: {
  level: number;
  progress: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  totalXp: number;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="label-xs">Human level</p>
          <p className="num text-3xl font-bold text-gold-400">{level}</p>
        </div>
        <p className="num text-xs text-ink-400">{totalXp.toLocaleString()} XP total</p>
      </div>
      <Progress value={progress} className="mt-3" />
      <p className="num mt-1 text-xs text-ink-400">
        {xpIntoLevel} / {xpForNextLevel} XP to level {level + 1}
      </p>
    </Card>
  );
}

/* --------------------------------------------------------------- Streaks -- */

export function StreakCard({
  checkIn,
  best,
  atRisk,
  freezes,
  starDays,
}: {
  checkIn: number;
  best: number;
  atRisk: boolean;
  freezes: number;
  starDays: number;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="label-xs">Check-in streak</p>
          <p className="num text-3xl font-bold">
            {checkIn}
            <span className="ml-1 text-base font-normal text-ink-400">
              {checkIn === 1 ? 'day' : 'days'}
            </span>
          </p>
        </div>
        <span className="text-2xl">{checkIn > 0 ? '🔥' : '🕯️'}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip tone="neutral">Best {best}</Chip>
        <Chip tone="neutral">⭐ {starDays} star-day streak</Chip>
        {freezes > 0 && <Chip tone="good">🧊 {freezes} freeze{freezes > 1 ? 's' : ''}</Chip>}
      </div>

      {atRisk && checkIn > 0 && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Today is not logged yet — the streak ends at midnight.
        </p>
      )}
    </Card>
  );
}

export function BadgeToast({ keys }: { keys: string[] }) {
  if (keys.length === 0) return null;
  return (
    <Card className="border-gold-500/40 bg-gold-500/5">
      <CardTitle>New badges</CardTitle>
      <div className="mt-2 flex flex-wrap gap-2">
        {keys.map((k) => (
          <Chip key={k} tone="gold">
            {BADGES.find((b) => b.key === k)?.name ?? k}
          </Chip>
        ))}
      </div>
    </Card>
  );
}
