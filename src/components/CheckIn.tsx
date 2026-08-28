'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import { setNote, setStars, toggleMicroAction } from '@/lib/actions';
import type { IsoDate, MicroAction, StarRating } from '@/lib/types';
import { alpha, cn } from '@/lib/utils';
import { Chip } from '@/components/ui';
import { AnimatedNumber, Burst, ProgressRing, XpFloat } from '@/components/ui/Motion';
import { StarPicker } from '@/components/StarPicker';
import { useCelebrate } from '@/components/Celebrate';

export interface CheckInPillar {
  id: string;
  name: string;
  icon: string;
  color: string;
  definition: string;
  level: number;
  levelProgress: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: number;
  todayStars: StarRating;
  todayNote: string | null;
  actions: MicroAction[];
}

export function CheckIn({
  pillars,
  date,
  completedActionIds,
}: {
  pillars: CheckInPillar[];
  date: IsoDate;
  completedActionIds: string[];
}) {
  const [done, setDone] = useState(() => new Set(completedActionIds));

  return (
    <div className="stagger space-y-3">
      {pillars.map((p) => (
        <PillarRow key={p.id} pillar={p} date={date} done={done} setDone={setDone} />
      ))}
    </div>
  );
}

function PillarRow({
  pillar,
  date,
  done,
  setDone,
}: {
  pillar: CheckInPillar;
  date: IsoDate;
  done: Set<string>;
  setDone: (s: Set<string>) => void;
}) {
  const [, startTransition] = useTransition();
  const { celebrate, celebrateBadges } = useCelebrate();

  const [stars, optimisticStars] = useOptimistic(
    pillar.todayStars,
    (_: StarRating, next: StarRating) => next,
  );

  const [noteOpen, setNoteOpen] = useState(Boolean(pillar.todayNote));
  const [note, setLocalNote] = useState(pillar.todayNote ?? '');
  const [xpFloat, setXpFloat] = useState<{ amount: number; id: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const floatId = useRef(0);

  const rated = stars > 0;

  const handleStars = (value: StarRating) => {
    // Show the reward before the round trip — the tap should feel instant.
    if (value > 0) {
      setXpFloat({ amount: value * 10, id: ++floatId.current });
      setBurst((b) => b + 1);
    }

    startTransition(async () => {
      optimisticStars(value);
      const result = await setStars(pillar.id, date, value);

      if (result.perfectDay) {
        celebrate({
          tone: 'star',
          icon: '💎',
          title: 'Flawless day',
          detail: 'Every pillar at 5★ · +100 XP',
        });
      } else if (result.fiveStarDay) {
        celebrate({
          tone: 'star',
          icon: '⭐',
          title: 'Five-star day',
          detail: 'Every pillar at 4★ or better · +50 XP',
        });
      }

      if (result.completedQuests.length > 0) {
        celebrate({
          tone: 'quest',
          icon: '🧭',
          title: 'Quest complete',
          detail: 'Reward added to your XP',
        });
      }

      celebrateBadges(result.newBadges);
    });
  };

  const handleAction = (action: MicroAction) => {
    const adding = !done.has(action.id);
    if (adding) setXpFloat({ amount: action.xp_value, id: ++floatId.current });

    startTransition(async () => {
      const next = new Set(done);
      if (adding) next.add(action.id);
      else next.delete(action.id);
      setDone(next);
      await toggleMicroAction(action.id, date);
    });
  };

  const saveNote = () =>
    startTransition(async () => {
      await setNote(pillar.id, date, note);
    });

  return (
    <div
      className="card card-lift relative p-4"
      style={
        rated
          ? {
              borderColor: alpha(pillar.color, 0.5),
              background: `linear-gradient(135deg, ${alpha(pillar.color, 0.1)}, transparent 60%)`,
              boxShadow: `0 0 30px -14px ${alpha(pillar.color, 0.9)}`,
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {/* The level ring doubles as the pillar's identity badge. */}
          <div className="relative shrink-0">
            <ProgressRing
              progress={pillar.levelProgress}
              size={52}
              stroke={4}
              color={pillar.color}
            >
              <span className="text-xl leading-none">{pillar.icon}</span>
            </ProgressRing>
            <Burst trigger={burst} count={12} />
            {xpFloat && <XpFloat amount={xpFloat.amount} id={xpFloat.id} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold">{pillar.name}</p>
              <Chip tone="neutral" className="shrink-0">
                Lv {pillar.level}
              </Chip>
              {pillar.streak > 0 && (
                <Chip tone="gold" className="shrink-0">
                  <span className="animate-flame">🔥</span> {pillar.streak}
                </Chip>
              )}
            </div>
            <p className="truncate text-xs text-ink-400">{pillar.definition}</p>
            <p className="num mt-0.5 text-[11px] text-ink-400">
              <AnimatedNumber value={pillar.xpIntoLevel} /> / {pillar.xpForNextLevel} XP to level{' '}
              {pillar.level + 1}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <StarPicker value={stars} onChange={handleStars} color={pillar.color} />
        </div>
      </div>

      {pillar.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pillar.actions.map((a) => {
            const isDone = done.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAction(a)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition-all active:scale-95',
                  isDone ? 'font-medium' : 'text-ink-300 hover:text-ink-50',
                )}
                style={{
                  background: isDone ? alpha(pillar.color, 0.2) : 'var(--color-ink-800)',
                  color: isDone ? pillar.color : undefined,
                  border: `1px solid ${isDone ? alpha(pillar.color, 0.45) : 'transparent'}`,
                }}
              >
                {isDone ? '✓ ' : ''}
                {a.label}
                <span className="ml-1 opacity-60">+{a.xp_value}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        {noteOpen ? (
          <textarea
            value={note}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={saveNote}
            rows={2}
            maxLength={280}
            placeholder="What actually happened?"
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-gold-500/50"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="text-xs text-ink-400 transition-colors hover:text-ink-200"
          >
            + Add a note
          </button>
        )}
      </div>
    </div>
  );
}
