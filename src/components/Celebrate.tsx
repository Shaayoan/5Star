'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BADGES_BY_KEY } from '@/lib/game';
import { Burst } from '@/components/ui/Motion';
import { cn } from '@/lib/utils';

/**
 * Celebrations for the things worth celebrating: a badge, a five-star day, a
 * level-up. Deliberately a queue rather than a stack — three toasts fighting for
 * attention is worse than one at a time, and the whole point is that each one
 * lands.
 */

export type CelebrationTone = 'badge' | 'star' | 'level' | 'quest';

export interface Celebration {
  id: number;
  tone: CelebrationTone;
  icon: string;
  title: string;
  detail?: string;
}

interface CelebrateApi {
  celebrate: (c: Omit<Celebration, 'id'>) => void;
  celebrateBadges: (keys: string[]) => void;
}

const Ctx = createContext<CelebrateApi | null>(null);

export const useCelebrate = () => {
  const api = useContext(Ctx);
  if (!api) throw new Error('useCelebrate must be used inside <CelebrateProvider>');
  return api;
};

const TONES: Record<CelebrationTone, { ring: string; glow: string }> = {
  badge: { ring: 'ring-violet-400/50', glow: 'rgba(167,139,250,0.28)' },
  star: { ring: 'ring-gold-500/60', glow: 'rgba(245,158,11,0.32)' },
  level: { ring: 'ring-cyan-400/50', glow: 'rgba(34,211,238,0.28)' },
  quest: { ring: 'ring-emerald-400/50', glow: 'rgba(16,185,129,0.28)' },
};

let nextId = 1;

export function CelebrateProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Celebration[]>([]);
  const current = queue[0];

  const celebrate = useCallback((c: Omit<Celebration, 'id'>) => {
    setQueue((q) => [...q, { ...c, id: nextId++ }]);
  }, []);

  const celebrateBadges = useCallback(
    (keys: string[]) => {
      for (const key of keys) {
        const def = BADGES_BY_KEY[key];
        if (!def) continue;
        celebrate({
          tone: 'badge',
          icon: def.icon,
          title: def.name,
          detail: `${def.description} +${def.xp} XP`,
        });
      }
    },
    [celebrate],
  );

  // Each celebration holds the stage for a moment, then the next one steps up.
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 3400);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <Ctx.Provider value={{ celebrate, celebrateBadges }}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
        aria-live="polite"
      >
        {current && (
          <div
            key={current.id}
            className={cn(
              'animate-slide-in card pointer-events-auto relative flex items-center gap-3 px-4 py-3 ring-1',
              TONES[current.tone].ring,
            )}
            style={{ boxShadow: `0 0 40px -8px ${TONES[current.tone].glow}` }}
            role="status"
          >
            <Burst trigger={current.id} />
            <span className="animate-pop text-2xl">{current.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{current.title}</p>
              {current.detail && (
                <p className="text-xs text-ink-400">{current.detail}</p>
              )}
            </div>
            {queue.length > 1 && (
              <span className="num ml-2 shrink-0 rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-ink-300">
                +{queue.length - 1}
              </span>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
