/**
 * memory.ts — Conversation history for the model.
 *
 * Take the most recent N turns (newest-first query, then reversed), and fold
 * anything older into a running summary so long conversations don't lose
 * context by falling out of the window.
 */

import type OpenAI from 'openai';
import { desc, eq, sql } from 'drizzle-orm';

import { db } from '../../db';
import { messages } from '../../db/schema';

/** How many raw turns to keep verbatim. */
export const RECENT_TURNS = 24;

/** Beyond this, the older tail gets summarised instead of dropped. */
export const SUMMARY_TRIGGER = 40;

export interface LoadedHistory {
  turns: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  /** Non-null when older messages were folded into a summary. */
  summary: string | null;
  totalMessages: number;
}

/**
 * Load the most recent turns of one thread, oldest-first (the order the
 * model expects). Optionally summarises everything older than the recent
 * window. Scoped to a conversation, not a whole user — that's what keeps
 * separate threads from bleeding into each other's context.
 */
export async function loadHistory(
  conversationId: number,
  opts: { summarise?: (older: string) => Promise<string> } = {}
): Promise<LoadedHistory> {
  const recentDesc = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(RECENT_TURNS);

  const recent = recentDesc.reverse();

  const turns = recent
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const [{ count } = { count: 0 }] = await db
    .select({ count: countRows() })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  const total = Number(count);

  let summary: string | null = null;
  if (total > SUMMARY_TRIGGER && opts.summarise) {
    const olderDesc = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(SUMMARY_TRIGGER)
      .offset(RECENT_TURNS);

    const older = olderDesc
      .reverse()
      .filter((m) => m.content.trim().length > 0)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    if (older.trim()) {
      try {
        summary = await opts.summarise(older);
      } catch (err) {
        console.error('[memory] summarisation failed, continuing without:', err);
      }
    }
  }

  return { turns, summary, totalMessages: total };
}

// drizzle's count() helper moved between versions; spell it out instead.
function countRows() {
  return sql<number>`count(*)`;
}
