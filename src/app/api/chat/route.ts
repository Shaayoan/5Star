import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { today as todayIso } from '@/lib/dates';
import { getChatContext, loadChatSession, saveChatSession } from '@/lib/ai/context';
import { buildSystemPrompt } from '@/lib/ai/prompt';
import { CHAT_TOOLS, toProposal, type Proposal } from '@/lib/ai/tools';
import {
  ANTHROPIC_API_KEY,
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  MAX_HISTORY_MESSAGES,
  MAX_TOOL_ROUNDS,
  isAiConfigured,
} from '@/lib/ai/config';

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAiConfigured) {
    return NextResponse.json(
      { error: 'The chat needs an ANTHROPIC_API_KEY to be set on the server.' },
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

  const date = todayIso();
  const ctx = await getChatContext(db, user.id, date);

  if (ctx.pillars.length === 0) {
    return NextResponse.json(
      { error: 'No pillars are available to the chat. Enable at least one on the Pillars page.' },
      { status: 400 },
    );
  }

  const history = await loadChatSession(db, user.id, date);
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-MAX_HISTORY_MESSAGES),
    { role: 'user', content: message },
  ];

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const system = buildSystemPrompt(ctx);

  const proposals: Proposal[] = [];
  let reply = '';

  try {
    // The model may call several tools before it has anything to say, so the
    // request/tool-result exchange repeats until it produces a plain answer.
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: CHAT_MAX_TOKENS,
        system,
        tools: CHAT_TOOLS,
        messages,
      });

      for (const block of response.content) {
        if (block.type === 'text') reply += block.text;
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      messages.push({ role: 'assistant', content: response.content });

      if (toolUses.length === 0 || response.stop_reason !== 'tool_use') break;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const proposal = toProposal(use.name, use.input);
        if (proposal) proposals.push(proposal);
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: proposal
            ? 'Noted as a proposal. The user has not confirmed it yet.'
            : 'Rejected — the arguments did not match the schema.',
          is_error: !proposal,
        });
      }

      messages.push({ role: 'user', content: results });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `The model call failed: ${detail}` }, { status: 502 });
  }

  await saveChatSession(db, user.id, date, messages);

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
