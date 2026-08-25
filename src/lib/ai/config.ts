import { ThinkingLevel } from '@google/genai';

/** Model choice by job, per docs/FORMULAS.md §12.
 *
 *  The extraction loop runs on every chat message — frequent, latency-sensitive
 *  and cheap, which is Flash's job. The weekly review runs once a week over a
 *  whole week of notes and is the thing people actually read, so it gets Pro.
 */
/** Google retires model aliases faster than this app will be redeployed — a
 *  hardcoded name went stale within a day of being written. Both are therefore
 *  overridable by env var. To see what your key can currently reach:
 *
 *    curl -H "x-goog-api-key: $GEMINI_API_KEY" \
 *      https://generativelanguage.googleapis.com/v1beta/models
 */
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.6-flash';

/** Ideally the weekly review would run on a Pro model — it reasons over a whole
 *  week of notes and is the thing people actually read. But Pro returns 429 on a
 *  free-tier key, so the working default is Flash. With billing enabled, set
 *  GEMINI_NARRATIVE_MODEL=gemini-3.1-pro-preview for noticeably better reviews. */
export const NARRATIVE_MODEL = process.env.GEMINI_NARRATIVE_MODEL ?? 'gemini-3.6-flash';

/**
 * Gemini 3 counts *thinking* tokens against `maxOutputTokens`. A 700-token cap
 * looked generous for a two-sentence reply but was spending ~670 of it on
 * internal reasoning, leaving nothing for the function calls — the chat replied
 * politely and extracted nothing. The budget has to cover thinking as well as
 * the answer.
 */
export const CHAT_MAX_TOKENS = 2000;
export const NARRATIVE_MAX_TOKENS = 3000;

/** Extraction is a shallow task; low thinking keeps it fast and leaves room for
 *  the tool calls. The weekly review is the opposite — it should think. */
export const CHAT_THINKING_LEVEL = ThinkingLevel.LOW;

/** Guard against a tool loop that never settles. */
export const MAX_TOOL_ROUNDS = 6;

/** Conversations are capped so a long day cannot grow an unbounded prompt. */
export const MAX_HISTORY_MESSAGES = 40;

export const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';

/** Like Supabase, the AI features degrade to an explanatory screen rather than
 *  crashing when the key is absent. */
export const isAiConfigured = Boolean(GEMINI_API_KEY);
