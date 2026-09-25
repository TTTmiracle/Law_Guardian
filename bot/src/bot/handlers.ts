/**
 * handlers.ts — Telegram in, agent out.
 *
 * The only branching before the agent is "what kind of input is this", because
 * file bytes and images have to become text first. What to *do* with the
 * input is always the agent's decision (see core/service.ts).
 */

import { InlineKeyboard, InputFile, type Context } from 'grammy';
import { eq } from 'drizzle-orm';

import { bot } from './instance';
import { db } from '../db';
import { documents, messages, users } from '../db/schema';
import { FALLBACK, type AgentEvent } from '../core/ai/agent';
import type { GroundedAnalysis } from '../core/documents/analyze';
import { createRevision } from '../core/revision';
import {
  MAX_FILE_BYTES,
  ingestFile,
  ingestImages,
  isImage,
  runTurn,
  uploadNote,
  type IngestResult,
} from '../core/service';
import { pdfFileName } from '../core/documents/render';
import { t, langOf, verifiedLine, fairCaption, type Lang } from './i18n';

/**
 * Telegram clients split long pastes into several messages sent back to back,
 * and deliver an album as one message per photo. Both are collected for this
 * long before anything is processed.
 */
const GATHER_MS = 1500;

const TELEGRAM_LIMIT = 4000;

// ─── Users ────────────────────────────────────────────────────────────────────

async function upsertUser(ctx: Context): Promise<number> {
  const from = ctx.from!;
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || null;
  const [row] = await db
    .insert(users)
    .values({ telegramId: from.id, name })
    .onConflictDoUpdate({ target: users.telegramId, set: { name } })
    .returning({ id: users.id });
  return row.id;
}

// ─── Per-user serialisation ───────────────────────────────────────────────────

/** Each AI job costs real money; generous for a person, a wall for a script. */
const PER_USER_PER_HOUR = 40;
const hits = new Map<number, number[]>();

function allowAi(telegramId: number): boolean {
  const now = Date.now();
  const recent = (hits.get(telegramId) ?? []).filter((t) => now - t < 3600_000);
  const ok = recent.length < PER_USER_PER_HOUR;
  if (ok) recent.push(now);
  hits.set(telegramId, recent);
  return ok;
}

/** One job at a time per user, so two quick messages can't interleave tool calls. */
const queues = new Map<number, Promise<void>>();

function enqueue(telegramId: number, job: () => Promise<void>): void {
  const prev = queues.get(telegramId) ?? Promise.resolve();
  const next = prev.then(job).catch((err) => console.error('[bot] job failed:', err));
  queues.set(telegramId, next);
  next.finally(() => {
    if (queues.get(telegramId) === next) queues.delete(telegramId);
  });
}

// ─── Sending ──────────────────────────────────────────────────────────────────

function keepTyping(chatId: number): () => void {
  const tick = () => bot.api.sendChatAction(chatId, 'typing').catch(() => {});
  tick();
  const timer = setInterval(tick, 4500);
  return () => clearInterval(timer);
}

async function sendLong(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
  let rest = text;
  while (rest.length > 0) {
    let cut = rest.length;
    if (cut > TELEGRAM_LIMIT) {
      cut = rest.lastIndexOf('\n\n', TELEGRAM_LIMIT);
      if (cut < TELEGRAM_LIMIT / 2) cut = rest.lastIndexOf('\n', TELEGRAM_LIMIT);
      if (cut < TELEGRAM_LIMIT / 2) cut = TELEGRAM_LIMIT;
    }
    const chunk = rest.slice(0, cut).trim();
    rest = rest.slice(cut).trim();
    // Buttons go on the last chunk, so they sit under the end of the answer.
    await bot.api.sendMessage(chatId, chunk, rest.length === 0 && keyboard ? { reply_markup: keyboard } : {});
  }
}

/**
 * One status message that edits itself as the agent works, showing the real
 * steps. After a review it ends on the quote-check result and stays, as a
 * receipt; otherwise it is removed once the answer arrives.
 */
function statusLine(chatId: number, lang: Lang) {
  let id: number | null = null;
  let keep = false;
  let chain = Promise.resolve();
  const set = (text: string) => {
    chain = chain.then(async () => {
      if (id === null) id = (await bot.api.sendMessage(chatId, text).catch(() => null))?.message_id ?? null;
      else await bot.api.editMessageText(chatId, id, text).catch(() => {});
    });
  };
  return {
    onEvent(e: AgentEvent) {
      if (keep) return;
      if (e.type === 'tool' && e.phase === 'start') {
        if (e.name === 'analyze_document') set(t(lang, 'stReviewing'));
        else if (e.name === 'draft_contract') set(t(lang, 'stDrafting'));
        else if (e.name === 'propose_revisions') set(t(lang, 'stRevising'));
      } else if (e.type === 'tool' && e.phase === 'done' && e.name === 'analyze_document' && e.ok) {
        set(verifiedLine(lang, e.verified ?? 0, e.rejected ?? 0));
        keep = true;
      } else if (e.type === 'writing' && id !== null) {
        set(t(lang, 'stWriting'));
      }
    },
    async finish() {
      await chain;
      if (!keep && id !== null) await bot.api.deleteMessage(chatId, id).catch(() => {});
    },
  };
}

/** Buttons under a review, when a fair version can actually be produced. */
async function reviewKeyboard(docId: number, lang: Lang): Promise<InlineKeyboard | undefined> {
  const [doc] = await db
    .select({ kind: documents.kind, summary: documents.summary })
    .from(documents)
    .where(eq(documents.id, docId));
  const a = doc?.summary as GroundedAnalysis | null;
  if (doc?.kind !== 'reviewed' || !a?.risky_clauses?.some((c) => c.rewrite)) return undefined;
  return new InlineKeyboard()
    .text(t(lang, 'btnFair'), `fair:${docId}`)
    .row()
    .text(t(lang, 'btnMessage'), `msg:${docId}`);
}

// ─── The one path into the agent ──────────────────────────────────────────────

async function answer(chatId: number, userId: number, userMessage: string, lang: Lang): Promise<void> {
  const stopTyping = keepTyping(chatId);
  const status = statusLine(chatId, lang);
  try {
    const result = await runTurn(userId, userMessage, (e) => status.onEvent(e));
    stopTyping();
    await status.finish();
    const keyboard =
      result.focusDocumentId && !result.generatedDocumentId
        ? await reviewKeyboard(result.focusDocumentId, lang)
        : undefined;
    await sendLong(chatId, result.reply, keyboard);

    if (result.generatedDocumentId) {
      const [doc] = await db
        .select({ title: documents.title, pdf: documents.pdf })
        .from(documents)
        .where(eq(documents.id, result.generatedDocumentId));
      if (doc?.pdf) {
        await bot.api.sendChatAction(chatId, 'upload_document').catch(() => {});
        await bot.api.sendDocument(chatId, new InputFile(doc.pdf, pdfFileName(doc.title)));
      }
    }
  } catch (err) {
    console.error('[bot] agent run failed:', err);
    await status.finish();
    await bot.api.sendMessage(chatId, FALLBACK).catch(() => {});
  } finally {
    stopTyping();
  }
}

/** Hand a successful upload to the agent, or explain why it could not be read. */
async function afterIngest(ctx: Context, userId: number, result: IngestResult, caption?: string) {
  if (!result.ok) {
    await ctx.reply(t(langOf(ctx), result.reason));
    return;
  }
  await answer(ctx.chat!.id, userId, uploadNote(result.title, result.docId, result.text, caption), langOf(ctx));
}

async function download(fileId: string): Promise<Buffer> {
  const file = await bot.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Text: re-join split pastes ───────────────────────────────────────────────

const textBuffers = new Map<number, { parts: string[]; timer: NodeJS.Timeout }>();

function onText(ctx: Context): void {
  const from = ctx.from!;
  const chatId = ctx.chat!.id;
  const text = ctx.message!.text!;

  const pending = textBuffers.get(from.id);
  if (pending) {
    clearTimeout(pending.timer);
    pending.parts.push(text);
  }
  const entry = pending ?? { parts: [text], timer: undefined as unknown as NodeJS.Timeout };
  entry.timer = setTimeout(() => {
    textBuffers.delete(from.id);
    const joined = entry.parts.join('\n');
    if (!allowAi(from.id)) {
      void ctx.reply(t(langOf(ctx), 'rateLimited')).catch(() => {});
      return;
    }
    enqueue(from.id, async () => {
      const userId = await upsertUser(ctx);
      await answer(chatId, userId, joined, langOf(ctx));
    });
  }, GATHER_MS);
  textBuffers.set(from.id, entry);
}

// ─── Photos: collect albums into one multi-page document ──────────────────────

interface PendingImages {
  images: Array<{ fileId: string; mime: string }>;
  caption?: string;
  timer: NodeJS.Timeout;
}
const albums = new Map<string, PendingImages>();

function queueImage(ctx: Context, fileId: string, mime: string): void {
  const from = ctx.from!;
  const msg = ctx.message!;
  const key = msg.media_group_id ? `g:${msg.media_group_id}` : `m:${msg.message_id}`;

  const pending = albums.get(key);
  if (pending) {
    clearTimeout(pending.timer);
    pending.images.push({ fileId, mime });
    pending.caption ??= msg.caption;
  }
  const entry: PendingImages = pending ?? {
    images: [{ fileId, mime }],
    caption: msg.caption,
    timer: undefined as unknown as NodeJS.Timeout,
  };
  entry.timer = setTimeout(() => {
    albums.delete(key);
    if (!allowAi(from.id)) {
      void ctx.reply(t(langOf(ctx), 'rateLimited')).catch(() => {});
      return;
    }
    enqueue(from.id, () => processImages(ctx, entry));
  }, GATHER_MS);
  albums.set(key, entry);
}

async function processImages(ctx: Context, pending: PendingImages): Promise<void> {
  const chatId = ctx.chat!.id;
  const userId = await upsertUser(ctx);

  await ctx.reply(t(langOf(ctx), 'readingPhotos'));
  const stopTyping = keepTyping(chatId);
  let result: IngestResult;
  try {
    const images = await Promise.all(
      pending.images.map(async (img) => ({ buffer: await download(img.fileId), mime: img.mime }))
    );
    result = await ingestImages(userId, images);
  } catch (err) {
    console.error('[bot] photo transcription failed:', err);
    await ctx.reply(FALLBACK);
    return;
  } finally {
    stopTyping();
  }
  await afterIngest(ctx, userId, result, pending.caption);
}

// ─── Files ────────────────────────────────────────────────────────────────────

async function onDocument(ctx: Context): Promise<void> {
  const file = ctx.message!.document!;

  if ((file.file_size ?? 0) > MAX_FILE_BYTES) {
    await ctx.reply(t(langOf(ctx), 'tooBig'));
    return;
  }

  // An image sent "as file" (uncompressed) is still a photo of a document.
  if (isImage(file.mime_type)) {
    queueImage(ctx, file.file_id, file.mime_type!);
    return;
  }

  if (!allowAi(ctx.from!.id)) {
    await ctx.reply(t(langOf(ctx), 'rateLimited'));
    return;
  }
  enqueue(ctx.from!.id, async () => {
    const userId = await upsertUser(ctx);
    const result = await ingestFile(userId, await download(file.file_id), file.file_name, file.mime_type);
    await afterIngest(ctx, userId, result, ctx.message!.caption);
  });
}

// ─── Wiring ───────────────────────────────────────────────────────────────────

export function setupHandlers(): void {
  bot.command(['start', 'help'], async (ctx) => {
    await upsertUser(ctx);
    await ctx.reply(t(langOf(ctx), 'welcome'));
  });

  // Forget the conversation, keep the documents.
  bot.command('new', async (ctx) => {
    const userId = await upsertUser(ctx);
    await db.delete(messages).where(eq(messages.userId, userId));
    await ctx.reply(t(langOf(ctx), 'newDone'));
  });

  // ✍️ Fair version: deterministic, no model call, so it answers instantly.
  bot.callbackQuery(/^fair:(\d+)$/, async (ctx) => {
    const lang = langOf(ctx);
    const userId = await upsertUser(ctx);
    const docId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery().catch(() => {});
    const r = await createRevision(userId, docId, lang);
    if (!r.ok) {
      await ctx.reply(t(lang, r.reason === 'notAnalyzed' ? 'notAnalyzed' : 'nothingToChange'));
      return;
    }
    const [doc] = await db.select({ pdf: documents.pdf }).from(documents).where(eq(documents.id, r.docId));
    await ctx.replyWithDocument(new InputFile(doc.pdf!, pdfFileName(r.title)), {
      caption: fairCaption(lang, r.changes),
    });
    // Keep the agent aware of what was sent, for follow-up questions.
    await db.insert(messages).values([
      { userId, role: 'user', content: `[Pressed "Fair version" for document #${docId}.]` },
      {
        userId,
        role: 'assistant',
        content: `[Sent a tracked-changes counter-proposal as PDF: document #${r.docId}, ${r.changes} changes.]`,
      },
    ]);
  });

  // ✉️ Message to the other side: an ordinary agent turn with a fixed request.
  bot.callbackQuery(/^msg:(\d+)$/, async (ctx) => {
    const lang = langOf(ctx);
    await ctx.answerCallbackQuery().catch(() => {});
    if (!allowAi(ctx.from.id)) {
      await ctx.reply(t(lang, 'rateLimited'));
      return;
    }
    enqueue(ctx.from.id, async () => {
      const userId = await upsertUser(ctx);
      await answer(ctx.chat!.id, userId, t(lang, 'messageOtherPrompt'), lang);
    });
  });

  bot.on('message:text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    onText(ctx);
  });

  bot.on('message:photo', (ctx) => {
    // Telegram sends several sizes; the last is the largest.
    const largest = ctx.message.photo[ctx.message.photo.length - 1];
    queueImage(ctx, largest.file_id, 'image/jpeg');
  });

  bot.on('message:document', (ctx) => onDocument(ctx));

  bot.catch((err) => console.error('[bot] unhandled:', err.error));
}

/** Command menu and profile texts, in each language Telegram can show them in. */
export async function setupBotProfile(): Promise<void> {
  const langs: Array<[Lang, 'ru' | 'uz' | undefined]> = [['en', undefined], ['ru', 'ru'], ['uz', 'uz']];
  for (const [lang, code] of langs) {
    const opts = code ? { language_code: code } : {};
    try {
      await bot.api.setMyCommands(
        [
          { command: 'start', description: t(lang, 'cmdStart') },
          { command: 'new', description: t(lang, 'cmdNew') },
          { command: 'help', description: t(lang, 'cmdHelp') },
        ],
        opts
      );
      await bot.api.setMyShortDescription(t(lang, 'botShort'), opts);
      await bot.api.setMyDescription(t(lang, 'botDescription'), opts);
    } catch (err) {
      console.warn(`[bot] profile setup (${lang}) failed:`, (err as Error).message);
    }
  }
}
