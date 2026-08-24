'use client';

import { useMemo, useState, useTransition } from 'react';
import { PILLAR_COLORS, PILLAR_ICONS, PILLAR_TEMPLATES } from '@/lib/catalog';
import { MAX_PILLARS, MIN_PILLARS } from '@/lib/game/constants';
import type { PillarPick } from '@/lib/actions';
import { Button, Card, Chip } from '@/components/ui';
import { alpha, cn } from '@/lib/utils';

interface Draft extends PillarPick {
  /** Which suggested actions are switched on. */
  enabled: Record<string, boolean>;
}

const toDraft = (key: string): Draft => {
  const t = PILLAR_TEMPLATES.find((x) => x.key === key)!;
  return {
    templateKey: t.key,
    name: t.name,
    icon: t.icon,
    color: t.color,
    definition: t.definition,
    actions: t.suggestedActions,
    enabled: Object.fromEntries(t.suggestedActions.map((a, i) => [a.label, i < 4])),
  };
};

const customDraft = (n: number): Draft => ({
  templateKey: null,
  name: `Custom pillar ${n}`,
  icon: PILLAR_ICONS[10 + (n % 10)],
  color: PILLAR_COLORS[(n * 3) % PILLAR_COLORS.length],
  definition: 'Describe what a good day looks like here.',
  actions: [],
  enabled: {},
});

export function PillarPicker({
  onSubmit,
  submitLabel = 'Start my season',
  initial = [],
}: {
  onSubmit: (picks: PillarPick[]) => Promise<void>;
  submitLabel?: string;
  initial?: string[];
}) {
  const [step, setStep] = useState<'pick' | 'tune'>('pick');
  const [drafts, setDrafts] = useState<Draft[]>(() => initial.map(toDraft));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedKeys = useMemo(
    () => new Set(drafts.map((d) => d.templateKey).filter(Boolean) as string[]),
    [drafts],
  );

  const toggle = (key: string) => {
    setDrafts((prev) => {
      if (prev.some((d) => d.templateKey === key)) {
        return prev.filter((d) => d.templateKey !== key);
      }
      if (prev.length >= MAX_PILLARS) return prev;
      return [...prev, toDraft(key)];
    });
  };

  const addCustom = () => {
    setDrafts((prev) =>
      prev.length >= MAX_PILLARS ? prev : [...prev, customDraft(prev.length + 1)],
    );
  };

  const enough = drafts.length >= MIN_PILLARS;
  const full = drafts.length >= MAX_PILLARS;

  const patch = (i: number, p: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...p } : d)));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(
          drafts.map((d) => ({
            templateKey: d.templateKey,
            name: d.name.trim().slice(0, 40) || 'Pillar',
            icon: d.icon,
            color: d.color,
            definition: d.definition.trim().slice(0, 160),
            actions: d.actions.filter((a) => d.enabled[a.label]),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your pillars');
      }
    });
  };

  /* ------------------------------------------------------------- step 1 -- */

  if (step === 'pick') {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-300">
            Choose five — that is the shape of the app. Add up to {MAX_PILLARS} if your life
            genuinely has more axes to it.
          </p>
          <Chip tone={enough ? 'gold' : 'neutral'}>
            {drafts.length}/{MIN_PILLARS}
            {drafts.length > MIN_PILLARS ? ` +${drafts.length - MIN_PILLARS}` : ''}
          </Chip>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLAR_TEMPLATES.map((t) => {
            const on = selectedKeys.has(t.key);
            const locked = full && !on;
            return (
              <button
                key={t.key}
                type="button"
                disabled={locked}
                onClick={() => toggle(t.key)}
                className={cn(
                  'card p-4 text-left transition-all',
                  on ? 'ring-2' : 'card-hover',
                  locked && 'cursor-not-allowed opacity-40',
                )}
                style={{
                  borderColor: on ? t.color : undefined,
                  background: on ? alpha(t.color, 0.08) : undefined,
                  ...(on ? { boxShadow: `0 0 0 2px ${alpha(t.color, 0.4)}` } : {}),
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{t.icon}</span>
                  {on && <span style={{ color: t.color }}>✓</span>}
                </div>
                <p className="mt-2 font-semibold">{t.name}</p>
                <p className="text-xs text-ink-400">{t.tagline}</p>
                <p className="mt-2 text-xs leading-snug text-ink-300">{t.definition}</p>
              </button>
            );
          })}

          <button
            type="button"
            onClick={addCustom}
            disabled={full}
            className="card card-hover grid place-items-center p-4 text-sm text-ink-300 disabled:opacity-40"
          >
            <span>
              <span className="mr-1 text-lg">＋</span> Build a custom pillar
            </span>
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {full && (
            <p className="text-xs text-ink-400">
              {MAX_PILLARS} is the ceiling — past that, nothing gets real attention.
            </p>
          )}
          <Button size="lg" disabled={!enough} onClick={() => setStep('tune')}>
            {enough
              ? 'Next — make them yours'
              : `Pick ${MIN_PILLARS - drafts.length} more`}
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- step 2 -- */

  return (
    <div>
      <p className="mb-4 text-sm text-ink-300">
        Define what a good day looks like for each. Be specific — vague pillars get vague scores.
      </p>

      <div className="space-y-3">
        {drafts.map((d, i) => (
          <Card key={i} style={{ borderColor: alpha(d.color, 0.35) }}>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={d.icon}
                onChange={(e) => patch(i, { icon: e.target.value })}
                aria-label="Icon"
                className="rounded-lg border border-[var(--border)] bg-ink-900 px-2 py-2 text-xl"
              >
                {[...new Set([d.icon, ...PILLAR_ICONS])].map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>

              <input
                value={d.name}
                maxLength={40}
                onChange={(e) => patch(i, { name: e.target.value })}
                aria-label="Pillar name"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2 font-semibold outline-none"
              />

              <div className="flex gap-1">
                {PILLAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={() => patch(i, { color: c })}
                    className={cn(
                      'h-5 w-5 rounded-full transition-transform',
                      d.color === c && 'scale-125 ring-2 ring-white/60',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <textarea
              value={d.definition}
              maxLength={160}
              rows={2}
              onChange={(e) => patch(i, { definition: e.target.value })}
              aria-label="What counts as a good day"
              className="mt-3 w-full resize-none rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2 text-sm outline-none"
            />

            {d.actions.length > 0 && (
              <div className="mt-3">
                <p className="label-xs mb-2">Quick-log actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.actions.map((a) => {
                    const on = d.enabled[a.label];
                    return (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() =>
                          patch(i, { enabled: { ...d.enabled, [a.label]: !on } })
                        }
                        className="rounded-full px-3 py-1 text-xs transition-colors"
                        style={{
                          background: on ? alpha(d.color, 0.2) : 'var(--color-ink-800)',
                          color: on ? d.color : 'var(--color-ink-300)',
                          border: `1px solid ${on ? alpha(d.color, 0.4) : 'transparent'}`,
                        }}
                      >
                        {on ? '✓ ' : ''}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={() => setStep('pick')}>
          ← Back
        </Button>
        <Button size="lg" onClick={submit} disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
