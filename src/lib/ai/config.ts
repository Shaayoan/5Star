/** Model choice by job, per docs/FORMULAS.md §12.
 *
 *  The extraction loop runs on every chat message — frequent, latency-sensitive
 *  and cheap, which is Haiku's job. The weekly narrative runs once a week over a
 *  whole week of notes and is the thing people actually read, so it gets Sonnet.
 */
export const CHAT_MODEL = 'claude-haiku-4-5-20251001';
export const NARRATIVE_MODEL = 'claude-sonnet-4-5';

/** Chat replies are short by design; the model should ask one question, not
 *  deliver an essay. */
export const CHAT_MAX_TOKENS = 700;
export const NARRATIVE_MAX_TOKENS = 900;

/** Guard against a tool loop that never settles. */
export const MAX_TOOL_ROUNDS = 6;

/** Conversations are capped so a long day cannot grow an unbounded prompt. */
export const MAX_HISTORY_MESSAGES = 40;

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

/** Like Supabase, the AI features degrade to an explanatory screen rather than
 *  crashing when the key is absent. */
export const isAiConfigured = Boolean(ANTHROPIC_API_KEY);
