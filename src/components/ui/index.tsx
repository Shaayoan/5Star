import * as React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Card -- */

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('card p-5', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-base font-semibold tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-1 text-sm text-ink-300', className)} {...props} />;
}

/* ---------------------------------------------------------------- Button -- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gold-500 text-ink-950 hover:bg-gold-400 font-semibold shadow-[0_6px_20px_-8px_rgba(245,158,11,0.7)]',
  secondary: 'bg-ink-700 text-ink-50 hover:bg-ink-600 border border-[var(--border)]',
  ghost: 'text-ink-200 hover:bg-ink-800 hover:text-ink-50',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ Chip -- */

export function Chip({
  className,
  tone = 'neutral',
  ...props
}: React.ComponentProps<'span'> & { tone?: 'neutral' | 'gold' | 'good' | 'bad' }) {
  const tones = {
    neutral: 'bg-ink-700 text-ink-200',
    gold: 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/30',
    good: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25',
    bad: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------- Progress -- */

export function Progress({
  value,
  color = 'var(--color-gold-500)',
  className,
  height = 8,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-ink-700', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/* ----------------------------------------------------------- Empty state -- */

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-400">{children}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- Stat tile -- */

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="card px-4 py-3">
      <p className="label-xs">{label}</p>
      <p className="num mt-1 text-2xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}
