import { alpha } from '@/lib/utils';

export interface TreeBranch {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** 0–5 mean stars over the window. */
  mean: number;
  streak: number;
}

/**
 * One glance at the week. Each pillar is a branch: its length is that pillar's
 * mean rating and its leaves scale with the streak, so a neglected pillar is
 * visibly bare while the rest of the canopy stays full.
 * Pure SVG, deterministic — no client JS, no layout shift.
 */
export function LifeTree({
  branches,
  vitality,
  className,
}: {
  branches: TreeBranch[];
  /** 0–1, drives the overall glow and ground colour. */
  vitality: number;
  className?: string;
}) {
  const cx = 170;
  const forkY = 150;
  const groundY = 268;

  // The canopy fans wider as pillars are added, so a sixth or seventh branch
  // gets its own space instead of crowding the existing ones.
  const count = branches.length;
  const halfSpread = Math.min(78, 54 + count * 4);
  const angleAt = (i: number) =>
    count <= 1 ? 0 : -halfSpread + (i * (2 * halfSpread)) / (count - 1);

  // Longer branches on a crowded tree would overlap, so they shorten a little.
  const lengthScale = count > 5 ? Math.max(0.78, 1 - (count - 5) * 0.045) : 1;

  return (
    <svg viewBox="0 0 340 290" className={className} role="img" aria-label="Life tree">
      <defs>
        <radialGradient id="tree-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={`rgba(245,158,11,${0.05 + vitality * 0.16})`} />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
        <linearGradient id="trunk" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3f2d1d" />
          <stop offset="100%" stopColor="#6b4a2c" />
        </linearGradient>
      </defs>

      <rect width="340" height="290" fill="url(#tree-glow)" />

      {/* ground */}
      <ellipse
        cx={cx}
        cy={groundY}
        rx={104}
        ry={13}
        fill={`rgba(16,185,129,${0.08 + vitality * 0.22})`}
      />

      {/* trunk */}
      <path
        d={`M ${cx - 13} ${groundY} Q ${cx - 7} ${forkY + 40} ${cx - 5} ${forkY}
            L ${cx + 5} ${forkY} Q ${cx + 7} ${forkY + 40} ${cx + 13} ${groundY} Z`}
        fill="url(#trunk)"
      />

      {branches.map((b, i) => {
        const angle = (angleAt(i) * Math.PI) / 180;
        const health = Math.max(0, Math.min(1, b.mean / 5));
        const length = (34 + health * 78) * lengthScale;

        const tipX = cx + Math.sin(angle) * length;
        const tipY = forkY - Math.cos(angle) * length;
        const midX = cx + Math.sin(angle) * length * 0.45;
        const midY = forkY - Math.cos(angle) * length * 0.62;

        // Leaf count grows with rating, with a bonus for a live streak.
        const leaves = Math.round(health * 5) + Math.min(3, Math.floor(b.streak / 3));
        const bare = b.mean === 0;

        return (
          <g key={b.id}>
            <path
              d={`M ${cx} ${forkY + 4} Q ${midX} ${midY} ${tipX} ${tipY}`}
              stroke={bare ? '#3f3020' : '#5b4029'}
              strokeWidth={3 + health * 2.4}
              strokeLinecap="round"
              fill="none"
              opacity={bare ? 0.45 : 1}
            />

            {Array.from({ length: leaves }).map((_, j) => {
              // Deterministic scatter: same inputs always draw the same canopy.
              const t = 0.55 + (j / Math.max(1, leaves)) * 0.5;
              const wobble = ((j * 37) % 17) - 8;
              const lx = cx + Math.sin(angle) * length * t + wobble;
              const ly = forkY - Math.cos(angle) * length * t + (((j * 23) % 15) - 7);
              return (
                <circle
                  key={j}
                  cx={lx}
                  cy={ly}
                  r={(5.5 + (j % 3)) * lengthScale}
                  fill={b.color}
                  opacity={0.32 + health * 0.5}
                />
              );
            })}

            <text
              x={tipX + Math.sin(angle) * 16}
              y={tipY - Math.cos(angle) * 14}
              textAnchor="middle"
              fontSize={15}
              opacity={bare ? 0.35 : 0.95}
            >
              {b.icon}
            </text>
          </g>
        );
      })}

      {/* Fallen leaves hint at neglect without shouting about it. */}
      {branches
        .filter((b) => b.mean === 0)
        .map((bare, i, all) => (
          <circle
            key={`fallen-${bare.id}`}
            cx={cx + (i - (all.length - 1) / 2) * 26}
            cy={groundY + 2}
            r={4}
            fill={alpha(bare.color, 0.35)}
          />
        ))}
    </svg>
  );
}
