/**
 * revision.ts — Store a tracked-changes counter-proposal for a reviewed contract.
 * Shared by the agent tool and the web app's one-click button.
 */

import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { documents } from '../db/schema';
import type { GroundedAnalysis } from './documents/analyze';
import { buildRevision, labelsFor, renderRedlinePdf } from './documents/redline';

export type RevisionResult =
  | { ok: true; docId: number; title: string; changes: number }
  | { ok: false; reason: 'notFound' | 'notAnalyzed' | 'nothingToChange' };

/**
 * Turn a reviewed contract into a tracked-changes counter-proposal, stored as
 * a new PDF document. Deterministic: it only applies rewrites the review
 * already produced, at positions grounding already verified.
 */
export async function createRevision(
  userId: number,
  docId: number,
  language: string
): Promise<RevisionResult> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, userId)));
  if (!doc || doc.kind !== 'reviewed') return { ok: false, reason: 'notFound' };
  if (!doc.summary) return { ok: false, reason: 'notAnalyzed' };

  const rev = buildRevision(doc.rawText, doc.summary as GroundedAnalysis);
  if (!rev) return { ok: false, reason: 'nothingToChange' };

  const base = doc.title || `#${doc.id}`;
  const pdf = await renderRedlinePdf(base, rev, language);
  const title = `${labelsFor(language).heading} — ${base}`.slice(0, 255);
  const [row] = await db
    .insert(documents)
    .values({
      userId,
      kind: 'drafted',
      title,
      rawText: rev.cleanText,
      summary: { revision_of: doc.id, changes: rev.changes },
      pdf,
    })
    .returning({ id: documents.id });
  return { ok: true, docId: row.id, title, changes: rev.changes.length };
}
