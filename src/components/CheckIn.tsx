'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { setNote, setStars, toggleMicroAction } from '@/lib/actions';
import type { IsoDate, MicroAction, StarRating } from '@/lib/types';
import { alpha, cn } from '@/lib/utils';
import { Chip, Progress } from '@/components/ui';
import { StarPicker } from '@/components/StarPicker';

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
  const [celebration, setCelebration] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {celebration && (
        <div className="animate-pop-in rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm text-gold-400">
          {celebration}
        </div>
      )}
      {pillars.map((p) => (
        <PillarRow
          key={p.id}
          pillar={p}
          date={date}
          done={done}
          setDone={setDone}
          onCelebrate={setCelebration}
        />
      ))}
    </div>
  );
}

function PillarRow({
  pillar,
  date,
  done,
  setDone,
  onCelebrate,
}: {
  pillar: CheckInPillar;
  date: IsoDate;
  done: Set<string>;
  setDone: (s: Set<string>) => void;
  onCelebrate: (msg: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [stars, optimisticStars] = useOptimistic(
    pillar.todayStars,
    (_: StarRating, next: StarRating) => next,
  );
  const [noteOpen, setNoteOpen] = useState(Boolean(pillar.todayNote));
  const [note, setLocalNote] = useState(pillar.todayNote ?? '');

  const handleStars = (value: StarRating) => {
    startTransition(async () => {
      optimisticStars(value);
      const result = await setStars(pillar.id, date, value);
      if (result.perfectDay) onCelebrate('Flawless day — every pillar at 5★. +100 XP');
      else if (result.fiveStarDay) onCelebrate('Five-star day. +50 XP');
      else if (result.newBadges.length) onCelebrate(`Badge unlocked: ${result.newBadges.join(', ')}`);
      else onCelebrate(null);
    });
  };

  const handleAction = (action: MicroAction) => {
    startTransition(async () => {
      const next = new Set(done);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      setDone(next);
      await toggleMicroAction(action.id, date);
    });
  };

  const saveNote = () => {
    startTransition(async () => {
      await setNote(pillar.id, date, note);
    });
  };

  return (
    <div
      className={cn('card card-hover p-4 transition-opacity', pending && 'opacity-70')}
      style={{
        borderColor: stars > 0 ? alpha(pillar.color, 0.45) : undefined,
        background: stars > 0 ? alpha(pillar.color, 0.05) : undefined,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
            style={{ background: alpha(pillar.color, 0.16), border: `1px solid ${alpha(pillar.color, 0.3)}` }}
          >
            {pillar.icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{pillar.name}</p>
              <Chip tone="neutral" className="shrink-0">
                Lv {pillar.level}
              </Chip>
              {pillar.streak > 0 && (
                <Chip tone="gold" className="shrink-0">
                  🔥 {pillar.streak}
                </Chip>
              )}
            </div>
            <p className="truncate text-xs text-ink-400">{pillar.definition}</p>
          </div>
        </div>

        <StarPicker value={stars} onChange={handleStars} color={pillar.color} disabled={pending} />
      </div>

      <div className="mt-3">
        <Progress value={pillar.levelProgress} color={pillar.color} height={5} />
        <p className="mt-1 text-[11px] text-ink-400 num">
          {pillar.xpIntoLevel} / {pillar.xpForNextLevel} XP to level {pillar.level + 1}
        </p>
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
                  'rounded-full px-3 py-1 text-xs transition-colors',
                  isDone ? 'font-medium' : 'text-ink-300 hover:text-ink-50',
                )}
                style={{
                  background: isDone ? alpha(pillar.color, 0.2) : 'var(--color-ink-800)',
                  color: isDone ? pillar.color : undefined,
                  border: `1px solid ${isDone ? alpha(pillar.color, 0.4) : 'transparent'}`,
                }}
              >
                {isDone ? '✓ ' : ''}
                {a.label}
                <span className="ml-1 text-ink-400">+{a.xp_value}</span>
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
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2 text-sm outline-none placeholder:text-ink-400"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="text-xs text-ink-400 hover:text-ink-200"
          >
            + Add a note
          </button>
        )}
      </div>
    </div>
  );
}
