import { GoogleGenAI, ThinkingLevel, type Content, type GenerateContentConfig } from '@google/genai';
import { config } from '../config.js';
import { callGroq, GroqError } from './groq.js';

/**
 * The one entry point for AI calls (`generate`). Picks who answers and always reports token
 * usage + cost, so every call can be billed against the user's daily usage row.
 *  - Photos: Gemini only — best model first, on each Gemini key (each key = its own free quota).
 *  - Text only (coach, typed meals, reminders, item edits): Groq first (fast, separate quota), then Gemini.
 * Anything that refuses (out of quota, overloaded, denied) is skipped for a while.
 */

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export const ZERO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

// Hard per-call limit: without it a stuck request leaves a meal "analyzing" forever.
// 25 s: under load ("high demand") even tiny Gemini calls can take 10–15 s.
const CALL_TIMEOUT_MS = 25_000;
const clients = new Map<string, GoogleGenAI>();
const gemini = (apiKey: string) => {
  let c = clients.get(apiKey);
  if (!c) clients.set(apiKey, (c = new GoogleGenAI({ apiKey, httpOptions: { timeout: CALL_TIMEOUT_MS } })));
  return c;
};

export const geminiEnabled = () => Boolean(config.GEMINI_API_KEY);

/** Paid-tier USD per 1M tokens [input, output] for models we use; others fall back to the .env prices. */
const PRICES: Record<string, [number, number]> = {
  'gemini-3.8-flash': [0.75, 3.75],
  'gemini-3.6-flash': [0.75, 3.75],
  'gemini-3.5-flash-lite': [0.3, 2.5],
};

export function costOf(inputTokens: number, outputTokens: number, model = config.GEMINI_MODEL, provider: Provider = 'gemini'): number {
  const [inP, outP] =
    provider === 'groq'
      ? [config.GROQ_PRICE_INPUT_PER_M, config.GROQ_PRICE_OUTPUT_PER_M]
      : model === config.GEMINI_MODEL
        ? [config.GEMINI_PRICE_INPUT_PER_M, config.GEMINI_PRICE_OUTPUT_PER_M]
        : PRICES[model] ?? [config.GEMINI_PRICE_INPUT_PER_M, config.GEMINI_PRICE_OUTPUT_PER_M];
  const usd = (inputTokens / 1e6) * inP + (outputTokens / 1e6) * outP;
  return Math.round(usd * 1e8) / 1e8;
}

/**
 * Keep "thinking" minimal: these tasks are short and latency matters (the 2-second log).
 * Gemini 2.x takes a token budget; Gemini 3.x+ rejects that and takes a level instead.
 */
function thinkingConfig(model: string): GenerateContentConfig['thinkingConfig'] {
  if (/^gemini-2\./.test(model)) return /pro/.test(model) ? { thinkingBudget: 128 } : { thinkingBudget: 0 };
  return { thinkingLevel: ThinkingLevel.LOW };
}

// ─── Routing ─────────────────────────────────────────────────

export type Provider = 'gemini' | 'groq';
/** One thing to try. `id` names it in logs and cooldowns; it never contains the key itself. */
export interface Slot {
  id: string;
  provider: Provider;
  model: string;
  key: string;
}

/** Order of attempts (pure, so it can be tested). Gemini: each model on every key before the next model. */
export function planRoute(o: {
  textOnly: boolean;
  geminiKeys: string[];
  geminiModels: string[];
  groqKey: string;
  groqModels: string[];
}): Slot[] {
  const groq: Slot[] =
    o.textOnly && o.groqKey ? o.groqModels.map((model) => ({ id: `groq:${model}`, provider: 'groq', model, key: o.groqKey })) : [];
  const gem: Slot[] = o.geminiModels.flatMap((model) =>
    o.geminiKeys.map((key, i): Slot => ({ id: `gemini#${i + 1}:${model}`, provider: 'gemini', model, key })),
  );
  return [...groq, ...gem];
}

const list = (...values: string[]) =>
  values
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v, i, a) => v && a.indexOf(v) === i);

const routeFor = (textOnly: boolean) =>
  planRoute({
    textOnly,
    geminiKeys: list(config.GEMINI_API_KEY, config.GEMINI_API_KEY_2),
    geminiModels: list(config.GEMINI_MODEL, config.GEMINI_FALLBACK_MODEL),
    groqKey: config.GROQ_API_KEY,
    groqModels: list(config.GROQ_MODELS),
  });

/**
 * A slot that just refused is skipped until it's likely back, so requests don't spend their
 * time (or the free tier's ~20 requests/day per Gemini model) on something that will say no again.
 */
const coolingUntil = new Map<string, number>();
const HOUR = 3_600_000;

/**
 * How long to skip after this error. `wholeKey`: the key itself was refused, so every model on it.
 * null = the request itself is bad (another model won't help) → fail now.
 */
export function cooldownFor(err: unknown, provider: Provider): { ms: number; wholeKey?: boolean } | null {
  const msg = String((err as Error)?.message ?? err);
  const status = Number((err as { status?: number })?.status) || Number(/\b([45]\d\d)\b/.exec(msg)?.[1]) || 0;
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) {
    // Out of quota / rate-limited: the provider says when to retry (Gemini's daily quota: many hours).
    // Re-check at least hourly in case billing got turned on.
    const retryAfter =
      err instanceof GroqError && err.retryAfterMs
        ? err.retryAfterMs
        : Number(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(msg)?.[1]) * 1000 || 60_000;
    return { ms: Math.min(retryAfter, HOUR) };
  }
  if (status === 401 || status === 403 || /PERMISSION_DENIED|API_KEY_INVALID|API key not valid/i.test(msg)) {
    return { ms: HOUR, wholeKey: true }; // key revoked / project denied: try the other key
  }
  if (status === 404 || /NOT_FOUND/i.test(msg)) return { ms: HOUR }; // model retired
  if ((status >= 500 && status < 600) || /DEADLINE_EXCEEDED|UNAVAILABLE|overloaded|timed? ?out|aborted|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg)) {
    return { ms: 60_000 }; // busy right now
  }
  // Any other Groq problem (e.g. request too big for its per-minute limit): Gemini can still answer.
  if (provider === 'groq') return { ms: 0 };
  return null;
}

async function callGemini(model: string, apiKey: string, contents: Content[], base: GenerateContentConfig) {
  const call = (cfg: GenerateContentConfig) => gemini(apiKey).models.generateContent({ model, contents, config: cfg });
  try {
    return await call({ ...base, thinkingConfig: thinkingConfig(model) });
  } catch (err) {
    // Some models don't accept the thinking knob at all — retry once without it.
    if (/thinking/i.test(String((err as Error)?.message))) return call(base);
    throw err;
  }
}

const hasMedia = (contents: Content[]) => contents.some((c) => c.parts?.some((p) => p.inlineData || p.fileData));

export async function generate(opts: {
  contents: Content[];
  systemInstruction: string;
  json?: { schema: unknown };
  temperature?: number;
  maxOutputTokens?: number;
  /** Skip Groq even for text (the boot check, which is about the Gemini key). */
  geminiOnly?: boolean;
}): Promise<{ text: string; usage: AiUsage; model: string }> {
  const temperature = opts.temperature ?? 0.4;
  const maxOutputTokens = opts.maxOutputTokens ?? 1024;
  const base: GenerateContentConfig = {
    systemInstruction: opts.systemInstruction,
    temperature,
    maxOutputTokens,
    ...(opts.json ? { responseMimeType: 'application/json', responseJsonSchema: opts.json.schema } : {}),
  };

  const slots = routeFor(!opts.geminiOnly && !hasMedia(opts.contents));
  const isReady = (s: Slot) => (coolingUntil.get(s.id) ?? 0) <= Date.now();
  // Everything cooling down: try them all anyway rather than fail without asking.
  const tryAll = !slots.some(isReady);
  let lastErr: unknown = new Error('No AI model configured');

  for (const s of slots) {
    if (!tryAll && !isReady(s)) continue; // may have just been cooled with its whole key
    try {
      if (s.provider === 'groq') {
        const r = await callGroq(s.model, s.key, {
          contents: opts.contents,
          systemInstruction: opts.systemInstruction,
          schema: opts.json?.schema,
          temperature,
          maxOutputTokens,
          timeoutMs: CALL_TIMEOUT_MS,
        });
        coolingUntil.delete(s.id);
        return {
          text: r.text,
          usage: { inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: costOf(r.inputTokens, r.outputTokens, s.model, 'groq') },
          model: s.model,
        };
      }
      const res = await callGemini(s.model, s.key, opts.contents, base);
      coolingUntil.delete(s.id);
      const meta = res.usageMetadata ?? {};
      const inputTokens = (meta.promptTokenCount ?? 0) + (meta.toolUsePromptTokenCount ?? 0);
      const outputTokens = (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
      return { text: res.text ?? '', usage: { inputTokens, outputTokens, costUsd: costOf(inputTokens, outputTokens, s.model) }, model: s.model };
    } catch (err) {
      const cool = cooldownFor(err, s.provider);
      if (!cool) throw err; // bad request: another model won't help
      lastErr = err;
      const until = Date.now() + cool.ms;
      for (const t of cool.wholeKey ? slots.filter((x) => x.key === s.key) : [s]) coolingUntil.set(t.id, until);
      console.warn(
        `[ai] ${s.id} unavailable (${String((err as Error)?.message ?? err).slice(0, 120)}); ` +
          `skipping ${cool.wholeKey ? 'that key' : 'it'} for ${Math.round(cool.ms / 1000)} s`,
      );
    }
  }
  throw lastErr;
}

/** Parse model JSON defensively (strips ``` fences if a model adds them). */
export function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  return JSON.parse(cleaned) as T;
}

export type AiStatus = { state: 'mock' } | { state: 'ok'; model: string } | { state: 'error'; model: string; error: string };
let aiStatus: AiStatus = geminiEnabled() ? { state: 'error', model: config.GEMINI_MODEL, error: 'not checked yet' } : { state: 'mock' };
export const getAiStatus = () => aiStatus;

/** One tiny Gemini call at boot so a bad key or retired model shows up in the log, not on the first photo. */
export async function checkGemini(): Promise<AiStatus> {
  if (!geminiEnabled()) return (aiStatus = { state: 'mock' });
  try {
    const { model } = await generate({
      systemInstruction: 'Reply with the single word OK.',
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      maxOutputTokens: 16,
      temperature: 0,
      geminiOnly: true,
    });
    aiStatus = { state: 'ok', model };
  } catch (err) {
    const raw = String((err as Error)?.message ?? err);
    aiStatus = { state: 'error', model: config.GEMINI_MODEL, error: raw.slice(0, 300) };
  }
  return aiStatus;
}
