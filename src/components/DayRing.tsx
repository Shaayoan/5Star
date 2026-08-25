import type { StarRating } from '@/lib/types';

interface RingPillar {
  id: string;
  color: string;
}

/**
 * One day, drawn as a segmented ring — one arc per pillar, each filled in
 * proportion to that day's rating.
 *
 * A single heat-coloured square would collapse the day to "good" or "bad",
 * which throws away the only thing this app is actually about. The ring keeps
 * the shape of the day visible: four full arcs and one stub reads instantly as
 * "strong day, one pillar dropped".
 */
export function DayRing({
  pillars,
  ratings,
  size = 30,
}: {
  pillars: RingPillar[];
  ratings: Record<string, StarRating>;
  size?: number;
}) {
  const n = pillars.length;
  if (n === 0) return null;

  const stroke = Math.max(2.5, size * 0.11);
  const radius = (size - stroke) / 2;
  const centre = size / 2;
  const circumference = 2 * Math.PI * radius;

  // A hairline gap keeps adjacent arcs from reading as one continuous ring.
  const gap = n > 1 ? Math.min(3, circumference * 0.02) : 0;
  const segment = circumference / n - gap;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g transform={`rotate(-90 ${centre} ${centre})`}>
        {pillars.map((p, i) => {
          const value = ratings[p.id] ?? 0;
          const offset = -(i * (segment + gap));
          const filled = (value / 5) * segment;

          return (
            <g key={p.id}>
              {/* the track: shows the day's full shape even when unlogged */}
              <circle
                cx={centre}
                cy={centre}
                r={radius}
                fill="none"
                stroke="var(--color-ink-700)"
                strokeWidth={stroke}
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
              {value > 0 && (
                <circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${filled} ${circumference - filled}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  opacity={0.45 + (value / 5) * 0.55}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
