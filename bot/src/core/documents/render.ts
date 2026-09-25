/**
 * render.ts — ContractDraft → printable A4 PDF.
 *
 * pdfkit's built-in fonts are Latin-1 only; Cyrillic and the Uzbek oʻ/gʻ
 * would print as garbage. Noto Sans (OFL) is bundled in assets/fonts so the
 * output is identical on any machine.
 */

import PDFDocument from 'pdfkit';
import * as path from 'path';

import type { ContractDraft } from './draft';

const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
const REGULAR = path.join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD = path.join(FONT_DIR, 'NotoSans-Bold.ttf');

const MARGIN = { top: 56, bottom: 64, left: 70, right: 56 };
const BODY = 10.5;

export function renderContractPdf(d: ContractDraft): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: MARGIN,
      bufferPages: true,
      info: { Title: d.title },
    });
    doc.registerFont('Regular', REGULAR);
    doc.registerFont('Bold', BOLD);

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = MARGIN.left;
    const width = doc.page.width - MARGIN.left - MARGIN.right;

    // ── Title ────────────────────────────────────────────────────────────────
    doc.font('Bold').fontSize(14).text(d.title, left, MARGIN.top, { width, align: 'center' });
    doc.moveDown(1.2);

    // ── City (left) and date (right) on one line ─────────────────────────────
    const y = doc.y;
    doc.font('Regular').fontSize(BODY).text(d.city, left, y, { width: width / 2 });
    doc.text(d.date, left + width / 2, y, { width: width / 2, align: 'right' });
    doc.x = left;
    doc.moveDown(1.2);

    // ── Preamble ─────────────────────────────────────────────────────────────
    if (d.preamble) {
      doc.font('Regular').fontSize(BODY).text(d.preamble, left, doc.y, {
        width,
        align: 'justify',
        lineGap: 2,
      });
      doc.moveDown(0.8);
    }

    // ── Numbered sections ────────────────────────────────────────────────────
    d.sections.forEach((s, i) => {
      // Keep a heading with at least its first couple of lines.
      if (doc.y > doc.page.height - MARGIN.bottom - 60) doc.addPage();

      doc.moveDown(0.4);
      doc.font('Bold').fontSize(BODY).text(`${i + 1}. ${s.heading}`, left, doc.y, {
        width,
        align: 'center',
      });
      doc.moveDown(0.4);

      s.clauses.forEach((c, j) => {
        doc.font('Regular').fontSize(BODY).text(`${i + 1}.${j + 1}. ${c}`, left, doc.y, {
          width,
          align: 'justify',
          lineGap: 2,
        });
        doc.moveDown(0.3);
      });
    });

    // ── Signature blocks, side by side ───────────────────────────────────────
    if (d.signatures.length > 0) {
      const lineCount = Math.max(...d.signatures.map((s) => s.lines.length + 2));
      const blockHeight = lineCount * 18 + 40;
      if (doc.y + blockHeight > doc.page.height - MARGIN.bottom) doc.addPage();
      else doc.moveDown(1.5);

      const cols = Math.min(d.signatures.length, 2);
      const gap = 24;
      const colWidth = (width - gap * (cols - 1)) / cols;
      let rowTop = doc.y;
      let rowBottom = doc.y;

      d.signatures.forEach((sig, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) {
          rowTop = rowBottom + 20;
          if (rowTop + blockHeight > doc.page.height - MARGIN.bottom) {
            doc.addPage();
            rowTop = MARGIN.top;
          }
        }
        const x = left + col * (colWidth + gap);

        doc.font('Bold').fontSize(BODY).text(sig.role, x, rowTop, { width: colWidth });
        doc.font('Regular').fontSize(BODY);
        if (sig.name) doc.text(sig.name, x, doc.y + 2, { width: colWidth });
        for (const line of sig.lines) doc.text(line, x, doc.y + 6, { width: colWidth });
        rowBottom = Math.max(rowBottom, doc.y);
      });
      doc.x = left;
      doc.y = rowBottom;
    }

    // ── Page numbers ─────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      // Writing inside the bottom margin would trigger an automatic page break.
      doc.page.margins.bottom = 0;
      doc.font('Regular').fontSize(8).fillColor('#666666').text(
        `${p + 1} / ${range.count}`,
        left,
        doc.page.height - 40,
        { width, align: 'center' }
      );
      doc.page.margins.bottom = MARGIN.bottom;
    }

    doc.end();
  });
}

/** Download name for a drafted contract, e.g. "QARZ_SHARTNOMASI.pdf". */
export function pdfFileName(title: string | null): string {
  const base = (title || 'contract')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return `${base || 'contract'}.pdf`;
}
