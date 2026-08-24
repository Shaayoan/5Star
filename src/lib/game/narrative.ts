import { formatDate } from '../dates';
import type { UserPillar } from '../types';
import type { WindowSummary } from './analysis';
import { rankPillars } from './analysis';
import { maxDayScore } from './constants';

/**
 * The weekly write-up. Deliberately rule-based rather than model-generated:
 * it costs nothing, it is deterministic (the same week always reads the same
 * way), and it can never invent a number that is not in the data.
 */

export interface NarrativeInput {
  week: WindowSummary;
  previous: WindowSummary;
  pillars: UserPillar[];
  checkInStreak: number;
  questsCompleted: number;
  newBadges: string[];
}

function openingLine(week: WindowSummary, previous: WindowSummary): string {
  const delta = week.overall - previous.overall;
  const avg = week.overall.toFixed(1);

  if (week.loggedDays === 0) {
    return 'No complete check-ins this week. Nothing to score — the only move that matters is logging tomorrow.';
  }
  if (previous.loggedDays === 0) {
    return `You averaged ${avg}★ across ${week.loggedDays} complete ${week.loggedDays === 1 ? 'day' : 'days'}. That is your baseline; everything from here is measured against it.`;
  }
  if (delta >= 0.4) {
    return `A clear step up: ${avg}★ this week against ${previous.overall.toFixed(1)}★ last. Whatever changed, it worked.`;
  }
  if (delta <= -0.4) {
    return `A harder week: ${avg}★, down from ${previous.overall.toFixed(1)}★. Worth asking what got in the way before it sets a pattern.`;
  }
  return `You held steady at ${avg}★, near last week's ${previous.overall.toFixed(1)}★. Consistency is its own result.`;
}

function balanceLine(week: WindowSummary): string {
  const b = week.balance;
  if (b >= 85) return `Balance score ${b} — remarkably even. No pillar is carrying the others.`;
  if (b >= 70) return `Balance score ${b}. Slight tilt, nothing structural.`;
  if (b >= 50) return `Balance score ${b}. One or two pillars are pulling well ahead of the rest.`;
  return `Balance score ${b}. This week was lopsided — a single pillar took most of your attention.`;
}

function pillarLines(input: NarrativeInput): string[] {
  const { week, previous, pillars } = input;
  const ranked = rankPillars(week.entries, pillars);
  if (ranked.length === 0) return [];

  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  const lines: string[] = [];

  if (strongest && strongest.mean > 0) {
    const prev = previous.means[strongest.pillar.id] ?? 0;
    const climbed = prev > 0 && strongest.mean - prev >= 0.3;
    lines.push(
      `${strongest.pillar.icon} **${strongest.pillar.name}** led at ${strongest.mean.toFixed(1)}★` +
        (climbed ? `, up from ${prev.toFixed(1)}★ last week.` : '.'),
    );
  }

  if (weakest && weakest.pillar.id !== strongest?.pillar.id) {
    if (weakest.count === 0) {
      lines.push(
        `${weakest.pillar.icon} **${weakest.pillar.name}** went unlogged all week. That is the gap to close first.`,
      );
    } else {
      const prev = previous.means[weakest.pillar.id] ?? 0;
      const slipped = prev > 0 && prev - weakest.mean >= 0.3;
      lines.push(
        `${weakest.pillar.icon} **${weakest.pillar.name}** trailed at ${weakest.mean.toFixed(1)}★` +
          (slipped ? `, down from ${prev.toFixed(1)}★.` : ` across ${weakest.count} ${weakest.count === 1 ? 'day' : 'days'}.`),
      );
    }
  }

  return lines;
}

function dayLines(week: WindowSummary): string[] {
  const lines: string[] = [];
  const best = maxDayScore(week.pillarIds.length);

  if (week.bestDay) {
    lines.push(
      `Best day was ${formatDate(week.bestDay.date, { weekday: 'long' })} at ${week.bestDay.score}/${best}.`,
    );
  }
  if (week.hardestDay && week.hardestDay.date !== week.bestDay?.date) {
    lines.push(
      `Hardest was ${formatDate(week.hardestDay.date, { weekday: 'long' })} at ${week.hardestDay.score}/${best}.`,
    );
  }
  if (week.fiveStarDays > 0) {
    lines.push(
      `${week.fiveStarDays} five-star ${week.fiveStarDays === 1 ? 'day' : 'days'}` +
        (week.perfectDays > 0 ? `, ${week.perfectDays} of them flawless.` : '.'),
    );
  }
  return lines;
}

function closingLine(input: NarrativeInput): string {
  const { week, pillars, checkInStreak } = input;
  const weakest = rankPillars(week.entries, pillars)[0];
  const streakNote =
    checkInStreak >= 7
      ? ` Your ${checkInStreak}-day check-in streak is the asset here — protect it.`
      : checkInStreak > 0
        ? ` You are ${checkInStreak} ${checkInStreak === 1 ? 'day' : 'days'} into a streak.`
        : '';

  if (!weakest) return `Pick your five pillars to start scoring weeks.${streakNote}`;
  return `Next week, put ${weakest.pillar.name} first — it is the cheapest point you can buy.${streakNote}`;
}

export interface Narrative {
  headline: string;
  paragraphs: string[];
  bullets: string[];
  closing: string;
}

export function buildNarrative(input: NarrativeInput): Narrative {
  const { week, previous } = input;

  return {
    headline: openingLine(week, previous),
    paragraphs: [balanceLine(week), ...pillarLines(input)],
    bullets: dayLines(week),
    closing: closingLine(input),
  };
}

/** Flattened plain-text version, stored on the report row for future export. */
export function narrativeToText(n: Narrative): string {
  return [n.headline, ...n.paragraphs, ...n.bullets, n.closing]
    .join('\n\n')
    .replace(/\*\*/g, '');
}
