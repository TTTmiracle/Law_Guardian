/**
 * conversations.ts — Threads within one device's chat.
 *
 * Telegram and the eval suite never create or pick a thread explicitly — they
 * call runTurn() without one and always get "the most recently active, or a
 * new one" (see service.ts). That keeps their behaviour exactly what it
 * always was: one continuous history per user. Multiple, nameable threads
 * are a web-only feature, built on the same table.
 */

import { and, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { conversations } from '../db/schema';

export interface ConversationSummary {
  id: number;
  title: string | null;
  updatedAt: Date;
}

export async function createConversation(userId: number, title?: string): Promise<number> {
  const [row] = await db
    .insert(conversations)
    .values({ userId, title: title?.trim().slice(0, 255) || null })
    .returning({ id: conversations.id });
  return row.id;
}

/** The most recently active thread for this user, or a fresh empty one. */
export async function getOrCreateDefaultConversation(userId: number): Promise<number> {
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  return existing ? existing.id : createConversation(userId);
}

export async function listConversations(userId: number): Promise<ConversationSummary[]> {
  return db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
}

/** Every request that names a conversation must prove it owns it first. */
export async function ownsConversation(userId: number, conversationId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  return !!row;
}

const UPLOAD_OR_PASTE_NOTE = /^\[The user [^\]]*\]\n?/;

/** A short label for the thread list, from the user's own first words. */
function autoTitle(rawMessage: string): string | null {
  const stripped = rawMessage.replace(UPLOAD_OR_PASTE_NOTE, '').trim();
  if (!stripped) return null; // a bare upload with no caption — leave it dated, not mistitled
  const oneLine = stripped.replace(/\s+/g, ' ');
  return oneLine.length > 60 ? oneLine.slice(0, 57) + '…' : oneLine;
}

/** Bumps updatedAt so the thread sorts to the top, and titles it once. */
export async function touchConversation(conversationId: number, rawUserMessage: string): Promise<void> {
  const [row] = await db
    .select({ title: conversations.title })
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!row) return; // deleted mid-request — nothing to touch

  const patch: { updatedAt: Date; title?: string } = { updatedAt: new Date() };
  if (!row.title) {
    const title = autoTitle(rawUserMessage);
    if (title) patch.title = title;
  }
  await db.update(conversations).set(patch).where(eq(conversations.id, conversationId));
}
