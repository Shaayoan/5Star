import type { InsightReport, Mover } from '@/lib/game/insights';
import { MIN_DAYS_FOR_WEEKDAY } from '@/lib/game/insights';
import type { UserPillar } from '@/lib/types';
import { Card, CardDescription, CardTitle, Chip } from '@/components/ui';
import { alpha } from '@/lib/utils';

const KIND_ICON: Record<string, string> = {
  lift: '🔗',
  weekday: '📆',
  weekend: '🛋️',
  together: '🤝',
};

/**
 * Patterns the user could not see by looking at their own numbers. Every row
 * carries the sample it came from, because an unqualified claim about someone's
 * life drawn from six days would be worse than saying nothing.
 */
export function Insights({
  report,
  pillars,
}: {
  report: InsightReport;
  pillars: UserPillar[];
}) {
  const colourOf = (ids: string[]) =>
    pillars.find((p) => p.id === ids[0])?.color ?? 'var(--color-gold-500)';

  return (
    <Card>
      <CardTitle>Patterns</CardTitle>
      <CardDescription>
        Correlations across your own history — what tends to move together.
      </CardDescription>

      {report.tooEarly ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-ink-900/40 p-4">
          <p className="text-sm text-ink-300">
            Not enough history yet. Patterns need about {MIN_DAYS_FOR_WEEKDAY} logged days
            before they mean anything — you have{' '}
            <span className="num font-semibold text-ink-50">{report.sampleDays}</span>.
          </p>
          <p className="mt-2 text-xs text-ink-400">
            Anything found before then would be coincidence dressed up as insight.
          </p>
        </div>
      ) : report.insights.length === 0 ? (
        <p className="mt-4 text-sm text-ink-300">
          Nothing stands out yet across {report.sampleDays} logged days. That is a real
          result: your pillars are moving independently rather than dragging each other.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {report.insights.map((insight, i) => (
            <li
              key={i}
              className="rounded-xl p-3"
              style={{
                background: alpha(colourOf(insight.pillarIds), 0.07),
                border: `1px solid ${alpha(colourOf(insight.pillarIds), 0.25)}`,
              }}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none">{KIND_ICON[insight.kind] ?? '•'}</span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed">{insight.text}</p>
                  <p className="mt-1 text-[11px] text-ink-400">from {insight.basis}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!report.tooEarly && report.insights.length > 0 && (
        <p className="mt-3 text-[11px] leading-snug text-ink-400">
          These are correlations in your own data, not causes. Two pillars moving together
          can easily share a third explanation — a good night&apos;s sleep, a quiet week.
        </p>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- movers -- */

/** The week-over-week change, stated in words rather than left as arrows. */
export function Movers({ movers }: { movers: Mover[] }) {
  if (movers.length === 0) return null;

  const up = movers.filter((m) => m.delta > 0);
  const down = movers.filter((m) => m.delta < 0);

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <p className="label-xs">Against last week</p>

      <div className="mt-2 space-y-1.5">
        {[...down, ...up].slice(0, 6).map((m) => (
          <div key={m.pillar.id} className="flex items-center gap-2 text-sm">
            <span>{m.pillar.icon}</span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{m.pillar.name}</span>{' '}
              <span className="text-ink-400">
                {m.delta > 0 ? 'is up' : 'is down'}{' '}
                <span className="num">{Math.abs(m.delta).toFixed(1)}★</span> — {m.previous.toFixed(1)}
                {' → '}
                {m.current.toFixed(1)}
              </span>
            </span>
            <Chip tone={m.delta > 0 ? 'good' : 'bad'}>
              {m.delta > 0 ? '▲' : '▼'} {Math.abs(m.delta).toFixed(1)}
            </Chip>
          </div>
        ))}
      </div>
    </div>
  );
}
