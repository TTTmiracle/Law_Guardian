/**
 * extract.ts — Uploaded file → plain text.
 *
 * A scanned PDF has no text layer and comes back (nearly) empty; the caller
 * treats that as "send photos instead" rather than reviewing a blank page.
 */

import mammoth from 'mammoth';

// pdf-parse's index.js runs a self-test that reads a sample file when it
// thinks it is the main module, which crashes under tsx. The lib entry skips it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> = require('pdf-parse/lib/pdf-parse.js');

export type SupportedKind = 'pdf' | 'docx' | 'txt';

export function detectKind(fileName?: string, mime?: string): SupportedKind | null {
  const name = (fileName ?? '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (mime === 'text/plain' || name.endsWith('.txt')) return 'txt';
  return null;
}

export async function extractText(buffer: Buffer, kind: SupportedKind): Promise<string> {
  switch (kind) {
    case 'pdf': {
      const { text } = await pdfParse(buffer);
      return tidy(text);
    }
    case 'docx': {
      const { value } = await mammoth.extractRawText({ buffer });
      return tidy(value);
    }
    case 'txt':
      return tidy(buffer.toString('utf8'));
  }
}

/** Below this, a "document" is a scan or a blank — not something to review. */
export const MIN_USEFUL_CHARS = 150;

function tidy(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
