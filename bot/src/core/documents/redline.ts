/**
 * redline.ts — A reviewed contract → a counter-proposal with tracked changes.
 *
 * No model call: the review already produced a fairer rewrite for each flagged
 * clause, and grounding already knows exactly where each clause sits in the
 * text. Replacing those spans is deterministic, instant and free — and every
 * change points at wording that really is in the contract.
 */

import PDFDocument from 'pdfkit';
import * as path from 'path';

import { locateQuote, type GroundedAnalysis, type Severity } from './analyze';

const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
const REGULAR = path.join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD = path.join(FONT_DIR, 'NotoSans-Bold.ttf');

const REMOVED = '#b42318';
const ADDED = '#1e6b43';
const MUTED = '#666666';

export interface Change {
  original: string;
  proposed: string;
  reason: string;
  severity: Severity;
}

export interface Revision {
  segments: Array<{ text: string; kind: 'same' | 'removed' | 'added' }>;
  changes: Change[];
  /** The contract as it would read with every change accepted. */
  cleanText: string;
}

export function buildRevision(rawText: string, analysis: GroundedAnalysis): Revision | null {
  const spans = analysis.risky_clauses
    .filter((c) => c.rewrite && c.rewrite.trim())
    .map((c) => ({ c, span: locateQuote(c.quote, rawText) }))
    .filter((x): x is { c: (typeof analysis.risky_clauses)[number]; span: [number, number] } => !!x.span)
    .sort((a, b) => a.span[0] - b.span[0]);

  const segments: Revision['segments'] = [];
  const changes: Change[] = [];
  let pos = 0;
  for (const { c, span } of spans) {
    const [start, end] = span;
    if (start < pos) continue; // overlapping quotes — the earlier change wins
    if (start > pos) segments.push({ text: rawText.slice(pos, start), kind: 'same' });
    const original = rawText.slice(start, end);
    segments.push({ text: original, kind: 'removed' });
    segments.push({ text: c.rewrite!.trim(), kind: 'added' });
    changes.push({ original, proposed: c.rewrite!.trim(), reason: c.issue, severity: c.severity });
    pos = end;
  }
  if (changes.length === 0) return null;
  if (pos < rawText.length) segments.push({ text: rawText.slice(pos), kind: 'same' });

  const cleanText = segments
    .filter((s) => s.kind !== 'removed')
    .map((s) => s.text)
    .join('');
  return { segments, changes, cleanText };
}

/** Labels for the PDF chrome, in the language the user is working in. */
const LABELS: Record<string, { heading: string; legend: string; summary: string; why: string; was: string; now: string }> = {
  uz: {
    heading: "TAKLIF ETILAYOTGAN O'ZGARISHLAR",
    legend: "Qizil va o'chirilgan — olib tashlash taklifi. Yashil va tagiga chizilgan — taklif etilayotgan yangi matn.",
    summary: "O'zgarishlar ro'yxati",
    why: 'Sabab',
    was: 'Hozir',
    now: 'Taklif',
  },
  ru: {
    heading: 'ПРЕДЛАГАЕМЫЕ ИЗМЕНЕНИЯ',
    legend: 'Красный зачёркнутый текст — предлагается удалить. Зелёный подчёркнутый — предлагаемая новая редакция.',
    summary: 'Перечень изменений',
    why: 'Причина',
    was: 'Сейчас',
    now: 'Предлагается',
  },
  en: {
    heading: 'PROPOSED CHANGES',
    legend: 'Red struck-through text is proposed for removal. Green underlined text is the proposed new wording.',
    summary: 'Summary of changes',
    why: 'Why',
    was: 'Now',
    now: 'Proposed',
  },
};

export function labelsFor(language: string) {
  const l = language.toLowerCase();
  if (l.includes('uzbek') || l.startsWith('uz')) return LABELS.uz;
  if (l.includes('russian') || l.startsWith('ru')) return LABELS.ru;
  return LABELS.en;
}

type Run = Revision['segments'][number];

/** Split styled segments at newlines into lines of runs. */
function toLines(segments: Run[]): Run[][] {
  const lines: Run[][] = [[]];
  for (const seg of segments) {
    seg.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind: seg.kind });
    });
  }
  return lines;
}

export function renderRedlinePdf(title: string, rev: Revision, language: string): Promise<Buffer> {
  const L = labelsFor(language);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 64, left: 64, right: 56 },
      bufferPages: true,
      info: { Title: `${L.heading} — ${title}` },
    });
    doc.registerFont('Regular', REGULAR);
    doc.registerFont('Bold', BOLD);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.font('Bold').fontSize(13).fillColor('#1c2330').text(L.heading, left, doc.y, { width, align: 'center' });
    doc.moveDown(0.3);
    doc.font('Regular').fontSize(10).fillColor(MUTED).text(title, { width, align: 'center' });
    doc.moveDown(0.6);
    doc.fontSize(8.5).text(L.legend, { width, align: 'center' });
    doc.moveDown(1.2);

    // ── The contract, with changes inline ───────────────────────────────────
    // pdfkit's `continued` mode misplaces text after a newline inside a run, so
    // runs are split into lines first and only chained within one line.
    doc.fontSize(10.5);
    for (const line of toLines(rev.segments)) {
      if (line.every((r) => !r.text.trim())) {
        doc.moveDown(0.6);
        continue;
      }
      line.forEach((run, i) => {
        const opts = { width, continued: i < line.length - 1, lineGap: 2 } as PDFKit.Mixins.TextOptions;
        const at: [number?, number?] = i === 0 ? [left, doc.y] : [];
        if (run.kind === 'removed') {
          doc.font('Regular').fillColor(REMOVED).text(run.text, ...at, { ...opts, strike: true, underline: false });
        } else if (run.kind === 'added') {
          const text = i > 0 ? ` ${run.text}` : run.text;
          doc.font('Bold').fillColor(ADDED).text(text, ...at, { ...opts, strike: false, underline: true });
        } else {
          doc.font('Regular').fillColor('#1c2330').text(run.text, ...at, { ...opts, strike: false, underline: false });
        }
      });
    }

    // ── Summary page: a checklist to hand to the other side ─────────────────
    doc.addPage();
    doc.font('Bold').fontSize(13).fillColor('#1c2330').text(L.summary, { width });
    doc.moveDown(0.8);
    rev.changes.forEach((c, i) => {
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.font('Bold').fontSize(10.5).fillColor('#1c2330').text(`${i + 1}.`, { width, continued: true });
      doc.font('Regular').fillColor(MUTED).text(`  ${L.was}: `, { continued: true });
      doc.fillColor(REMOVED).text(c.original, { width, strike: true });
      doc.font('Regular').fillColor(MUTED).text(`${L.now}: `, { width, continued: true, strike: false });
      doc.font('Bold').fillColor(ADDED).text(c.proposed, { width });
      doc.font('Regular').fontSize(9.5).fillColor(MUTED).text(`${L.why}: ${c.reason}`, { width });
      doc.moveDown(0.9);
    });

    // ── Page numbers ─────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      doc.page.margins.bottom = 0;
      doc.font('Regular').fontSize(8).fillColor(MUTED)
        .text(`${p + 1} / ${range.count}`, left, doc.page.height - 40, { width, align: 'center' });
      doc.page.margins.bottom = 64;
    }
    doc.end();
  });
}
