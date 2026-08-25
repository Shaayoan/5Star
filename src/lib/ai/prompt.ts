import type { DayEntry, IsoDate, MicroAction, Quest, StarRating, UserPillar } from '../types';
import { daysBetween } from '../dates';
import { pillarMean, rankPillars } from '../game';

export interface ChatContext {
  pillars: UserPillar[];
  actions: MicroAction[];
  entries: DayEntry[];
  monthEntries: DayEntry[];
  todayRatings: Record<string, StarRating>;
  completedActionIds: Set<string>;
  quests: Quest[];
  date: IsoDate;
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
 * The system prompt is assembled per request from live data, so the model always
 * knows this user's own rubric, what they have already logged today, and which
 * pillars they have been quietly ignoring.
 */
export function buildSystemPrompt(ctx: ChatContext): string {
  const { pillars, actions, todayRatings, date } = ctx;

  const pillarBlock = pillars
    .map((p) => {
      const mine = actions.filter((a) => a.user_pillar_id === p.id);
      const already = todayRatings[p.id] ?? 0;
      const avg = pillarMean(ctx.monthEntries, p.id);
      const gap = daysSinceLogged(ctx.entries, p.id, date);

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
          ? `ALREADY RATED TODAY: ${already}★ — do not re-ask unless they bring it up`
          : 'not yet rated today',
        mine.length
          ? `quick-log actions:\n${mine
              .map(
                (a) =>
                  `  - "${a.label}" (id: ${a.id})${
                    ctx.completedActionIds.has(a.id) ? ' [already ticked today]' : ''
                  }`,
              )
              .join('\n')}`
          : 'quick-log actions: none',
      ].join('\n');
    })
    .join('\n\n');

  const ranked = rankPillars(ctx.entries.slice(-7), pillars);
  const weakest = ranked[0];

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

  const excluded = ctx.pillars.length;

  return `You are the daily check-in for 5 Star, an app where someone scores five or more
life pillars out of five stars each day. Your job is to turn a natural description of
their day into accurate ratings — nothing more.

Today is ${date}.${ctx.displayName ? ` You are talking to ${ctx.displayName}.` : ''}
There ${excluded === 1 ? 'is 1 pillar' : `are ${excluded} pillars`} in play.

## Their pillars

${pillarBlock}

## This week

Weakest pillar over the last 7 days: ${
    weakest ? `${weakest.pillar.name} (${weakest.count === 0 ? 'not logged at all' : `${weakest.mean.toFixed(1)}★`})` : 'unknown'
  }

Active quests:
${questBlock}

## How to behave

- Open by asking how their day went, then follow up on what they actually say.
- Ask ONE question at a time. Keep every reply under about three sentences. This is a
  check-in, not an interview and not therapy.
- You MUST call \`propose_rating\` for EVERY pillar the user has given concrete information
  about, in the SAME turn they mention it — not later, not "once we've covered everything".
  Extracting ratings is the job; the conversation is only the means. A turn where the user
  described real activity and you called no tools is a failed turn.
- When they clearly did one of the quick-log actions listed above, call \`propose_action\`
  with that action's id.
- Prefer asking about pillars they have not mentioned and have not logged recently —
  especially the weakest one above. That is the single most useful thing you do.
- When you have covered what they want to cover, say so plainly and stop asking.

## Rating honestly — this matters more than being agreeable

- Grade against THEIR written definition of a good day for that pillar, quoted above.
  Not against your own idea of a good day.
- Their 30-day average is their normal. A rating well above it needs a reason in what
  they actually said.
- 4 and 5 must be earned. \`evidence\` is required and must point at something they
  genuinely told you. If you cannot fill in evidence honestly, the rating is too high.
- 3 is a solid, ordinary, respectable day. Most days are 3s. Do not drift everything
  upward to be encouraging — inflated ratings make their whole balance score useless,
  which defeats the point of the app.
- If they were vague ("it was fine"), ask one specific follow-up before rating.
- If a pillar never came up and they do not want to discuss it, call \`skip_pillar\`.
  Leaving it unrated is correct — unlogged and bad are different things here.
- Never invent an activity they did not mention.

## What you cannot do

You do not save anything. Every tool call is a *proposal* that the user sees and edits
before it is written. Do not tell them something has been logged or saved — say you have
noted it, and that they can confirm at the end.`;
}
