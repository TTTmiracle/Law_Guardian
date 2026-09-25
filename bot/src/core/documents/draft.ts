/**
 * draft.ts — Generate a complete contract as structured data.
 *
 * The model returns sections and clauses, not a formatted page. Layout is the
 * renderer's job (render.ts), so every contract comes out with the same
 * numbering, spacing and signature block no matter what the model felt like.
 */

import { completeJson } from '../ai/client';

export interface ContractDraft {
  title: string;
  city: string;
  date: string;
  preamble: string;
  sections: Array<{ heading: string; clauses: string[] }>;
  signatures: Array<{ role: string; name: string; lines: string[] }>;
}

const SYSTEM = `You draft contracts between ordinary people and small businesses, by default under the law of the Republic of Uzbekistan. The result is printed and signed by hand, so it must be complete and self-contained.

Return a JSON object:
{
  "title": string,          // e.g. "IJARA SHARTNOMASI", "ДОГОВОР ЗАЙМА", "SERVICES AGREEMENT" — in capitals
  "city": string,           // e.g. "Toshkent sh." / "г. Ташкент"; blank line "__________" if unknown
  "date": string,           // the agreed date, or a blank to fill in by hand: «___» __________ 20__
  "preamble": string,       // who the parties are and that they agree as follows
  "sections": [{ "heading": string, "clauses": string[] }],
  "signatures": [{ "role": string, "name": string, "lines": string[] }]
}

Structure — use the sections that fit the contract type, in this order, in the output language:
subject of the contract; rights and obligations of each party; price/amount and payment procedure; term and handover (where relevant); liability and penalties; force majeure; dispute resolution; termination; final provisions (effective date, number of copies, equal legal force).

Rules:
- Use every fact in the details. Never invent names, amounts, dates or addresses.
- Anything personal that is not given (passport series/number, address, phone, bank details, dates not agreed) is a blank line "____________" for handwriting — never a placeholder like [NAME].
- Penalties and obligations must be balanced between the parties, not one-sided.
- Clauses are full sentences, without numbering (numbering is added when printed). No markdown.
- Each signature block: role (e.g. "Ijaraga beruvchi" / "Арендодатель" / "Landlord"), full name if known else a blank, and lines for passport, address, phone and "Imzo / Подпись / Signature ________".
- Write everything in the requested language and script only.
- When writing Uzbek, use standard literary Uzbek legal vocabulary, not Russian loanwords or their transliterations: tilxat (never raspiska), ijara (not arenda), garov puli (not zalog), shartnoma (not dogovor), pasport (not passport). Month names: yanvar, fevral, mart, aprel, may, iyun, iyul, avgust, sentabr, oktabr, noyabr, dekabr.`;

export async function draftContract(params: {
  contractType: string;
  language: string;
  details: string;
}): Promise<ContractDraft | null> {
  const draft = await completeJson<ContractDraft>({
    system: SYSTEM,
    user:
      `Contract type: ${params.contractType}\n` +
      `Output language: ${params.language}\n\n` +
      `Agreed details:\n${params.details}`,
    maxTokens: 16000,
    temperature: 0.3,
    label: 'draft_contract',
  });

  if (!draft || !Array.isArray(draft.sections) || draft.sections.length === 0) return null;

  return {
    title: draft.title || params.contractType.toUpperCase(),
    city: draft.city || '__________',
    date: draft.date || '«___» __________ 20__',
    preamble: draft.preamble || '',
    sections: draft.sections
      .filter((s) => s && s.heading && Array.isArray(s.clauses))
      .map((s) => ({ heading: s.heading, clauses: s.clauses.filter(Boolean) })),
    signatures: Array.isArray(draft.signatures) ? draft.signatures : [],
  };
}

/** Plain-text version, stored as raw_text so the draft can be reviewed or quoted later. */
export function draftToText(d: ContractDraft): string {
  const out: string[] = [d.title, `${d.city}    ${d.date}`, '', d.preamble, ''];
  d.sections.forEach((s, i) => {
    out.push(`${i + 1}. ${s.heading}`);
    s.clauses.forEach((c, j) => out.push(`${i + 1}.${j + 1}. ${c}`));
    out.push('');
  });
  for (const sig of d.signatures) {
    out.push(sig.role, sig.name, ...sig.lines, '');
  }
  return out.join('\n');
}
