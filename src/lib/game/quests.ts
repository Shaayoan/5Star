import type { DayEntry, IsoDate, UserPillar } from '../types';
import { balanceScore, pillarMean, rankPillars } from './analysis';
import { QUEST_REWARD, STRONG_THRESHOLD } from './constants';

export interface QuestDraft {
  kind: 'focus' | 'balance';
  user_pillar_id: string | null;
  title: string;
  description: string;
  target_count: number;
  xp_reward: number;
}

const strongDays = (entries: DayEntry[], pillarId: string) =>
  entries.filter((e) => (e.ratings[pillarId] ?? 0) >= STRONG_THRESHOLD).length;

/**
 * Weekly quests are generated from *last* week's data: one focus quest on the
 * weakest pillar, plus a balance quest whenever the spread got too wide.
 * See docs/FORMULAS.md §9.
 */
export function generateQuests(
  lastWeek: DayEntry[],
  pillars: UserPillar[],
): QuestDraft[] {
  if (pillars.length === 0) return [];
  const drafts: QuestDraft[] = [];

  const weakest = rankPillars(lastWeek, pillars)[0];
  if (weakest) {
    const baseline = strongDays(lastWeek, weakest.pillar.id);
    const target = Math.max(3, Math.min(6, baseline + 2));
    drafts.push({
      kind: 'focus',
      user_pillar_id: weakest.pillar.id,
      title: `Rebuild ${weakest.pillar.name}`,
      description:
        weakest.count === 0
          ? `You did not log ${weakest.pillar.name} once last week. Get it to 4★ on ${target} days.`
          : `${weakest.pillar.name} averaged ${weakest.mean.toFixed(1)}★ last week. Hit 4★ or better on ${target} days.`,
      target_count: target,
      xp_reward: QUEST_REWARD,
    });
  }

  const balance = balanceScore(pillars.map((p) => pillarMean(lastWeek, p.id)));
  if (balance < 70) {
    drafts.push({
      kind: 'balance',
      user_pillar_id: null,
      title: 'Even the keel',
      description: 'Keep every pillar at 3★ or better on 4 days this week.',
      target_count: 4,
      xp_reward: Math.round(QUEST_REWARD * 1.2),
    });
  }

  return drafts;
}

/** Recount a quest's progress from the current week's entries. */
export function questProgress(
  quest: { kind: 'focus' | 'balance'; user_pillar_id: string | null },
  weekEntries: DayEntry[],
  pillarIds: string[],
): number {
  if (quest.kind === 'focus' && quest.user_pillar_id) {
    return strongDays(weekEntries, quest.user_pillar_id);
  }
  return weekEntries.filter((e) => pillarIds.every((id) => (e.ratings[id] ?? 0) >= 3)).length;
}

export const isQuestComplete = (progress: number, target: number) => progress >= target;

export function questWeekLabel(weekStartIso: IsoDate): string {
  return `Week of ${weekStartIso}`;
}
