'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dayLabel } from '@/lib/dates';
import type { IsoDate } from '@/lib/types';

const AXIS = { fill: 'var(--color-ink-400)', fontSize: 11 };

const tooltipStyle = {
  contentStyle: {
    background: 'var(--color-ink-850)',
    border: '1px solid var(--color-ink-600)',
    borderRadius: 10,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--color-ink-200)' },
} as const;

/* ------------------------------------------------------------ Radar ------ */

export interface RadarDatum {
  pillar: string;
  icon: string;
  current: number;
  previous: number;
}

/** The signature view: five axes, one shape. Imbalance is visible instantly. */
export function BalanceRadar({ data, showPrevious = true }: { data: RadarDatum[]; showPrevious?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--color-ink-700)" />
        <PolarAngleAxis
          dataKey="pillar"
          tick={({ payload, x, y, textAnchor }) => (
            <text x={x} y={y} textAnchor={textAnchor} fill="var(--color-ink-300)" fontSize={11}>
              {payload.value}
            </text>
          )}
        />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={AXIS} stroke="var(--color-ink-700)" />
        {showPrevious && (
          <Radar
            name="Last week"
            dataKey="previous"
            stroke="var(--color-ink-400)"
            fill="var(--color-ink-400)"
            fillOpacity={0.12}
            strokeDasharray="4 3"
          />
        )}
        <Radar
          name="This week"
          dataKey="current"
          stroke="var(--color-gold-500)"
          fill="var(--color-gold-500)"
          fillOpacity={0.32}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-ink-400)' }} />
        <Tooltip {...tooltipStyle} formatter={(v) => `${Number(v).toFixed(1)}★`} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------- Daily bar chart -- */

export interface DayDatum {
  date: IsoDate;
  score: number;
  label: string;
}

/** Day-by-day total (0–25). Full days are gold, partial days muted, so a
 *  half-logged day never looks like a bad day. */
export function WeekBars({ data, max = 25 }: { data: DayDatum[]; max?: number }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
        <CartesianGrid vertical={false} stroke="var(--color-ink-800)" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis domain={[0, max]} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => `${v}/${max}`}
          cursor={{ fill: 'var(--color-ink-800)' }}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.date}
              fill={d.score >= max * 0.8 ? 'var(--color-gold-500)' : d.score > 0 ? 'var(--color-gold-600)' : 'var(--color-ink-700)'}
              fillOpacity={d.score >= max * 0.8 ? 1 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------------- Heatmap -- */

/** Thirty-day grid, one column per pillar. Reads like a contact sheet of the
 *  month: vertical stripes are strong pillars, horizontal ones are strong days. */
export function Heatmap({
  dates,
  pillars,
  ratings,
}: {
  dates: IsoDate[];
  pillars: { id: string; icon: string; name: string; color: string }[];
  ratings: Record<string, Record<string, number>>;
}) {
  // One column per pillar, so the grid grows when a sixth or seventh is added.
  const columns = `3rem repeat(${pillars.length}, minmax(1.25rem, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${180 + pillars.length * 48}px` }}>
        <div className="mb-1 grid gap-1 text-center" style={{ gridTemplateColumns: columns }}>
          <span />
          {pillars.map((p) => (
            <span key={p.id} title={p.name} className="text-sm">
              {p.icon}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {dates.map((d) => (
            <div
              key={d}
              className="grid items-center gap-1"
              style={{ gridTemplateColumns: columns }}
            >
              <span className="text-[10px] text-ink-400">
                {dayLabel(d)} {d.slice(8)}
              </span>
              {pillars.map((p) => {
                const v = ratings[d]?.[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    title={`${p.name} · ${d} · ${v || '—'}`}
                    className="h-4 rounded-[3px]"
                    style={{
                      background: v === 0 ? 'var(--color-ink-800)' : p.color,
                      opacity: v === 0 ? 1 : 0.25 + (v / 5) * 0.75,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
