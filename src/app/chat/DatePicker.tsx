'use client';

import { addDays, formatDate } from '@/lib/dates';
import type { IsoDate } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Which day the conversation is logging. Changing it here and the model calling
 * `set_log_date` are the same action from the user's point of view, so both
 * routes end up calling `onChange`.
 */
export function DatePicker({
  date,
  today,
  onChange,
  disabled,
}: {
  date: IsoDate;
  today: IsoDate;
  onChange: (d: IsoDate) => void;
  disabled?: boolean;
}) {
  const shortcuts: { label: string; value: IsoDate }[] = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: addDays(today, -1) },
    { label: formatDate(addDays(today, -2), { weekday: 'short' }), value: addDays(today, -2) },
  ];

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="label-xs">Logging for</p>
        <input
          type="date"
          value={date}
          max={today}
          min={addDays(today, -364)}
          disabled={disabled}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-ink-900/70 px-2 py-1 text-xs outline-none focus:border-gold-500/60"
        />
      </div>

      <p className="mt-1 text-sm font-semibold">
        {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        {date === today && <span className="ml-1.5 text-xs font-normal text-gold-400">today</span>}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {shortcuts.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s.value)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50',
              date === s.value
                ? 'bg-gold-500/20 font-medium text-gold-400 ring-1 ring-gold-500/40'
                : 'bg-ink-800 text-ink-300 hover:text-ink-50',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-ink-400">
        Or just say it — &ldquo;yesterday I ran 8k&rdquo; and it switches day by itself.
      </p>
    </div>
  );
}
