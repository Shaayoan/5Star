'use client';

import { useState, useTransition } from 'react';
import { generateAiNarrative } from '@/lib/actions';
import type { IsoDate } from '@/lib/types';
import { Button } from '@/components/ui';

/**
 * The AI write-up is opt-in per week rather than automatic: it costs a model
 * call, and it is only worth reading once the week has notes behind it.
 */
export function DeepReview({
  weekStart,
  cached,
  available,
}: {
  weekStart: IsoDate;
  cached: string | null;
  available: boolean;
}) {
  const [text, setText] = useState(cached);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setError(null);
      try {
        setText(await generateAiNarrative(weekStart));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not write the review.');
      }
    });

  if (!available && !text) return null;

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-xs">Deeper review</p>
        {available && (
          <Button size="sm" variant="ghost" onClick={run} disabled={pending}>
            {pending ? 'Reading your notes…' : text ? 'Rewrite' : 'Write it'}
          </Button>
        )}
      </div>

      {text ? (
        <div className="mt-2 space-y-2">
          {text.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink-200">
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-400">
          Reads the notes behind each rating and looks for patterns across the week. Best
          after a few days of logging through the chat.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
