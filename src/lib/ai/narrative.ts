import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { formatDate } from '../dates';
import type { DayEntry, UserPillar } from '../types';
import type { WindowSummary } from '../game';
import { GEMINI_API_KEY, NARRATIVE_MAX_TOKENS, NARRATIVE_MODEL } from './config';

/**
 * The deeper weekly write-up.
 *
 * The rule-based narrative in `lib/game/narrative.ts` stays the default: it is
 * free, instant and cannot invent a number. This one is opt-in per week, and
 * only earns its keep once the chat has produced real notes — with ratings alone
 * a model just paraphrases the arithmetic.
 */

export interface AiNarrativeInput {
  week: WindowSummary;
  previous: WindowSummary;
  pillars: UserPillar[];
  entries: DayEntry[];
  displayName: string | null;
}

function notesBlock(entries: DayEntry[], pillars: UserPillar[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    for (const pillar of pillars) {
      const stars = entry.ratings[pillar.id] ?? 0;
      const note = entry.notes?.[pillar.id];
      if (!stars) continue;
      lines.push(
        `${formatDate(entry.date, { weekday: 'short' })} · ${pillar.name} · ${stars}★${
          note ? ` — "${note}"` : ''
        }`,
      );
    }
  }

  return lines.length ? lines.join('\n') : '(no entries)';
}

export async function writeWeeklyNarrative(input: AiNarrativeInput): Promise<string> {
  const { week, previous, pillars, entries, displayName } = input;

  const stats = pillars
    .map((p) => {
      const now = week.means[p.id] ?? 0;
      const before = previous.means[p.id] ?? 0;
      return `- ${p.name}: ${now.toFixed(1)}★ this week (${
        before > 0 ? `${before.toFixed(1)}★ last week` : 'no data last week'
      }), logged ${week.counts[p.id] ?? 0}/7 days. Their definition of a good day: "${
        p.definition || 'not written'
      }"`;
    })
    .join('\n');

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const systemInstruction = `You write one honest weekly review for a user of 5 Star, a life-balance tracker.

Rules that matter more than style:
- Use ONLY the numbers and notes given to you. Never invent an activity, a number or a
  cause that is not in the data. If the notes are thin, write less.
- Look for patterns ACROSS days that the raw numbers do not show — a recurring reason a
  pillar slipped, something that reliably preceded a good day. That is the whole point of
  this version; a summary of the averages is worthless because they can already see those.
- Be direct and unsentimental. No cheerleading, no therapy-speak, no "remember to be kind
  to yourself". Treat them as an adult reviewing their own performance.
- If they had a bad week, say so plainly and say what the data suggests is behind it.
- End with one concrete thing to change next week, drawn from the notes.

Format: 3 to 5 short paragraphs, plain prose. No headings, no bullet points, no markdown.
Around 200 words. Never mention that you are an AI or refer to "the data provided".`;

  const response = await ai.models.generateContent({
    model: NARRATIVE_MODEL,
    config: { systemInstruction, maxOutputTokens: NARRATIVE_MAX_TOKENS },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${displayName ? `The user is ${displayName}. ` : ''}Here is their week.

Overall: ${week.overall.toFixed(1)}★ average, balance score ${week.balance}/100, ${
          week.loggedDays
        } complete days, ${week.fiveStarDays} five-star days.
Last week for comparison: ${previous.overall.toFixed(1)}★ average, balance ${previous.balance}/100.

Per pillar:
${stats}

Every rating they logged, with the note they wrote at the time:
${notesBlock(entries, pillars)}`,
          },
        ],
      },
    ],
  });

  const text = (response.text ?? '').trim();
  if (!text) throw new Error('The model returned an empty review.');
  return text;
}
