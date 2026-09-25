/**
 * tools.ts — What the assistant can actually do.
 *
 * Every tool returns a plain JSON object that goes straight back to the
 * model. Tools never throw at the model — failures come back as
 * { ok: false, error } so it can recover in words.
 *
 * Every document query is scoped by ctx.userId. Never relax those predicates:
 * contracts are personal data.
 */

import type OpenAI from 'openai';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '../../db';
import { documents } from '../../db/schema';
import { analyzeContract } from '../documents/analyze';
import { draftContract, draftToText } from '../documents/draft';
import { renderContractPdf } from '../documents/render';
import { createRevision } from '../revision';

// ─── Context passed to every executor ────────────────────────────────────────

export interface ToolContext {
  userId: number;
  /** The message being answered — save_document stores this, so the model never re-types a contract. */
  userMessage: string;
}

export interface ToolResult {
  ok: boolean;
  [key: string]: unknown;
}

// ─── Schemas advertised to the model ─────────────────────────────────────────

export const TOOL_SCHEMAS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'save_document',
      description:
        "Save the user's current message as a contract to review. Use when they pasted " +
        'contract text into the chat. Not needed for uploaded files or photos — those are ' +
        'already saved and the note gives their doc_id.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short label, e.g. "Apartment lease".' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_document',
      description:
        'Review a saved contract: summary, key terms, risky clauses (each backed by a verified ' +
        'quote) and missing protections. Call before telling the user anything about its risks.',
      parameters: {
        type: 'object',
        properties: {
          doc_id: { type: 'number' },
          language: {
            type: 'string',
            description: 'Language and script to explain in, e.g. "Uzbek Latin", "Russian".',
          },
        },
        required: ['doc_id', 'language'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_document',
      description:
        'Read the full text of a saved or drafted document, plus its stored analysis or draft ' +
        'details. Use to answer follow-up questions from the real text, or before revising a draft.',
      parameters: {
        type: 'object',
        properties: { doc_id: { type: 'number' } },
        required: ['doc_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_documents',
      description: "List this user's recent documents (reviewed and drafted) with their ids.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_revisions',
      description:
        'Turn a reviewed contract into a counter-proposal PDF with tracked changes: each risky ' +
        'clause struck through and replaced by fairer wording, plus a summary page to hand to ' +
        'the other side. Use when the user wants a fair/fixed version of a contract they had ' +
        'reviewed. The document must have been analysed first.',
      parameters: {
        type: 'object',
        properties: {
          doc_id: { type: 'number' },
          language: {
            type: 'string',
            description: 'Language of the user, for the PDF headings, e.g. "Uzbek Latin".',
          },
        },
        required: ['doc_id', 'language'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_contract',
      description:
        'Write a complete, printable contract and send it to the user as a PDF. Call only once ' +
        'the essentials for this contract type are known. Returns the new doc_id.',
      parameters: {
        type: 'object',
        properties: {
          contract_type: {
            type: 'string',
            description: 'e.g. "apartment rental", "loan between individuals", "services agreement".',
          },
          language: {
            type: 'string',
            description: 'Language and script of the contract, e.g. "Uzbek Latin", "Russian".',
          },
          details: {
            type: 'string',
            description:
              'Every agreed fact, one per line: parties and their roles, subject, amounts and ' +
              'currency, payment schedule, dates/term, deposit, special conditions, and the ' +
              'defaults you chose.',
          },
        },
        required: ['contract_type', 'language', 'details'],
      },
    },
  },
];

// ─── Executors ────────────────────────────────────────────────────────────────

type Executor = (args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult>;

const MIN_CONTRACT_CHARS = 150;
const MAX_RETURNED_CHARS = 60_000;

async function ownDocument(docId: unknown, userId: number) {
  const id = Number(docId);
  if (!Number.isInteger(id)) return null;
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return row ?? null;
}

const executors: Record<string, Executor> = {
  // ── save_document ──────────────────────────────────────────────────────────
  async save_document(args, ctx) {
    const text = ctx.userMessage.trim();
    if (text.length < MIN_CONTRACT_CHARS) {
      return {
        ok: false,
        error: 'That message is too short to be a contract.',
        note: 'Ask them to paste the whole contract, or send it as a file or photos.',
      };
    }
    const [row] = await db
      .insert(documents)
      .values({
        userId: ctx.userId,
        kind: 'reviewed',
        title: args.title ? String(args.title).slice(0, 255) : null,
        rawText: text,
      })
      .returning({ id: documents.id });
    return { ok: true, doc_id: row.id, characters: text.length };
  },

  // ── analyze_document ───────────────────────────────────────────────────────
  async analyze_document(args, ctx) {
    const doc = await ownDocument(args.doc_id, ctx.userId);
    if (!doc) return { ok: false, error: 'No such document. Call list_documents.' };
    if (doc.kind !== 'reviewed') {
      return { ok: false, error: 'That is a contract you drafted, not one to review.' };
    }

    const analysis = await analyzeContract(doc.rawText, String(args.language || 'English'));
    if (!analysis) {
      return {
        ok: false,
        error: 'The review did not complete.',
        note: 'Apologise briefly and offer to try again.',
      };
    }

    await db.update(documents).set({ summary: analysis }).where(eq(documents.id, doc.id));

    // Rejected clauses stay in the DB for evaluation but never reach the model,
    // so it cannot repeat a claim we could not verify.
    const { rejected_clauses, ...shown } = analysis;
    return {
      ok: true,
      doc_id: doc.id,
      ...shown,
      checked_quotes: { verified: shown.risky_clauses.length, rejected: rejected_clauses.length },
      note:
        shown.risky_clauses.length === 0
          ? 'No verifiable risky clauses. Say so honestly, and mention any missing protections.'
          : 'Report these grounded clauses, most serious first. Do not add risks that are not listed here.',
    };
  },

  // ── get_document ───────────────────────────────────────────────────────────
  async get_document(args, ctx) {
    const doc = await ownDocument(args.doc_id, ctx.userId);
    if (!doc) return { ok: false, error: 'No such document. Call list_documents.' };

    const truncated = doc.rawText.length > MAX_RETURNED_CHARS;
    return {
      ok: true,
      doc_id: doc.id,
      kind: doc.kind,
      title: doc.title,
      text: truncated ? doc.rawText.slice(0, MAX_RETURNED_CHARS) : doc.rawText,
      truncated,
      stored: doc.summary ?? null,
    };
  },

  // ── list_documents ─────────────────────────────────────────────────────────
  async list_documents(_args, ctx) {
    const rows = await db
      .select({
        id: documents.id,
        kind: documents.kind,
        title: documents.title,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.userId, ctx.userId))
      .orderBy(desc(documents.createdAt))
      .limit(10);

    return {
      ok: true,
      documents: rows.map((r) => ({
        doc_id: r.id,
        kind: r.kind,
        title: r.title,
        created: r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      })),
    };
  },

  // ── propose_revisions ──────────────────────────────────────────────────────
  async propose_revisions(args, ctx) {
    const r = await createRevision(ctx.userId, Number(args.doc_id), String(args.language || 'English'));
    if (!r.ok) {
      const error = {
        notFound: 'No such reviewed document. Call list_documents.',
        notAnalyzed: 'This contract has not been analysed yet. Call analyze_document first.',
        nothingToChange: 'The review found no clauses that need rewording.',
      }[r.reason];
      return { ok: false, error };
    }
    return {
      ok: true,
      doc_id: r.docId,
      title: r.title,
      changes: r.changes,
      note:
        'The tracked-changes PDF is sent right after your reply. Say in two or three sentences ' +
        'what it contains and suggest sending it to the other party as a starting point for ' +
        'negotiation. Do not list every change again.',
    };
  },

  // ── draft_contract ─────────────────────────────────────────────────────────
  async draft_contract(args, ctx) {
    const contractType = String(args.contract_type ?? '').trim();
    const language = String(args.language ?? '').trim() || 'English';
    const details = String(args.details ?? '').trim();
    if (!contractType || details.length < 20) {
      return { ok: false, error: 'Not enough details to draft. Ask for the essentials first.' };
    }

    const draft = await draftContract({ contractType, language, details });
    if (!draft) {
      return {
        ok: false,
        error: 'Drafting did not complete.',
        note: 'Apologise briefly and offer to try again.',
      };
    }

    const pdf = await renderContractPdf(draft);
    const [row] = await db
      .insert(documents)
      .values({
        userId: ctx.userId,
        kind: 'drafted',
        title: draft.title.slice(0, 255),
        rawText: draftToText(draft),
        summary: { contract_type: contractType, language, details },
        pdf,
      })
      .returning({ id: documents.id });

    return {
      ok: true,
      doc_id: row.id,
      title: draft.title,
      sections: draft.sections.map((s) => s.heading),
      note:
        'The PDF is sent right after your reply. Summarise the key terms in a few lines, say ' +
        'blank lines are for passport data and signatures, and remind them to read it before signing.',
    };
  },
};

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function runTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext
): Promise<ToolResult> {
  const exec = executors[name];
  if (!exec) return { ok: false, error: `Unknown tool "${name}".` };

  let args: Record<string, any> = {};
  if (rawArgs && rawArgs.trim()) {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return { ok: false, error: 'Arguments were not valid JSON. Try again.' };
    }
  }

  try {
    return await exec(args, ctx);
  } catch (err) {
    console.error(`[tool:${name}] failed:`, err);
    return {
      ok: false,
      error: 'Something went wrong on our side.',
      note: 'Apologise briefly and offer to try again.',
    };
  }
}
