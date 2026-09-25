/**
 * agent.ts — One brain.
 *
 * The model drives the whole conversation and acts through tools. There is
 * no mode switch between "review" and "draft": it reads what the user sent
 * and decides, so they can review a lease, ask a question, then ask for a
 * new contract in the same chat without anything getting stuck.
 */

import type OpenAI from 'openai';

import { client, logCost, MODEL, NO_THINKING } from './client';
import { buildSystemPrompt } from './persona';
import { loadHistory } from './memory';
import { TOOL_SCHEMAS, runTool, type ToolContext } from './tools';

/** Safety valve so a confused model can't loop forever on tool calls. */
const MAX_TOOL_ROUNDS = 6;

export interface AgentResult {
  /** What to send to the user. */
  reply: string;
  /** Tools that actually ran, for logging. */
  toolsUsed: string[];
  /** Set when draft_contract produced a PDF the bot layer should send. */
  generatedDocumentId: number | null;
  /** The document this turn reviewed or drafted, so a viewer can open it. */
  focusDocumentId: number | null;
  /** Set when save_document stored the user's message as a contract. */
  savedDocumentId: number | null;
}

export const FALLBACK =
  "Kechirasiz, xatolik yuz berdi — birozdan so'ng qayta urinib ko'ring.\n" +
  'Извините, произошла ошибка — попробуйте ещё раз через минуту.\n' +
  'Sorry, something went wrong — please try again in a minute.';

async function summarise(older: string): Promise<string> {
  const res = await client().chat.completions.create({
    ...NO_THINKING,
    model: MODEL,
    temperature: 0.2,
    max_tokens: 250,
    messages: [
      {
        role: 'system',
        content:
          'Summarise this conversation between a user and a contract assistant in under 120 ' +
          'words. Keep only what still matters: which documents were discussed (with doc ids), ' +
          'contract details agreed so far, and open questions. Terse notes, not prose.',
      },
      { role: 'user', content: older },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}

/**
 * What the agent is doing right now, for live progress in the UI. Emitted as
 * it happens — never a timer pretending to know.
 */
export type AgentEvent =
  | { type: 'tool'; name: string; phase: 'start' }
  | { type: 'tool'; name: string; phase: 'done'; ok: boolean; verified?: number; rejected?: number }
  | { type: 'writing' };

export async function respond(params: {
  userId: number;
  userMessage: string;
  onEvent?: (e: AgentEvent) => void;
}): Promise<AgentResult> {
  const { userId, userMessage } = params;
  const emit = (e: AgentEvent) => {
    try {
      params.onEvent?.(e);
    } catch {
      /* a broken listener must not break the answer */
    }
  };

  const ctx: ToolContext = { userId, userMessage };
  const toolsUsed: string[] = [];
  let generatedDocumentId: number | null = null;
  let focusDocumentId: number | null = null;
  let savedDocumentId: number | null = null;

  const history = await loadHistory(userId, { summarise });

  const systemParts = [buildSystemPrompt()];
  if (history.summary) {
    systemParts.push(`[EARLIER IN THIS CONVERSATION]\n${history.summary}`);
  }

  const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemParts.join('\n\n') },
    ...history.turns,
    { role: 'user', content: userMessage },
  ];

  const done = (reply: string): AgentResult => ({
    reply: reply || FALLBACK,
    toolsUsed,
    generatedDocumentId,
    focusDocumentId,
    savedDocumentId,
  });

  // ── Tool-calling loop ─────────────────────────────────────────────────────
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (toolsUsed.length > 0) emit({ type: 'writing' });
    let completion;
    try {
      completion = await client().chat.completions.create({
        model: MODEL,
        messages: convo,
        tools: TOOL_SCHEMAS,
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: 8000,
      });
    } catch (err) {
      console.error('[ai] completion failed:', err);
      return done(FALLBACK);
    }

    logCost(completion.usage, `round ${round + 1}`);

    const msg = completion.choices[0]?.message;
    if (!msg) return done(FALLBACK);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) return done(msg.content?.trim() ?? '');

    convo.push(msg);

    for (const call of calls) {
      const name = call.function.name;
      emit({ type: 'tool', name, phase: 'start' });
      const result = await runTool(name, call.function.arguments, ctx);
      const q = result.checked_quotes as { verified: number; rejected: number } | undefined;
      emit({ type: 'tool', name, phase: 'done', ok: result.ok, verified: q?.verified, rejected: q?.rejected });

      toolsUsed.push(name);
      if (result.ok && typeof result.doc_id === 'number') {
        if (name === 'draft_contract' || name === 'propose_revisions') generatedDocumentId = result.doc_id;
        if (name === 'save_document') savedDocumentId = result.doc_id;
        if (['analyze_document', 'draft_contract', 'propose_revisions'].includes(name)) {
          focusDocumentId = result.doc_id;
        }
      }
      console.log(`[tool] ${name} → ${result.ok ? 'ok' : `failed: ${result.error}`}`);

      convo.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Ran out of rounds — ask for a plain answer with no further tools.
  try {
    const final = await client().chat.completions.create({
      model: MODEL,
      messages: [
        ...convo,
        {
          role: 'system',
          content: "Stop using tools. Answer the user now, in their language, with what you have.",
        },
      ],
      temperature: 0.4,
      max_tokens: 6000,
    });
    logCost(final.usage, 'final');
    return done(final.choices[0]?.message?.content?.trim() ?? '');
  } catch (err) {
    console.error('[ai] final completion failed:', err);
    return done(FALLBACK);
  }
}
