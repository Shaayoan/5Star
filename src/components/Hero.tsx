'use client';

import type { RankResult } from '@/lib/game/levels';
import { AnimatedNumber, ProgressRing } from '@/components/ui/Motion';
import { Card, Chip } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * The dashboard's status bar: level, rank, streak and today's completion in one
 * block. Previously these were four separate stacked cards, which buried the
 * numbers that are supposed to make you want to open the app.
 */
export function Hero({
  level,
  levelProgress,
  xpIntoLevel,
  xpForNextLevel,
  totalXp,
  rank,
  streak,
  bestStreak,
  atRisk,
  freezes,
  starDayStreak,
  loggedToday,
  pillarCount,
  balance,
}: {
  level: number;
  levelProgress: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  totalXp: number;
  rank: RankResult;
  streak: number;
  bestStreak: number;
  atRisk: boolean;
  freezes: number;
  starDayStreak: number;
  loggedToday: number;
  pillarCount: number;
  balance: number;
}) {
  const complete = loggedToday === pillarCount && pillarCount > 0;

  return (
    <Card className="relative overflow-hidden p-0">
      {/* A soft aura behind the level ring, tinted by rank. */}
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `${rank.rank.color}22` }}
      />

      <div className="relative grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-4">
          <ProgressRing progress={levelProgress} size={104} stroke={9}>
            <div className="text-center leading-none">
              <p className="label-xs mb-1">Level</p>
              <p className="text-shine text-4xl font-bold">
                <AnimatedNumber value={level} />
              </p>
            </div>
          </ProgressRing>

          <div className="min-w-0">
            <p className="label-xs">Rank</p>
            <p className="text-xl font-bold" style={{ color: rank.rank.color }}>
              {rank.rank.name}
            </p>
            <p className="num mt-1 text-xs text-ink-400">
              <AnimatedNumber value={totalXp} /> XP total
            </p>
            <p className="num text-xs text-ink-400">
              {xpIntoLevel} / {xpForNextLevel} to level {level + 1}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat
            label="Streak"
            value={streak}
            unit={streak === 1 ? 'day' : 'days'}
            icon={streak > 0 ? '🔥' : '🕯️'}
            animateIcon={streak > 0}
            hint={`best ${bestStreak}`}
          />
          <Stat
            label="Star days"
            value={starDayStreak}
            unit="in a row"
            icon="⭐"
            hint={freezes > 0 ? `🧊 ${freezes} freeze${freezes > 1 ? 's' : ''}` : undefined}
          />
          <Stat
            label="Balance"
            value={balance}
            unit="/100"
            icon={balance >= 70 ? '⚖️' : '🪫'}
            hint="7-day evenness"
            accent={balance >= 70 ? '#10b981' : '#f59e0b'}
          />
        </div>
      </div>

      <div
        className={cn(
          'relative flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3',
          complete && 'bg-emerald-500/10',
        )}
      >
        <p className="text-sm">
          {complete ? (
            <span className="font-medium text-emerald-300">
              All {pillarCount} logged today. The week is yours to lose.
            </span>
          ) : (
            <span className="text-ink-300">
              <span className="num font-semibold text-ink-50">
                {loggedToday}/{pillarCount}
              </span>{' '}
              pillars logged today
            </span>
          )}
        </p>

        <div className="flex items-center gap-2">
          {atRisk && streak > 0 && (
            <Chip tone="bad">Streak ends at midnight</Chip>
          )}
          {rank.rank.key === 'unranked' && (
            <Chip tone="neutral">{rank.daysToRank} more days to get ranked</Chip>
          )}
        </div>
      </div>

      {/* Completion bar for the day. */}
      <div className="relative h-1 w-full bg-ink-800">
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pillarCount ? (loggedToday / pillarCount) * 100 : 0}%`,
            background: complete
              ? '#10b981'
              : 'linear-gradient(90deg, var(--color-gold-600), var(--color-gold-400))',
          }}
        />
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  unit,
  icon,
  hint,
  accent,
  animateIcon,
}: {
  label: string;
  value: number;
  unit: string;
  icon: string;
  hint?: string;
  accent?: string;
  animateIcon?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-ink-900/40 px-3 py-2.5">
      <p className="label-xs flex items-center gap-1">
        <span className={cn('text-sm', animateIcon && 'animate-flame')}>{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold" style={accent ? { color: accent } : undefined}>
        <AnimatedNumber value={value} />
        <span className="ml-1 text-xs font-normal text-ink-400">{unit}</span>
      </p>
      {hint && <p className="text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}
