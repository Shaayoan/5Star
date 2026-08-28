'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { commitProposals, resetChat, type CommitItem } from '@/lib/actions';
import type { IsoDate, StarRating } from '@/lib/types';
import type { Proposal } from '@/lib/ai/tools';
import { formatDate } from '@/lib/dates';
import { Button, Card, Chip } from '@/components/ui';
import { StarPicker } from '@/components/StarPicker';
import { VoiceButton } from './VoiceButton';
import { DatePicker } from './DatePicker';
import { alpha, cn } from '@/lib/utils';

interface ChatPillar {
  id: string;
  name: string;
  icon: string;
  color: string;
  definition: string;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  /** Shown when the conversation jumped to another day mid-thread. */
  dateNote?: string;
}

/** A proposal the user has taken over: stars they can still change before it is
 *  written. Keyed by pillar so the model cannot stack duplicates. */
interface DraftRating {
  pillarId: string;
  stars: StarRating;
  evidence: string;
  note?: string;
}

interface Outstanding {
  id: string;
  name: string;
  icon: string;
}

export function ChatBox({
  date: initialDate,
  today,
  pillars,
  excludedCount,
  ratings,
  completedActionIds,
  history,
}: {
  date: IsoDate;
  today: IsoDate;
  pillars: ChatPillar[];
  excludedCount: number;
  ratings: Record<string, StarRating>;
  completedActionIds: string[];
  history: Turn[];
  dateLabel: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [turns, setTurns] = useState<Turn[]>(history);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRating[]>([]);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [committed, setCommitted] = useState(false);
  const [pending, startTransition] = useTransition();

  // Server-computed, so the outstanding list never drifts from the database.
  const [outstanding, setOutstanding] = useState<Outstanding[]>(
    pillars.filter((p) => (ratings[p.id] ?? 0) === 0).map((p) => ({ id: p.id, name: p.name, icon: p.icon })),
  );

  const scroller = useRef<HTMLDivElement>(null);
  const pillarById = new Map(pillars.map((p) => [p.id, p]));

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  /** Switching day loads that day's own conversation and outstanding list. */
  const switchDate = (next: IsoDate) => {
    if (next === date) return;
    setDate(next);
    setDrafts([]);
    setActionIds([]);
    setSkipped([]);
    setCommitted(false);
    router.push(`/chat?d=${next}`);
    router.refresh();
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    setInput('');
    setCommitted(false);
    setTurns((t) => [...t, { role: 'user', text: trimmed }]);
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, date }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'The chat is unavailable right now.');
        return;
      }

      // The model may have retargeted the conversation to another day.
      if (data.dateChanged && data.date && data.date !== date) {
        setDate(data.date);
        setDrafts([]);
        setActionIds([]);
        setSkipped([]);
        window.history.replaceState(null, '', `/chat?d=${data.date}`);
      }

      setTurns((t) => [
        ...t,
        {
          role: 'assistant',
          text: data.reply,
          dateNote: data.dateChanged
            ? `Switched to ${formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' })}`
            : undefined,
        },
      ]);

      if (Array.isArray(data.unfilled)) setOutstanding(data.unfilled);
      absorb(data.proposals ?? []);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  /** Merge new proposals into the draft, newest wins per pillar. */
  const absorb = (incoming: Proposal[]) => {
    for (const p of incoming) {
      if (p.kind === 'rating') {
        setSkipped((s) => s.filter((id) => id !== p.pillarId));
        setDrafts((d) => [
          ...d.filter((x) => x.pillarId !== p.pillarId),
          { pillarId: p.pillarId, stars: p.stars, evidence: p.evidence, note: p.note },
        ]);
      } else if (p.kind === 'action') {
        setActionIds((a) => (a.includes(p.actionId) ? a : [...a, p.actionId]));
      } else if (p.kind === 'skip') {
        setDrafts((d) => d.filter((x) => x.pillarId !== p.pillarId));
        setSkipped((s) => (s.includes(p.pillarId) ? s : [...s, p.pillarId]));
      }
    }
  };

  const commit = () => {
    startTransition(async () => {
      setError(null);
      const items: CommitItem[] = [
        ...drafts.map((d) => ({
          kind: 'rating' as const,
          pillarId: d.pillarId,
          stars: d.stars,
          note: d.note ?? null,
        })),
        ...actionIds
          .filter((id) => !completedActionIds.includes(id))
          .map((id) => ({ kind: 'action' as const, actionId: id })),
      ];
      if (items.length === 0) return;

      try {
        await commitProposals(items, date);
        // Anything just written is no longer outstanding.
        const written = new Set(drafts.map((d) => d.pillarId));
        setOutstanding((o) => o.filter((p) => !written.has(p.id)));
        setDrafts([]);
        setActionIds([]);
        setCommitted(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save those ratings.');
      }
    });
  };

  const hasDraft = drafts.length > 0 || actionIds.length > 0;
  const stillOpen = outstanding.filter((p) => !skipped.includes(p.id));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* ------------------------------------------------------ conversation */}
      <div className="min-w-0 space-y-3">
        <Card className="flex h-[28rem] flex-col p-0">
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
            {turns.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <span className="text-3xl">💬</span>
                <p className="font-medium">
                  How did {date === today ? 'today' : formatDate(date, { weekday: 'long' })} go?
                </p>
                <p className="max-w-sm text-sm text-ink-400">
                  Just talk. Mention another day and it will switch to logging that one, and
                  it will keep asking until every pillar is filled in.
                </p>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i}>
                {t.dateNote && (
                  <p className="mb-2 text-center text-[11px] text-gold-400">📅 {t.dateNote}</p>
                )}
                <div className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      t.role === 'user' ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-ink-100',
                    )}
                  >
                    {t.text}
                  </div>
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-ink-800 px-4 py-3">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-[var(--border)] p-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Tell it about your day, or ask how something works…"
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-[var(--border)] bg-ink-900/70 px-3 py-2 text-sm outline-none placeholder:text-ink-400 focus:border-gold-500/60"
            />
            <VoiceButton
              disabled={busy}
              onTranscript={(text) => setInput((v) => (v ? `${v} ${text}` : text))}
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              Send
            </Button>
          </form>
        </Card>

        {error && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        <div className="flex items-center justify-between gap-3 text-xs text-ink-400">
          <span>
            Sent to Google Gemini to work out the ratings.
            {excludedCount > 0 && (
              <>
                {' '}
                <span className="text-ink-200">
                  {excludedCount} pillar{excludedCount > 1 ? 's are' : ' is'} opted out
                </span>{' '}
                and never mentioned.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await resetChat(date);
                setTurns([]);
                setDrafts([]);
                setActionIds([]);
                setSkipped([]);
              })
            }
            className="shrink-0 hover:text-ink-200"
          >
            Start over
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ sidebar */}
      <aside className="min-w-0 space-y-3">
        <DatePicker date={date} today={today} onChange={switchDate} disabled={busy} />

        {/* ------------------------------------------------ outstanding list */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Still to fill</h2>
            <Chip tone={stillOpen.length === 0 ? 'good' : 'bad'}>
              {pillars.length - stillOpen.length}/{pillars.length}
            </Chip>
          </div>

          {stillOpen.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-300">
              Every pillar is filled in for this day. 🎉
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stillOpen.map((p) => (
                  <Chip key={p.id} tone="neutral">
                    {p.icon} {p.name}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-400">
                The chat will keep asking about these until they are rated or skipped.
              </p>
            </>
          )}
        </Card>

        {/* ---------------------------------------------- confirmation panel */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Ready to log</h2>
            <Chip tone={hasDraft ? 'gold' : 'neutral'}>{drafts.length}</Chip>
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Nothing is saved until you confirm. Saves to{' '}
            <span className="text-ink-200">{formatDate(date, { day: 'numeric', month: 'short' })}</span>.
          </p>

          {!hasDraft && (
            <p className="mt-4 text-sm text-ink-400">
              {committed
                ? 'Saved. Keep talking to add more.'
                : 'Nothing proposed yet — describe the day and suggestions appear here.'}
            </p>
          )}

          <div className="mt-3 space-y-3">
            {drafts.map((d) => {
              const p = pillarById.get(d.pillarId);
              if (!p) return null;
              return (
                <div
                  key={d.pillarId}
                  className="rounded-xl p-3"
                  style={{
                    background: alpha(p.color, 0.08),
                    border: `1px solid ${alpha(p.color, 0.3)}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{p.icon}</span>
                      {p.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Discard ${p.name}`}
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.pillarId !== d.pillarId))}
                      className="text-ink-400 hover:text-rose-400"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-1">
                    <StarPicker
                      size="sm"
                      showLabel={false}
                      color={p.color}
                      value={d.stars}
                      onChange={(stars) =>
                        setDrafts((prev) =>
                          prev.map((x) =>
                            x.pillarId === d.pillarId
                              ? { ...x, stars: (stars || 1) as StarRating }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>

                  {d.evidence && (
                    <p className="mt-1.5 text-[11px] leading-snug text-ink-400">
                      because: {d.evidence}
                    </p>
                  )}
                  {ratings[d.pillarId] ? (
                    <p className="mt-1 text-[11px] text-amber-300">
                      replaces the existing {ratings[d.pillarId]}★
                    </p>
                  ) : null}
                </div>
              );
            })}

            {actionIds.length > 0 && (
              <p className="text-xs text-ink-300">
                + {actionIds.length} quick-log action{actionIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {hasDraft && (
            <Button className="mt-4 w-full" onClick={commit} disabled={pending}>
              {pending
                ? 'Saving…'
                : `Log ${drafts.length} pillar${drafts.length === 1 ? '' : 's'} to ${formatDate(date, { day: 'numeric', month: 'short' })}`}
            </Button>
          )}
        </Card>

        {skipped.length > 0 && (
          <Card>
            <p className="label-xs">Left unrated</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skipped.map((id) => {
                const p = pillarById.get(id);
                return p ? (
                  <Chip key={id} tone="neutral">
                    {p.icon} {p.name}
                  </Chip>
                ) : null;
              })}
            </div>
            <p className="mt-2 text-[11px] text-ink-400">
              Unlogged is not the same as a bad day — these stay empty on purpose.
            </p>
          </Card>
        )}
      </aside>
    </div>
  );
}
