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

/** Chat replies are short by design; the model should ask one question, not
 *  deliver an essay. */
export const CHAT_MAX_TOKENS = 700;
export const NARRATIVE_MAX_TOKENS = 900;

/** Guard against a tool loop that never settles. */
export const MAX_TOOL_ROUNDS = 6;

/** Conversations are capped so a long day cannot grow an unbounded prompt. */
export const MAX_HISTORY_MESSAGES = 40;

export const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';

/** Like Supabase, the AI features degrade to an explanatory screen rather than
 *  crashing when the key is absent. */
export const isAiConfigured = Boolean(GEMINI_API_KEY);
