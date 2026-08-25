'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { commitProposals, resetChat, type CommitItem } from '@/lib/actions';
import type { IsoDate, StarRating } from '@/lib/types';
import type { Proposal } from '@/lib/ai/tools';
import { Button, Card, Chip } from '@/components/ui';
import { StarPicker } from '@/components/StarPicker';
import { VoiceButton } from './VoiceButton';
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
}

/** A proposal the user has taken over: stars they can still change before it is
 *  written. Keyed by pillar so the model cannot stack duplicates. */
interface DraftRating {
  pillarId: string;
  stars: StarRating;
  evidence: string;
  note?: string;
}

export function ChatBox({
  date,
  pillars,
  excludedCount,
  todayRatings,
  completedActionIds,
  history,
}: {
  date: IsoDate;
  pillars: ChatPillar[];
  excludedCount: number;
  todayRatings: Record<string, StarRating>;
  completedActionIds: string[];
  history: Turn[];
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(history);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRating[]>([]);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [committed, setCommitted] = useState(false);
  const [pending, startTransition] = useTransition();

  const scroller = useRef<HTMLDivElement>(null);
  const pillarById = new Map(pillars.map((p) => [p.id, p]));

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

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
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'The chat is unavailable right now.');
        return;
      }

      setTurns((t) => [...t, { role: 'assistant', text: data.reply }]);
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
        setDrafts((d) => {
          const next = d.filter((x) => x.pillarId !== p.pillarId);
          return [
            ...next,
            { pillarId: p.pillarId, stars: p.stars, evidence: p.evidence, note: p.note },
          ];
        });
      } else if (p.kind === 'action') {
        setActionIds((a) => (a.includes(p.actionId) ? a : [...a, p.actionId]));
      } else {
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      {/* ------------------------------------------------------ conversation */}
      <div className="space-y-3">
        <Card className="flex h-[28rem] flex-col p-0">
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
            {turns.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <span className="text-3xl">💬</span>
                <p className="font-medium">How did today go?</p>
                <p className="max-w-sm text-sm text-ink-400">
                  Just talk. Mention what you did, what went badly, what you skipped — it
                  will ask about anything you leave out.
                </p>
              </div>
            )}

            {turns.map((t, i) => (
              <div
                key={i}
                className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    t.role === 'user'
                      ? 'bg-gold-500 text-ink-950'
                      : 'bg-ink-800 text-ink-100',
                  )}
                >
                  {t.text}
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
              placeholder="Tell it about your day…"
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

        <div className="flex items-center justify-between text-xs text-ink-400">
          <span>
            Your messages are sent to Anthropic to work out the ratings.
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
            onClick={() => startTransition(async () => {
              await resetChat(date);
              setTurns([]);
              setDrafts([]);
              setActionIds([]);
              setSkipped([]);
            })}
            className="shrink-0 hover:text-ink-200"
          >
            Start over
          </button>
        </div>
      </div>

      {/* -------------------------------------------------- confirmation card */}
      <aside className="space-y-3">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Ready to log</h2>
            <Chip tone={hasDraft ? 'gold' : 'neutral'}>{drafts.length}</Chip>
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Nothing is saved until you confirm. Change any rating you disagree with.
          </p>

          {!hasDraft && (
            <p className="mt-4 text-sm text-ink-400">
              {committed
                ? 'Saved. Keep talking to add more.'
                : 'Nothing proposed yet — describe your day and suggestions appear here.'}
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
                      onClick={() =>
                        setDrafts((prev) => prev.filter((x) => x.pillarId !== d.pillarId))
                      }
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
                  {todayRatings[d.pillarId] ? (
                    <p className="mt-1 text-[11px] text-amber-300">
                      replaces today&apos;s {todayRatings[d.pillarId]}★
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
              {pending ? 'Saving…' : `Log ${drafts.length} pillar${drafts.length === 1 ? '' : 's'}`}
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
