'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '@/lib/game/series';
import { seriesDelta } from '@/lib/game/series';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface Metric {
  key: string;
  label: string;
  color: string;
  domain: [number, number];
  /** How the value reads in the ticker — stars get one decimal, scores none. */
  digits: number;
  suffix: string;
  read: (p: SeriesPoint) => number | null;
}

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'ALL', days: Infinity },
] as const;

/**
 * The long view, read like a price chart: pick a measure, pick a window, see
 * whether the line is going up. Every series is a 7-day rolling mean (see
 * lib/game/series.ts) so it shows trend rather than daily noise.
 */
export function TrendChart({
  points,
  pillars,
}: {
  points: SeriesPoint[];
  pillars: { id: string; name: string; icon: string; color: string }[];
}) {
  const metrics = useMemo<Metric[]>(
    () => [
      {
        key: 'balance',
        label: 'Balance',
        color: '#22d3ee',
        domain: [0, 100],
        digits: 0,
        suffix: '',
        read: (p) => p.balance,
      },
      {
        key: 'overall',
        label: 'Avg stars',
        color: 'var(--color-gold-500)',
        domain: [0, 5],
        digits: 1,
        suffix: '★',
        read: (p) => p.overall,
      },
      ...pillars.map((pillar) => ({
        key: pillar.id,
        label: `${pillar.icon} ${pillar.name}`,
        color: pillar.color,
        domain: [0, 5] as [number, number],
        digits: 1,
        suffix: '★',
        read: (p: SeriesPoint) => p.pillars[pillar.id] ?? null,
      })),
    ],
    [pillars],
  );

  const [metricKey, setMetricKey] = useState('balance');
  const [rangeDays, setRangeDays] = useState<number>(90);

  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const visible = useMemo(
    () => (rangeDays === Infinity ? points : points.slice(-rangeDays)),
    [points, rangeDays],
  );

  const data = useMemo(
    () => visible.map((p) => ({ date: p.date, value: metric.read(p) })),
    [visible, metric],
  );

  const { current, change, percent, points: dataPoints } = seriesDelta(visible, metric.read);
  const real = data.map((d) => d.value).filter((v): v is number => v !== null);
  const mean = real.length > 0 ? real.reduce((s, v) => s + v, 0) / real.length : 0;

  const up = change >= 0;
  const trendColor = change === 0 ? 'var(--color-ink-400)' : up ? '#10b981' : '#f43f5e';

  return (
    <div>
      {/* ------------------------------------------------------------ ticker */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">{metric.label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-3xl font-bold" style={{ color: metric.color }}>
              {current.toFixed(metric.digits)}
              {metric.suffix}
            </span>
            {/* A change needs two points to mean anything. */}
            {dataPoints >= 2 && (
              <span className="num text-sm font-medium" style={{ color: trendColor }}>
                {change === 0
                  ? '—'
                  : `${up ? '▲' : '▼'} ${Math.abs(change).toFixed(metric.digits)}`}
                {change !== 0 && Number.isFinite(percent) && percent !== 0 && (
                  <span className="ml-1 text-ink-400">({Math.abs(percent).toFixed(0)}%)</span>
                )}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-400">
            {dataPoints === 0
              ? 'nothing logged in this window'
              : dataPoints < 2
                ? 'not enough history to show a trend yet'
                : `over the last ${
                    rangeDays === Infinity ? 'year' : `${rangeDays} days`
                  } · 7-day average`}
          </p>
        </div>

        <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={cn(
                'num rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                rangeDays === r.days
                  ? 'bg-ink-600 text-ink-50'
                  : 'text-ink-400 hover:text-ink-100',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- chart */}
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
            <defs>
              <linearGradient id={`fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="var(--color-ink-800)" />

            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--color-ink-400)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
              tickFormatter={(d: string) => formatDate(d)}
            />
            <YAxis
              domain={metric.domain}
              tick={{ fill: 'var(--color-ink-400)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />

            <ReferenceLine
              y={mean}
              stroke="var(--color-ink-600)"
              strokeDasharray="4 4"
              label={{
                value: `avg ${mean.toFixed(metric.digits)}`,
                position: 'insideTopRight',
                fill: 'var(--color-ink-400)',
                fontSize: 10,
              }}
            />

            <Tooltip
              contentStyle={{
                background: 'var(--color-ink-850)',
                border: '1px solid var(--color-ink-600)',
                borderRadius: 10,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--color-ink-200)' }}
              cursor={{ stroke: 'var(--color-ink-500)', strokeDasharray: '3 3' }}
              labelFormatter={(d) =>
                typeof d === 'string'
                  ? formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })
                  : ''
              }
              formatter={(v) => [
                `${Number(v).toFixed(metric.digits)}${metric.suffix}`,
                metric.label,
              ]}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke={metric.color}
              strokeWidth={2}
              fill={`url(#fill-${metric.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              // Days with nothing logged break the line instead of dropping to zero.
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------- metric picker */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetricKey(m.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs transition-colors',
              metricKey === m.key ? 'font-medium' : 'text-ink-400 hover:text-ink-100',
            )}
            style={
              metricKey === m.key
                ? { background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}55` }
                : { background: 'var(--color-ink-800)', border: '1px solid transparent' }
            }
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
