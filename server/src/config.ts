import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load .env without a dependency (Node >= 20.12). Real env vars always win.
if (existsSync('.env') && process.env.NODE_ENV !== 'test') {
  process.loadEnvFile('.env');
}

const isProdEnv = process.env.NODE_ENV === 'production';
/** "true"/"1" → true, "false"/"0" → false, unset → fallback. */
const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v === 'true' || v === '1'));

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  PUBLIC_BASE_URL: z.string().default(''),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('90d'),

  MONGODB_URI: z.string().default(''),
  /** Database name inside the cluster (Atlas URIs usually don't include one; default would be "test"). */
  MONGODB_DATABASE: z.string().default('hisaab'),

  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  /** Backups, comma-separated, tried in order when the main model times out, is overloaded or out of quota. Empty = off. */
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-3.1-flash-lite,gemini-3.6-flash'),
  GEMINI_PRICE_INPUT_PER_M: z.coerce.number().default(0.3),
  GEMINI_PRICE_OUTPUT_PER_M: z.coerce.number().default(2.5),
  /** Optional second Gemini account: its own free quota. Photos use both keys (first one first). */
  GEMINI_API_KEY_2: z.string().default(''),

  /** Optional. Text-only AI (coach, typed meals, reminders, item edits) goes to Groq first; photos never do. */
  GROQ_API_KEY: z.string().default(''),
  /** Comma-separated, tried in order. Free tier limits are per model, so several = more room. */
  GROQ_MODELS: z.string().default('openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b'),
  /** Approximate paid prices for cost reports (the free tier costs $0). */
  GROQ_PRICE_INPUT_PER_M: z.coerce.number().default(0.15),
  GROQ_PRICE_OUTPUT_PER_M: z.coerce.number().default(0.6),

  FREE_SCANS_PER_DAY: z.coerce.number().default(3),
  FREE_CHATS_PER_DAY: z.coerce.number().default(5),
  PRO_SCANS_PER_DAY: z.coerce.number().default(60),
  PRO_CHATS_PER_DAY: z.coerce.number().default(150),

  NUDGES_ENABLED: bool(true),
  /** Free-plan quotas + the "Wrong?" cap. Off for the MVP demo; turn on before launch. */
  LIMITS_ENABLED: bool(false),
  ADMIN_KEY: z.string().default(''),
  /** Where meal photos are stored. Default ./uploads; on Azure use /home/data/uploads (survives redeploys). */
  UPLOAD_DIR: z.string().default(''),
  ALLOW_MOCK_UPGRADE: bool(!isProdEnv),
});

const parsed = schema.parse(process.env);

if (parsed.NODE_ENV === 'production' && parsed.JWT_SECRET === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = {
  ...parsed,
  isProd: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',
  aiMode: parsed.GEMINI_API_KEY ? ('gemini' as const) : ('mock' as const),
  dbMode: parsed.MONGODB_URI ? ('mongo' as const) : ('file' as const),
};

export type Config = typeof config;
