/**
 * server.ts — The web app: same agent, same documents, in a browser.
 *
 * Visitors are anonymous: a random session cookie becomes a user row, the
 * same way a Telegram id does. Every document route checks that the document
 * belongs to that session — contracts are personal data.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { documents, messages, users } from '../db/schema';
import { FALLBACK } from '../core/ai/agent';
import {
  MAX_FILE_BYTES,
  ingestFile,
  ingestImages,
  isImage,
  runTurn,
  uploadNote,
} from '../core/service';
import { locateQuote, type GroundedAnalysis } from '../core/documents/analyze';
import { pdfFileName } from '../core/documents/render';
import { createRevision } from '../core/revision';

const PUBLIC_DIR = path.resolve(__dirname, '../../web/public');
const EVAL_SUMMARY = path.resolve(__dirname, '../../eval/summary.json');
const COOKIE = 'lg_sid';
const SID_RE = /^[a-f0-9]{48}$/;
const MAX_MESSAGE_CHARS = 100_000;

/** multer decodes filenames as latin1; browsers send UTF-8 (e.g. "договор.pdf"). */
function fileName(raw: string): string {
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? raw : utf8;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function readSid(req: Request): string | null {
  const sid = req.cookies?.[COOKIE];
  return typeof sid === 'string' && SID_RE.test(sid) ? sid : null;
}

async function findUser(req: Request): Promise<number | null> {
  const sid = readSid(req);
  if (!sid) return null;
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.webSessionId, sid));
  return row?.id ?? null;
}

async function ensureUser(req: Request, res: Response): Promise<number> {
  let sid = readSid(req);
  if (!sid) {
    sid = randomBytes(24).toString('hex');
    res.cookie(COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: 30 * 24 * 3600 * 1000,
    });
  }
  const [row] = await db
    .insert(users)
    .values({ webSessionId: sid })
    .onConflictDoUpdate({ target: users.webSessionId, set: { webSessionId: sid } })
    .returning({ id: users.id });
  return row.id;
}

// ─── Abuse limits ─────────────────────────────────────────────────────────────
// A public demo link spends real API money on every message. These caps are
// generous for a person and stop a script.

const PER_USER_PER_HOUR = 40;
const GLOBAL_PER_HOUR = 600;
const hits = new Map<string, number[]>();

function allow(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** One AI job at a time per visitor, like the Telegram queue. */
const busy = new Set<number>();

type Emit = (event: Record<string, unknown>) => void;

/**
 * Run one AI job and stream it as NDJSON: `progress` lines while the agent
 * works (real steps, as they happen), then one `result` line. Refusals before
 * the job starts (busy, rate limit) are plain JSON with an error status.
 */
async function guardedTurn(
  res: Response,
  userId: number,
  work: (emit: Emit) => Promise<Record<string, unknown>>
): Promise<void> {
  if (busy.has(userId)) {
    res.status(409).json({ error: 'busy' });
    return;
  }
  if (!allow(`u:${userId}`, PER_USER_PER_HOUR) || !allow('global', GLOBAL_PER_HOUR)) {
    res.status(429).json({ error: 'rateLimited' });
    return;
  }
  busy.add(userId);
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no'); // don't let a proxy hold the stream back
  const line = (obj: Record<string, unknown>) => res.write(JSON.stringify(obj) + '\n');
  try {
    // Nested, not spread: the event's own `type` would overwrite 'progress'.
    const out = await work((event) => line({ type: 'progress', event }));
    line({ type: 'result', ...out });
  } catch (err) {
    console.error('[web] turn failed:', err);
    line({ type: 'result', error: 'failed', reply: FALLBACK });
  } finally {
    busy.delete(userId);
    res.end();
  }
}

// ─── Document view model ──────────────────────────────────────────────────────

async function ownDocument(req: Request) {
  const userId = await findUser(req);
  const id = Number(req.params.id);
  if (!userId || !Number.isInteger(id)) return null;
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return doc ?? null;
}

function analysisView(text: string, stored: unknown) {
  const a = stored as Partial<GroundedAnalysis> | null;
  if (!a || !Array.isArray(a.risky_clauses)) return null;

  const risks = a.risky_clauses
    .map((c) => {
      const span = locateQuote(c.quote, text);
      return span
        ? {
            start: span[0],
            end: span[1],
            severity: c.severity,
            issue: c.issue,
            suggestion: c.suggestion,
            rewrite: c.rewrite ?? null,
          }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    summary: a.summary ?? '',
    overall_risk: a.overall_risk ?? 'medium',
    key_terms: a.key_terms ?? [],
    missing_protections: a.missing_protections ?? [],
    risks,
    manipulation: a.ai_manipulation
      ? { text: a.ai_manipulation, span: locateQuote(a.ai_manipulation, text) }
      : null,
    canRevise: risks.some((r) => !!r.rewrite),
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────

const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export function createWebApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    // A CSP on the PDF response itself stops Chrome's built-in viewer from
    // starting (it renders a black box), and a PDF runs no page scripts anyway.
    if (!req.path.endsWith('/pdf')) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob:; frame-src 'self'; object-src 'self'; frame-ancestors 'self'; base-uri 'none'"
      );
    }
    next();
  });

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(PUBLIC_DIR));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 10 },
  });

  // ── Chat ────────────────────────────────────────────────────────────────────
  app.post(
    '/api/chat',
    asyncRoute(async (req, res) => {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!message || message.length > MAX_MESSAGE_CHARS) {
        res.status(400).json({ error: 'badMessage' });
        return;
      }
      const userId = await ensureUser(req, res);
      await guardedTurn(res, userId, async (emit) => {
        const r = await runTurn(userId, message, emit);
        return { reply: r.reply, focusDocumentId: r.focusDocumentId };
      });
    })
  );

  // ── Upload: one PDF/DOCX/TXT, or photos of one document's pages ────────────
  app.post(
    '/api/upload',
    upload.array('files', 10),
    asyncRoute(async (req, res) => {
      const files = (req.files as Express.Multer.File[]) ?? [];
      const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';
      if (files.length === 0) {
        res.status(400).json({ error: 'noFile' });
        return;
      }
      const allImages = files.every((f) => isImage(f.mimetype));
      if (!allImages && files.length > 1) {
        res.status(400).json({ error: 'oneFileOrPhotos' });
        return;
      }

      const userId = await ensureUser(req, res);
      await guardedTurn(res, userId, async (emit) => {
        emit({ type: 'reading', source: allImages ? 'photos' : 'file', count: files.length });
        const result = allImages
          ? await ingestImages(userId, files.map((f) => ({ buffer: f.buffer, mime: f.mimetype })))
          : await ingestFile(userId, files[0].buffer, fileName(files[0].originalname), files[0].mimetype);

        if (!result.ok) return { error: result.reason };
        emit({ type: 'read', chars: result.text.length });

        const note = uploadNote(result.title, result.docId, result.text, caption);
        const r = await runTurn(userId, note, emit);
        return { reply: r.reply, focusDocumentId: r.focusDocumentId ?? result.docId };
      });
    })
  );

  // ── History, for restoring the chat after a reload ─────────────────────────
  app.get(
    '/api/history',
    asyncRoute(async (req, res) => {
      const userId = await findUser(req);
      if (!userId) {
        res.json({ messages: [] });
        return;
      }
      const rows = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.createdAt))
        .limit(60);
      res.json({ messages: rows.reverse() });
    })
  );

  // ── Documents ───────────────────────────────────────────────────────────────
  app.get(
    '/api/documents',
    asyncRoute(async (req, res) => {
      const userId = await findUser(req);
      if (!userId) {
        res.json({ documents: [] });
        return;
      }
      const rows = await db
        .select({
          id: documents.id,
          kind: documents.kind,
          title: documents.title,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(eq(documents.userId, userId))
        .orderBy(desc(documents.createdAt))
        .limit(30);
      res.json({ documents: rows });
    })
  );

  app.get(
    '/api/documents/:id',
    asyncRoute(async (req, res) => {
      const doc = await ownDocument(req);
      if (!doc) {
        res.status(404).json({ error: 'notFound' });
        return;
      }
      res.json({
        id: doc.id,
        kind: doc.kind,
        title: doc.title,
        createdAt: doc.createdAt,
        text: doc.rawText,
        hasPdf: !!doc.pdf,
        analysis: doc.kind === 'reviewed' ? analysisView(doc.rawText, doc.summary) : null,
      });
    })
  );

  app.get(
    '/api/documents/:id/pdf',
    asyncRoute(async (req, res) => {
      const doc = await ownDocument(req);
      if (!doc?.pdf) {
        res.status(404).end();
        return;
      }
      const name = pdfFileName(doc.title);
      const disposition = req.query.download ? 'attachment' : 'inline';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="contract.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`
      );
      res.send(doc.pdf);
    })
  );

  // ── One-click fair version: no model call, so it is instant ──────────────
  app.post(
    '/api/documents/:id/revision',
    asyncRoute(async (req, res) => {
      const userId = await findUser(req);
      if (!userId) {
        res.status(404).json({ error: 'notFound' });
        return;
      }
      if (!allow(`u:${userId}`, PER_USER_PER_HOUR)) {
        res.status(429).json({ error: 'rateLimited' });
        return;
      }
      const lang = ['uz', 'ru', 'en'].includes(req.body?.lang) ? req.body.lang : 'en';
      const r = await createRevision(userId, Number(req.params.id), lang);
      if (!r.ok) {
        res.status(r.reason === 'notFound' ? 404 : 422).json({ error: r.reason });
        return;
      }
      res.json({ documentId: r.docId, title: r.title, changes: r.changes });
    })
  );

  // ── Red-team results, as last measured by eval/run.ts ──────────────────────
  app.get('/api/eval', (_req, res) => {
    try {
      res.json(JSON.parse(fs.readFileSync(EVAL_SUMMARY, 'utf8')));
    } catch {
      res.status(404).json({ error: 'notFound' });
    }
  });

  // ── Start over: forget this browser's session ──────────────────────────────
  app.post('/api/reset', (_req, res) => {
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  });

  // ── Errors ──────────────────────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'tooBig' : 'oneFileOrPhotos' });
      return;
    }
    console.error('[web] error:', err);
    res.status(500).json({ error: 'failed' });
  });

  return app;
}
