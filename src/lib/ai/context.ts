import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { addDays, lastNDays, weekStart } from '../dates';
import {
  getActionLogDates,
  getEntries,
  getMicroActions,
  getProfile,
  getQuests,
  type DB,
} from '../queries';
import type { IsoDate, StarRating, UserPillar } from '../types';
import type { ChatContext } from './prompt';

/** Pillars the user has left switched on for the chat. A pillar opted out is
 *  invisible to the model — it is never named in the prompt at all. */
export async function getChattablePillars(db: DB, userId: string): Promise<UserPillar[]> {
  const { data } = await db
    .from('user_pillars')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('chat_enabled', true)
    .order('slot');
  return (data as UserPillar[]) ?? [];
}

export async function getChatContext(
  db: DB,
  userId: string,
  date: IsoDate,
): Promise<ChatContext> {
  const [pillars, actions, entries, completedActionIds, profile, quests] = await Promise.all([
    getChattablePillars(db, userId),
    getMicroActions(db, userId),
    getEntries(db, userId, addDays(date, -89), date),
    getActionLogDates(db, userId, date),
    getProfile(db, userId),
    getQuests(db, userId, weekStart(date)),
  ]);

  const byDate = new Map(entries.map((e) => [e.date, e]));
  const monthDates = lastNDays(30, date);
  const monthEntries = monthDates.map(
    (d) => byDate.get(d) ?? { date: d, ratings: {} as Record<string, StarRating> },
  );

  const ids = new Set(pillars.map((p) => p.id));

  return {
    pillars,
    // Only actions belonging to a chattable pillar are exposed to the model.
    actions: actions.filter((a) => ids.has(a.user_pillar_id)),
    entries,
    monthEntries,
    todayRatings: byDate.get(date)?.ratings ?? {},
    completedActionIds,
    quests,
    date,
    displayName: profile?.display_name ?? null,
  };
}

/* -------------------------------------------------------------- sessions -- */

/** One stored conversation per calendar day. */
export async function loadChatSession(
  db: DB,
  userId: string,
  date: IsoDate,
): Promise<Anthropic.MessageParam[]> {
  const { data } = await db
    .from('chat_sessions')
    .select('messages')
    .eq('user_id', userId)
    .eq('log_date', date)
    .maybeSingle<{ messages: Anthropic.MessageParam[] }>();

  return Array.isArray(data?.messages) ? data.messages : [];
}

export async function saveChatSession(
  db: DB,
  userId: string,
  date: IsoDate,
  messages: Anthropic.MessageParam[],
) {
  await db.from('chat_sessions').upsert(
    { user_id: userId, log_date: date, messages },
    { onConflict: 'user_id,log_date' },
  );
}

export async function clearChatSession(db: DB, userId: string, date: IsoDate) {
  await db.from('chat_sessions').delete().eq('user_id', userId).eq('log_date', date);
}

/** Plain text of the day's conversation, for showing history when the page
 *  reloads. Tool blocks are dropped — the user only cares about what was said. */
export function transcriptOf(
  messages: Anthropic.MessageParam[],
): { role: 'user' | 'assistant'; text: string }[] {
  const out: { role: 'user' | 'assistant'; text: string }[] = [];

  for (const m of messages) {
    // Only the two conversational roles are ever rendered; anything else stored
    // in the transcript is scaffolding the user never needs to see.
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const role = m.role;

    if (typeof m.content === 'string') {
      if (m.content.trim()) out.push({ role, text: m.content });
      continue;
    }
    const text = m.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim();
    if (text) out.push({ role, text });
  }

  return out;
}
