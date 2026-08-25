'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

/* --------------------------------------------------------- reduced motion -- */

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Reads the OS setting without an effect, so it never triggers a second
 *  render, and returns `false` during SSR to keep hydration stable. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/* ------------------------------------------------------- AnimatedNumber -- */

/**
 * Counts up to `value` instead of snapping. Small touch, but it is what makes
 * XP feel earned rather than merely displayed.
 */
export function AnimatedNumber({
  value,
  digits = 0,
  duration = 700,
  className,
  suffix = '',
}: {
  value: number;
  digits?: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number>(undefined);

  useEffect(() => {
    // No synchronous setState here: when motion is off the render path below
    // uses `value` directly, so the effect has nothing to do.
    if (reduced) {
      from.current = value;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic: quick to begin with, settles gently on the final number.
      setShown(origin + delta * (1 - (1 - t) ** 3));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, duration, reduced]);

  return (
    <span className={cn('num tabular-nums', className)}>
      {(reduced ? value : shown).toFixed(digits)}
      {suffix}
    </span>
  );
}

/* ---------------------------------------------------------- ProgressRing -- */

/**
 * Circular progress. Reads as a game HUD element in a way a flat bar never
 * does, and it sweeps to its value on mount.
 */
export function ProgressRing({
  progress,
  size = 96,
  stroke = 8,
  color = 'var(--color-gold-500)',
  track = 'var(--color-ink-700)',
  children,
  className,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            // Custom properties drive the sweep so the keyframe stays generic.
            ['--dash-from' as string]: `${circumference}`,
            ['--dash-to' as string]: `${circumference * (1 - clamped)}`,
            strokeDashoffset: circumference * (1 - clamped),
            animation: 'ring-sweep 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Burst -- */

const CONFETTI_COLORS = ['#fbbf24', '#f97316', '#22d3ee', '#a855f7', '#10b981', '#ec4899'];

/**
 * A short confetti burst. Stateless by design: bumping `trigger` remounts the
 * pieces via `key`, the CSS animation plays once and leaves them at opacity 0.
 * No timers, no state, nothing to clean up.
 */
export function Burst({ trigger, count = 18 }: { trigger: number; count?: number }) {
  const reduced = useReducedMotion();
  if (trigger === 0 || reduced) return null;

  return (
    <div
      key={trigger}
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-[2px]"
            style={{
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              ['--dx' as string]: `${Math.cos(angle) * (60 + (i % 5) * 14)}px`,
              ['--spin' as string]: `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
              animation: `confetti-fall ${900 + (i % 4) * 140}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- XpFloat -- */

/** The "+40 XP" that lifts off a pillar when you rate it. */
export function XpFloat({ amount, id }: { amount: number; id: number }) {
  if (!amount) return null;
  return (
    <span
      key={id}
      className="animate-float-up pointer-events-none absolute left-1/2 top-0 z-10 text-sm font-bold text-gold-400"
      aria-hidden="true"
    >
      +{amount} XP
    </span>
  );
}
