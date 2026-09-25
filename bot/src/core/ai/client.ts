/**
 * client.ts — One DeepSeek client for the agent, the tools and vision.
 *
 * deepseek-flash does tool calls, JSON output and image input, so a single
 * model covers everything. DEEPSEEK_MODEL / DEEPSEEK_VISION_MODEL exist only
 * so either can be swapped without a code change.
 */

import OpenAI from 'openai';

let _client: OpenAI | null = null;
export function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    });
  }
  return _client;
}

export const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';

/**
 * deepseek-flash thinks by default, and its hidden reasoning tokens count
 * against max_tokens — a budget sized for the answer alone gets the answer cut
 * off mid-sentence. Judgement calls (review, drafting, the chat) keep thinking
 * and get large budgets; mechanical jobs (transcription, summaries) turn it
 * off. The SDK has no type for this field, so it is spread in untyped.
 */
export const NO_THINKING = { thinking: { type: 'disabled' } } as Record<string, unknown>;
export const VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL || 'deepseek-flash';

// deepseek-flash list prices (cache miss), USD per 1M tokens.
const PRICE_INPUT_PER_M = 0.15;
const PRICE_OUTPUT_PER_M = 0.6;

export function logCost(usage: OpenAI.CompletionUsage | undefined, label: string): void {
  if (!usage) return;
  const cost =
    (usage.prompt_tokens / 1_000_000) * PRICE_INPUT_PER_M +
    (usage.completion_tokens / 1_000_000) * PRICE_OUTPUT_PER_M;
  console.log(
    `[ai] in=${usage.prompt_tokens} out=${usage.completion_tokens} $${cost.toFixed(5)} — ${label}`
  );
}

/**
 * Run a completion that must return a JSON object. Returns null (and logs)
 * when the output is truncated or unparseable, so callers can turn that into
 * a tool error the agent can explain in words.
 */
export async function completeJson<T>(params: {
  system: string;
  user: string;
  maxTokens: number;
  label: string;
  temperature?: number;
}): Promise<T | null> {
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: params.temperature ?? 0.2,
    max_tokens: params.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  });
  logCost(res.usage, params.label);

  const choice = res.choices[0];
  if (choice?.finish_reason === 'length') {
    console.error(`[ai] ${params.label}: output truncated at ${params.maxTokens} tokens`);
    return null;
  }
  try {
    return JSON.parse(choice?.message?.content ?? '') as T;
  } catch {
    console.error(`[ai] ${params.label}: invalid JSON`);
    return null;
  }
}
