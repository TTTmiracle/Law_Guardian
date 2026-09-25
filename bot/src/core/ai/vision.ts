/**
 * vision.ts — Photos of a paper contract → text.
 *
 * All pages go in one request, in order, so a contract photographed as three
 * pictures comes back as one continuous document.
 */

import { client, logCost, NO_THINKING, VISION_MODEL } from './client';

const PROMPT = `These are photos of the pages of one document, in order. Transcribe the full text exactly as written, in its original language and script. Keep clause numbering and paragraph breaks. Do not translate, summarise, correct or comment. Where a word is unreadable write [unreadable]. If a photo does not contain a document, write [not a document] for it. Output only the transcription.`;

export async function transcribeImages(
  images: Array<{ buffer: Buffer; mime: string }>
): Promise<string> {
  const res = await client().chat.completions.create({
    ...NO_THINKING,
    model: VISION_MODEL,
    temperature: 0,
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          ...images.map((img) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${img.mime};base64,${img.buffer.toString('base64')}` },
          })),
        ],
      },
    ],
  });
  logCost(res.usage, `transcribe ${images.length} image(s)`);
  return res.choices[0]?.message?.content?.trim() ?? '';
}
