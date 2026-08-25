import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { userToday } from '@/lib/userDate';
import { getChatContext, loadChatSession, saveChatSession } from '@/lib/ai/context';
import { buildSystemPrompt } from '@/lib/ai/prompt';
import { CHAT_TOOLS, toProposal, type Proposal } from '@/lib/ai/tools';
import {
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  CHAT_THINKING_LEVEL,
  GEMINI_API_KEY,
  MAX_HISTORY_MESSAGES,
  MAX_TOOL_ROUNDS,
  isAiConfigured,
} from '@/lib/ai/config';

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAiConfigured) {
    return NextResponse.json(
      { error: 'The chat needs a GEMINI_API_KEY to be set on the server.' },
      { status: 503 },
    );
  }

  const { db, user } = await requireUser();

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  if (!message) return NextResponse.json({ error: 'Say something first.' }, { status: 400 });

  const date = await userToday(db, user.id);
  const ctx = await getChatContext(db, user.id, date);

  if (ctx.pillars.length === 0) {
    return NextResponse.json(
      { error: 'No pillars are available to the chat. Enable at least one on the Pillars page.' },
      { status: 400 },
    );
  }

  const history = await loadChatSession(db, user.id, date);
  const contents: Content[] = [
    ...history.slice(-MAX_HISTORY_MESSAGES),
    { role: 'user', parts: [{ text: message }] },
  ];

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const systemInstruction = buildSystemPrompt(ctx);

  const proposals: Proposal[] = [];
  let reply = '';

  try {
    // The model may call several functions before it has anything to say, so the
    // request / function-response exchange repeats until it produces prose.
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: CHAT_MAX_TOKENS,
          thinkingConfig: { thinkingLevel: CHAT_THINKING_LEVEL },
          tools: [{ functionDeclarations: CHAT_TOOLS }],
        },
      });

      if (response.text) reply += response.text;

      const calls = response.functionCalls ?? [];

      // Echo the model's own turn back *verbatim*, straight from the candidate.
      // Rebuilding the parts from `response.functionCalls` drops the
      // `thoughtSignature` that Gemini 3 attaches to each call, and the next
      // request is then rejected with "Function call is missing a
      // thought_signature".
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent?.parts?.length) contents.push(modelContent);

      if (calls.length === 0) break;

      const results: Part[] = [];
      for (const call of calls) {
        const name = call.name ?? '';
        const proposal = toProposal(name, call.args);
        if (proposal) proposals.push(proposal);
        results.push({
          functionResponse: {
            name,
            response: proposal
              ? { status: 'Noted as a proposal. The user has not confirmed it yet.' }
              : { error: 'Rejected — the arguments did not match the schema.' },
          },
        });
      }

      contents.push({ role: 'user', parts: results });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `The model call failed: ${detail}` }, { status: 502 });
  }

  await saveChatSession(db, user.id, date, contents);

  // Later proposals for the same pillar supersede earlier ones, so the user sees
  // one row per pillar rather than a running argument with itself.
  const deduped: Proposal[] = [];
  for (const p of proposals) {
    const key = p.kind === 'action' ? p.actionId : p.pillarId;
    const existing = deduped.findIndex(
      (q) => (q.kind === 'action' ? q.actionId : q.pillarId) === key,
    );
    if (existing >= 0) deduped[existing] = p;
    else deduped.push(p);
  }

  return NextResponse.json({
    reply: reply.trim() || 'Noted.',
    proposals: deduped,
  });
}
