/**
 * service.ts — What every channel does, independent of the channel.
 *
 * Telegram and the web app differ only in how bytes arrive and how replies
 * leave. Turning uploads into saved documents, and running one agent turn
 * with its history, happen here so both channels behave identically.
 */

import { db } from '../db';
import { documents, messages } from '../db/schema';
import { respond, type AgentEvent, type AgentResult } from './ai/agent';
import { transcribeImages } from './ai/vision';
import { detectKind, extractText, MIN_USEFUL_CHARS } from './documents/extract';
import { getOrCreateDefaultConversation, touchConversation } from './conversations';

/** Telegram's Bot API refuses downloads above this; the web uses the same cap. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Why an upload was not turned into a document — each maps to a user-facing message. */
export type IngestFailure = 'unsupported' | 'scannedPdf' | 'emptyFile' | 'unreadablePhoto';

export type IngestResult =
  | { ok: true; docId: number; title: string; text: string }
  | { ok: false; reason: IngestFailure };

export function isImage(mime?: string): boolean {
  return !!mime && /^image\/(jpeg|png|webp|gif)$/.test(mime);
}

async function saveUpload(userId: number, title: string, text: string): Promise<number> {
  const [row] = await db
    .insert(documents)
    .values({ userId, kind: 'reviewed', title: title.slice(0, 255), rawText: text })
    .returning({ id: documents.id });
  return row.id;
}

export async function ingestFile(
  userId: number,
  buffer: Buffer,
  fileName: string | undefined,
  mime: string | undefined
): Promise<IngestResult> {
  const kind = detectKind(fileName, mime);
  if (!kind) return { ok: false, reason: 'unsupported' };

  let text: string;
  try {
    text = await extractText(buffer, kind);
  } catch (err) {
    console.error('[ingest] extraction failed:', err);
    return { ok: false, reason: 'unsupported' };
  }
  if (text.length < MIN_USEFUL_CHARS) {
    return { ok: false, reason: kind === 'pdf' ? 'scannedPdf' : 'emptyFile' };
  }

  const title = fileName || `document.${kind}`;
  return { ok: true, docId: await saveUpload(userId, title, text), title, text };
}

/** Photos of one document's pages, in order. Throws on API failure. */
export async function ingestImages(
  userId: number,
  images: Array<{ buffer: Buffer; mime: string }>
): Promise<IngestResult> {
  const text = await transcribeImages(images);
  const readable = text.replace(/\[(unreadable|not a document)\]/g, '').trim();
  if (readable.length < MIN_USEFUL_CHARS) return { ok: false, reason: 'unreadablePhoto' };

  const n = images.length;
  const title = n === 1 ? 'Photo of a document' : `Photos of a document (${n} pages)`;
  return { ok: true, docId: await saveUpload(userId, title, text), title, text };
}

/** The message the agent sees for an upload — short, so history stays small. */
export function uploadNote(title: string, docId: number, text: string, caption?: string): string {
  const note =
    `[The user uploaded "${title}". It has been saved as document #${docId} ` +
    `(${text.length} characters).]`;
  return caption ? `${note}\n${caption}` : note;
}

export function pasteNote(docId: number, length: number): string {
  return `[The user pasted a contract. It has been saved as document #${docId} (${length} characters).]`;
}

/**
 * One conversational turn: answer, then record both sides.
 *
 * The message is saved only after the agent has answered — respond() loads
 * history itself and appends the new message, so saving it first would show
 * the model every message twice (it did, and doubled the cost of every
 * pasted contract, until the eval suite caught it).
 *
 * `conversationId` is optional so Telegram and the eval suite don't have to
 * know threads exist: omit it and the user's most recently active thread is
 * reused (or a new one created), which is exactly the single continuous
 * history this always had. The web app, which lets people hold several
 * threads at once, always passes one explicitly.
 */
export async function runTurn(
  userId: number,
  userMessage: string,
  onEvent?: (e: AgentEvent) => void,
  conversationId?: number
): Promise<AgentResult> {
  const convId = conversationId ?? (await getOrCreateDefaultConversation(userId));
  const result = await respond({ userId, conversationId: convId, userMessage, onEvent });
  // A pasted contract is now a stored document; history keeps a pointer rather
  // than re-sending thousands of characters with every later message.
  const content = result.savedDocumentId
    ? pasteNote(result.savedDocumentId, userMessage.length)
    : userMessage;
  await db.insert(messages).values({ userId, conversationId: convId, role: 'user', content });
  await db.insert(messages).values({ userId, conversationId: convId, role: 'assistant', content: result.reply });
  await touchConversation(convId, userMessage);
  return result;
}
