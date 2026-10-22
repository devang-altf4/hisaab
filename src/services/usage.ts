import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import type { AiUsage } from '../ai/gemini.js';
import type { Store, User } from '../store/types.js';
import { isProActive } from './users.js';

export type Feature = 'scans' | 'chats';

export interface Usage {
  isPro: boolean;
  /** false (MVP): nothing is capped and the app hides the "x free left" counters */
  limitsEnabled: boolean;
  scans: { used: number; limit: number };
  chats: { used: number; limit: number };
}

export function limitsFor(u: User) {
  return isProActive(u)
    ? { scans: config.PRO_SCANS_PER_DAY, chats: config.PRO_CHATS_PER_DAY }
    : { scans: config.FREE_SCANS_PER_DAY, chats: config.FREE_CHATS_PER_DAY };
}

export async function getUsage(store: Store, u: User, date: string): Promise<Usage> {
  const row = await store.usage.findOne({ userId: u.id, date });
  const limits = limitsFor(u);
  return {
    isPro: isProActive(u),
    limitsEnabled: config.LIMITS_ENABLED,
    scans: { used: row?.scans ?? 0, limit: limits.scans },
    chats: { used: row?.chats ?? 0, limit: limits.chats },
  };
}

/** Throws 402 PAYWALL_LIMIT when the user has used up today's quota for a feature. */
export async function assertQuota(store: Store, u: User, date: string, feature: Feature) {
  if (!config.LIMITS_ENABLED) return;
  const usage = await getUsage(store, u, date);
  const { used, limit } = usage[feature];
  if (used >= limit) {
    const what = feature === 'scans' ? 'meal scans' : 'coach chats';
    throw new ApiError(
      402,
      'PAYWALL_LIMIT',
      usage.isPro
        ? `You’ve reached today’s limit of ${limit} ${what}. It resets tomorrow.`
        : `The free plan includes ${limit} ${what} a day. Upgrade to Pro for more.`,
      { feature, used, limit, isPro: usage.isPro },
    );
  }
}

/** Count a feature use and bill its AI tokens to the user's day. */
export async function recordUse(store: Store, userId: string, date: string, feature: Feature | null, ai: AiUsage) {
  await store.incUsage(userId, date, {
    ...(feature ? { [feature]: 1 } : {}),
    aiCalls: ai.inputTokens + ai.outputTokens > 0 ? 1 : 0,
    inputTokens: ai.inputTokens,
    outputTokens: ai.outputTokens,
    costUsd: ai.costUsd,
  });
}
