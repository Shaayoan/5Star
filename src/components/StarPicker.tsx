'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { StarRating } from '@/lib/types';

const LABELS = ['Not logged', 'Rough', 'Below par', 'Solid', 'Strong', 'Exceptional'];

export function StarPicker({
  value,
  onChange,
  color = 'var(--color-gold-500)',
  size = 'md',
  disabled,
  showLabel = true,
}: {
  value: StarRating;
  onChange: (v: StarRating) => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const dims = { sm: 'h-6 w-6 text-lg', md: 'h-9 w-9 text-2xl', lg: 'h-11 w-11 text-3xl' }[size];

  return (
    <div className="flex items-center gap-2">
      <div className="flex" onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''} — ${LABELS[n]}`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            // Tapping the current rating clears it, which is the only way to
            // undo an accidental log without a separate control.
            onClick={() => onChange((value === n ? 0 : n) as StarRating)}
            className={cn(
              'grid place-items-center rounded-md leading-none transition-transform',
              'disabled:pointer-events-none hover:scale-110 active:scale-95',
              dims,
            )}
            style={{ color: n <= shown ? color : 'var(--color-ink-600)' }}
          >
            {n <= shown ? '★' : '☆'}
          </button>
        ))}
      </div>
      {showLabel && (
        <span className="text-xs text-ink-400 min-w-[5.5rem]">{LABELS[shown] ?? ''}</span>
      )}
    </div>
  );
}

/** Read-only star row for reports and history. */
export function StarDisplay({
  value,
  color = 'var(--color-gold-500)',
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <span className={cn('tracking-tight', className)} aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= value ? color : 'var(--color-ink-700)' }}>
          ★
        </span>
      ))}
    </span>
  );
}
