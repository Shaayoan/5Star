'use client';

import { useState, useTransition } from 'react';
import {
  addMicroAction,
  addPillar,
  archivePillar,
  deleteMicroAction,
  startNewSeason,
  updatePillar,
  type PillarPick,
} from '@/lib/actions';
import type { MicroAction, UserPillar } from '@/lib/types';
import { PILLAR_COLORS, PILLAR_ICONS, PILLAR_TEMPLATES } from '@/lib/catalog';
import { MAX_PILLARS, MIN_PILLARS } from '@/lib/game/constants';
import { Button, Card, Chip } from '@/components/ui';
import { PillarPicker } from '@/app/onboarding/PillarPicker';
import { alpha, cn } from '@/lib/utils';

export function PillarManager({
  pillars,
  actions,
  stats,
}: {
  pillars: UserPillar[];
  actions: MicroAction[];
  stats: Record<string, { level: number; xp: number; streak: number; avg30: number }>;
}) {
  const [reseasoning, setReseasoning] = useState(false);

  if (reseasoning) {
    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Start a new season</h2>
            <p className="text-sm text-ink-400">
              Your current pillars are archived with their history intact. New pillars start at
              level 1.
            </p>
          </div>
          <Button variant="ghost" onClick={() => setReseasoning(false)}>
            Cancel
          </Button>
        </div>
        <PillarPicker
          onSubmit={startNewSeason as (p: PillarPick[]) => Promise<void>}
          submitLabel="Begin the new season"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {pillars.map((p) => (
        <PillarEditor
          key={p.id}
          pillar={p}
          actions={actions.filter((a) => a.user_pillar_id === p.id)}
          stat={stats[p.id]}
          canArchive={pillars.length > MIN_PILLARS}
        />
      ))}

      <AddPillar taken={pillars.map((p) => p.template_key).filter(Boolean) as string[]} count={pillars.length} />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Priorities shifted?</p>
          <p className="text-sm text-ink-400">
            Swap your pillars and start a fresh season. Old seasons stay in your history.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setReseasoning(true)}>
          Re-pick my pillars
        </Button>
      </Card>
    </div>
  );
}

/**
 * Grows the season by one pillar. Deliberately a separate affordance from
 * re-picking: adding keeps every streak and every XP total intact, where
 * re-picking starts everything over.
 */
function AddPillar({ taken, count }: { taken: string[]; count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remaining = PILLAR_TEMPLATES.filter((t) => !taken.includes(t.key));
  const atCeiling = count >= MAX_PILLARS;

  const add = (pick: PillarPick) =>
    startTransition(async () => {
      setError(null);
      try {
        await addPillar(pick);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add that pillar');
      }
    });

  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Need another axis?</p>
          <p className="text-sm text-ink-400">
            {atCeiling
              ? `You are at the ${MAX_PILLARS}-pillar ceiling. Retire one to make room.`
              : // Only 6th–10th are reachable, so "th" is always the right suffix.
                `Add a ${count + 1}th pillar without losing any history — it joins the tree as a new branch.`}
          </p>
        </div>
        <Button variant="secondary" disabled={atCeiling} onClick={() => setOpen(true)}>
          Add a pillar
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Add a pillar</h2>
          <p className="text-sm text-ink-400">
            It starts at level 1 with no logs. Everything else keeps running.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {remaining.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={pending}
            onClick={() =>
              add({
                templateKey: t.key,
                name: t.name,
                icon: t.icon,
                color: t.color,
                definition: t.definition,
                actions: t.suggestedActions.slice(0, 4),
              })
            }
            className="card card-hover p-4 text-left disabled:opacity-50"
            style={{ borderColor: alpha(t.color, 0.3) }}
          >
            <span className="text-2xl">{t.icon}</span>
            <p className="mt-2 font-semibold">{t.name}</p>
            <p className="text-xs text-ink-400">{t.tagline}</p>
          </button>
        ))}

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            add({
              templateKey: null,
              name: `Pillar ${count + 1}`,
              icon: PILLAR_ICONS[(count * 3) % PILLAR_ICONS.length],
              color: PILLAR_COLORS[(count * 3) % PILLAR_COLORS.length],
              definition: 'Describe what a good day looks like here.',
              actions: [],
            })
          }
          className="card card-hover grid place-items-center p-4 text-sm text-ink-300 disabled:opacity-50"
        >
          <span>
            <span className="mr-1 text-lg">＋</span> Blank custom pillar
          </span>
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}
    </Card>
  );
}

function PillarEditor({
  pillar,
  actions,
  stat,
  canArchive,
}: {
  pillar: UserPillar;
  actions: MicroAction[];
  stat?: { level: number; xp: number; streak: number; avg30: number };
  canArchive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(pillar.name);
  const [icon, setIcon] = useState(pillar.icon);
  const [color, setColor] = useState(pillar.color);
  const [definition, setDefinition] = useState(pillar.definition);
  const [newLabel, setNewLabel] = useState('');
  const [newXp, setNewXp] = useState(5);
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== pillar.name ||
    icon !== pillar.icon ||
    color !== pillar.color ||
    definition !== pillar.definition;

  const save = () =>
    startTransition(async () => {
      await updatePillar(pillar.id, { name, icon, color, definition });
    });

  const field =
    'rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2 text-sm outline-none';

  return (
    <Card style={{ borderColor: alpha(color, 0.3) }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          className="grid h-11 w-11 place-items-center rounded-xl text-xl"
          style={{ background: alpha(color, 0.15), border: `1px solid ${alpha(color, 0.3)}` }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{name}</p>
          <p className="truncate text-xs text-ink-400">{definition || 'No definition yet'}</p>
        </div>
        {stat && (
          <div className="hidden gap-1.5 sm:flex">
            <Chip tone="neutral">Lv {stat.level}</Chip>
            <Chip tone="neutral">{stat.xp.toLocaleString()} XP</Chip>
            <Chip tone="neutral">{stat.avg30.toFixed(1)}★ / 30d</Chip>
            {stat.streak > 0 && <Chip tone="gold">🔥 {stat.streak}</Chip>}
          </div>
        )}
        <span className="text-ink-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              aria-label="Icon"
              className={cn(field, 'text-xl')}
            >
              {[...new Set([icon, ...PILLAR_ICONS])].map((ic) => (
                <option key={ic} value={ic}>
                  {ic}
                </option>
              ))}
            </select>
            <input
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              aria-label="Name"
              className={cn(field, 'min-w-0 flex-1 font-semibold')}
            />
            <div className="flex items-center gap-1">
              {PILLAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  className={cn('h-5 w-5 rounded-full', color === c && 'scale-125 ring-2 ring-white/60')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label-xs">What counts as a good day</label>
            <textarea
              value={definition}
              maxLength={160}
              rows={2}
              onChange={(e) => setDefinition(e.target.value)}
              className={cn(field, 'mt-1 w-full resize-none')}
            />
          </div>

          <div>
            <p className="label-xs mb-2">Quick-log actions</p>
            <div className="flex flex-wrap gap-1.5">
              {actions.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1 text-xs"
                >
                  {a.label}
                  <span className="text-ink-400">+{a.xp_value}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.label}`}
                    onClick={() => startTransition(() => deleteMicroAction(a.id))}
                    className="text-ink-400 hover:text-rose-400"
                  >
                    ×
                  </button>
                </span>
              ))}
              {actions.length === 0 && (
                <span className="text-xs text-ink-400">None yet — add one below.</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={newLabel}
                maxLength={60}
                placeholder="e.g. Cold shower"
                onChange={(e) => setNewLabel(e.target.value)}
                className={cn(field, 'min-w-0 flex-1')}
              />
              <input
                type="number"
                min={1}
                max={25}
                value={newXp}
                onChange={(e) => setNewXp(Number(e.target.value))}
                aria-label="XP value"
                className={cn(field, 'w-20')}
              />
              <Button
                variant="secondary"
                disabled={!newLabel.trim() || pending}
                onClick={() =>
                  startTransition(async () => {
                    await addMicroAction(pillar.id, newLabel, newXp);
                    setNewLabel('');
                  })
                }
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {canArchive ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => archivePillar(pillar.id))}
                className="text-xs text-ink-400 hover:text-rose-400 disabled:opacity-50"
              >
                Retire this pillar
              </button>
            ) : (
              <span className="text-xs text-ink-400">
                A season needs at least {MIN_PILLARS} pillars.
              </span>
            )}

            {dirty && (
              <Button onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
