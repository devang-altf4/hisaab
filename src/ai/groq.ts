import type { Content } from '@google/genai';

/**
 * Groq (OpenAI-compatible chat API) for text-only requests: fast and with its own free quota.
 * Takes the same Gemini-shaped request as `generate()`, so callers don't know which provider answered.
 */

const URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Carries what the router needs to decide: HTTP status and Groq's own retry-after. */
export class GroqError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterMs: number | null,
  ) {
    super(`groq ${status}: ${message}`);
  }
}

/** Strict JSON schema mode needs every object closed and no numeric range keywords. */
function strictSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(strictSchema);
  if (!s || typeof s !== 'object') return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (k !== 'minimum' && k !== 'maximum') out[k] = strictSchema(v);
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

const textOf = (c: Content) => (c.parts ?? []).map((p) => p.text ?? '').join('\n');

export async function callGroq(
  model: string,
  apiKey: string,
  req: {
    contents: Content[];
    systemInstruction: string;
    schema?: unknown;
    temperature: number;
    maxOutputTokens: number;
    timeoutMs: number;
  },
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const reasoning = model.startsWith('openai/gpt-oss');
  const body = (format: 'schema' | 'object') => ({
    model,
    temperature: req.temperature,
    // Reasoning models spend part of the budget thinking; leave room for the answer itself.
    max_completion_tokens: req.maxOutputTokens + 1024,
    messages: [
      { role: 'system', content: req.systemInstruction },
      ...req.contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: textOf(c) })),
    ],
    ...(reasoning ? { reasoning_effort: 'low' } : { reasoning_format: 'hidden' }),
    ...(req.schema
      ? {
          response_format:
            format === 'schema'
              ? { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: strictSchema(req.schema) } }
              : { type: 'json_object' },
        }
      : {}),
  });

  const post = async (format: 'schema' | 'object') => {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body(format)),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const after = Number(res.headers.get('retry-after'));
      throw new GroqError(res.status, String(json?.error?.message ?? res.statusText).slice(0, 300), after > 0 ? after * 1000 : null);
    }
    return json;
  };

  let json: any;
  try {
    json = await post('schema');
  } catch (err) {
    // A model without strict-schema support: plain JSON mode (the prompt already describes the shape).
    if (req.schema && err instanceof GroqError && err.status === 400) json = await post('object');
    else throw err;
  }
  const text = String(json?.choices?.[0]?.message?.content ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
  if (!text) throw new GroqError(502, 'empty reply', null);
  return { text, inputTokens: json?.usage?.prompt_tokens ?? 0, outputTokens: json?.usage?.completion_tokens ?? 0 };
}
