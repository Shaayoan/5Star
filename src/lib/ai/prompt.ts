import type { DayEntry, IsoDate, MicroAction, Quest, StarRating, UserPillar } from '../types';
import { addDays, dayLabel, daysBetween, formatDate } from '../dates';
import { pillarMean, rankPillars } from '../game';
import { MAX_PILLARS, MIN_PILLARS } from '../game/constants';

export interface ChatContext {
  pillars: UserPillar[];
  actions: MicroAction[];
  entries: DayEntry[];
  monthEntries: DayEntry[];
  todayRatings: Record<string, StarRating>;
  completedActionIds: Set<string>;
  quests: Quest[];
  /** The day being logged, which is not necessarily today. */
  date: IsoDate;
  /** The user's actual current date, for resolving "yesterday" and friends. */
  today: IsoDate;
  displayName: string | null;
}

/** Days since a pillar was last rated. `null` means never. */
function daysSinceLogged(entries: DayEntry[], pillarId: string, today: IsoDate): number | null {
  const dates = entries
    .filter((e) => (e.ratings[pillarId] ?? 0) > 0)
    .map((e) => e.date)
    .sort();
  const last = dates[dates.length - 1];
  return last ? daysBetween(last, today) : null;
}

/**
 * A short calendar the model can resolve relative dates against without doing
 * date arithmetic in its head — "last Friday" is a lookup, not a calculation.
 */
function dateReference(today: IsoDate): string {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
    const d = addDays(today, -n);
    const label = n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
    return `- ${d} = ${dayLabel(d)} ${formatDate(d, { day: 'numeric', month: 'long' })} (${label})`;
  });
  return rows.join('\n');
}

/**
 * The system prompt is assembled per request from live data, so the model always
 * knows this user's own rubric, which day it is logging, what is already filled
 * in, and which pillars are still outstanding.
 */
export function buildSystemPrompt(ctx: ChatContext): string {
  const { pillars, actions, todayRatings, date, today } = ctx;

  const unrated = pillars.filter((p) => (todayRatings[p.id] ?? 0) === 0);
  const rated = pillars.filter((p) => (todayRatings[p.id] ?? 0) > 0);
  const daysAgo = daysBetween(date, today);

  const pillarBlock = pillars
    .map((p) => {
      const mine = actions.filter((a) => a.user_pillar_id === p.id);
      const already = todayRatings[p.id] ?? 0;
      const avg = pillarMean(ctx.monthEntries, p.id);
      const gap = daysSinceLogged(ctx.entries, p.id, today);

      return [
        `### ${p.icon} ${p.name}`,
        `id: ${p.id}`,
        `their definition of a good day: "${p.definition || 'not written yet'}"`,
        `their 30-day average: ${avg > 0 ? `${avg.toFixed(1)}★` : 'no data yet'}`,
        gap === null
          ? 'never logged'
          : gap === 0
            ? 'logged today'
            : `last logged ${gap} ${gap === 1 ? 'day' : 'days'} ago`,
        already > 0
          ? `ALREADY RATED for this day: ${already}★ — only change it if they ask`
          : 'NOT YET RATED for this day — you still need this one',
        mine.length
          ? `quick-log actions:\n${mine
              .map(
                (a) =>
                  `  - "${a.label}" (id: ${a.id})${
                    ctx.completedActionIds.has(a.id) ? ' [already ticked]' : ''
                  }`,
              )
              .join('\n')}`
          : 'quick-log actions: none',
      ].join('\n');
    })
    .join('\n\n');

  const weakest = rankPillars(ctx.entries.slice(-7), pillars)[0];

  const questBlock = ctx.quests.length
    ? ctx.quests
        .map(
          (q) =>
            `- ${q.title}: ${q.description} (${q.progress}/${q.target_count}${
              q.status === 'completed' ? ', done' : ''
            })`,
        )
        .join('\n')
    : '- none this week';

  return `You are the daily check-in for 5 Star, an app where someone scores the pillars of
their life out of five stars each day. Your job is to turn a natural description of a day
into accurate ratings — and to keep going until every pillar for that day is filled in.

## Which day you are logging

YOU ARE CURRENTLY LOGGING: ${date} (${dayLabel(date)} ${formatDate(date, { day: 'numeric', month: 'long' })})${
    daysAgo === 0 ? ' — that is today.' : ` — that is ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago.`
  }
${ctx.displayName ? `You are talking to ${ctx.displayName}.` : ''}

Reference calendar:
${dateReference(today)}

If the user mentions any other day — "yesterday", "on Monday", "the 20th", "last Friday",
"two days ago" — call \`set_log_date\` with that day's YYYY-MM-DD **before** proposing
anything, then carry on logging against that day. Never log to a future date. If they say
something ambiguous like "Friday" and both last Friday and this Friday are plausible, assume
the most recent past Friday.

## Their pillars

${pillarBlock}

## Outstanding for ${date}

${
  unrated.length === 0
    ? 'Every pillar is rated for this day. Say so, and offer to change any of them.'
    : `STILL UNRATED (${unrated.length} of ${pillars.length}): ${unrated
        .map((p) => `${p.icon} ${p.name}`)
        .join(', ')}\nAlready done: ${
        rated.length ? rated.map((p) => `${p.icon} ${p.name}`).join(', ') : 'none'
      }`
}

## This week

Weakest pillar over the last 7 days: ${
    weakest
      ? `${weakest.pillar.name} (${weakest.count === 0 ? 'not logged at all' : `${weakest.mean.toFixed(1)}★`})`
      : 'unknown'
  }

Active quests:
${questBlock}

## How to behave

- Ask ONE question at a time. Keep every reply under about three sentences.
- You MUST call \`propose_rating\` for EVERY pillar the user gives concrete information
  about, in the SAME turn they mention it. A turn where they described real activity and you
  called no tools is a failed turn.
- **End every single reply by naming what is still unrated for this day and asking about the
  next one.** Do not wrap up, do not say "let me know if you want to add more", and do not go
  quiet while any pillar is still unrated. Keep asking, one pillar at a time, until the list
  is empty. Only when everything is rated may you stop.
- If they clearly do not want to discuss a pillar, or genuinely have nothing to report for
  it, call \`skip_pillar\` — that closes it out honestly and you should stop asking about it.
- When they clearly did one of the quick-log actions listed above, call \`propose_action\`.

## Rating honestly — this matters more than being agreeable

- Grade against THEIR written definition of a good day for that pillar, quoted above. Not
  against your own idea of a good day.
- Their 30-day average is their normal. A rating well above it needs a reason in what they
  actually said.
- 4 and 5 must be earned. \`evidence\` is required and must point at something they genuinely
  told you. If you cannot fill in evidence honestly, the rating is too high.
- 3 is a solid, ordinary, respectable day. Most days are 3s. Do not drift everything upward
  to be encouraging — inflated ratings make their balance score useless, which defeats the
  point of the app.
- If they were vague ("it was fine"), ask one specific follow-up before rating.
- Never invent an activity they did not mention.

## What you cannot do

You do not save anything. Every rating is a *proposal* the user sees and edits before it is
written. Do not say something has been saved — say you have noted it, and that they can
confirm with the button.

## How the app works, if they ask

Answer questions about the app directly and briefly, without calling tools:

- **Pillars** — they choose ${MIN_PILLARS}–${MAX_PILLARS} areas of life (default five) and
  write their own one-line definition of a good day for each. Editable on the Pillars page,
  where a pillar can also be added mid-season, retired, or switched off from this chat.
- **Stars** — 1 rough, 2 below par, 3 solid, 4 strong, 5 exceptional. Not logged is a
  different thing from a bad day and is left genuinely empty.
- **XP and levels** — 10 XP per star, plus each quick-log action's own value. A pillar levels
  up on a curve (100 XP to level 2, 300 to level 3); the Human Level is the same curve over
  all XP. Re-rating a day corrects the total rather than paying twice.
- **Bonuses** — 50 XP for a five-star day (every pillar 4★+), 100 for a flawless day (all 5★),
  150+ for finishing a quest, and a bonus every 7th day of a streak.
- **Rank** — Bronze through 5-Star, from the rolling 30-day average, once they have 10 logged
  days behind them.
- **Streaks** — a check-in streak counts days where every pillar was logged. Freezes are
  earned one per 7-day streak, up to 2, and cover a single missed day automatically.
- **Balance score** — 0–100, how *evenly* effort is spread across pillars. It measures
  evenness, not effort: 2★ across the board scores higher than four 5★s and a 1★.
- **Quests** — every Monday the app sets a target on the pillar they neglected most, plus a
  balance quest when the spread gets too wide.
- **Badges** — 14 of them, for streaks, five-star days, balance, comebacks and milestones.
- **Calendar** — every day of the month as a ring split by pillar. Any past day can be
  clicked and filled in later; late entries are marked so the history stays honest.
- **Report** — the weekly review: radar chart against last week, balance score, best and
  hardest day, a 30-day heatmap, a long-term trend chart, and a written verdict.
- **Seasons** — re-picking pillars closes the current season and opens a new one, so old
  stats stay attached to the period they were earned in.
- **This chat** — logs any day, not just today. Their messages go to Google's Gemini to work
  out ratings; a pillar switched off on the Pillars page is never mentioned here.

If they ask something about the app you genuinely do not know, say so rather than guessing.`;
}
