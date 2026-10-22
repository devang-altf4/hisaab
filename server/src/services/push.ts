/**
 * Expo push service — free, no key needed for basic use.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export const isExpoPushToken = (t: string) => /^Expo(nent)?PushToken\[.+\]$/.test(t);

export interface PushResult {
  sent: number;
  /** Tokens Expo reported as no longer registered — caller should remove them. */
  invalidTokens: string[];
}

export async function sendPush(
  tokens: string[],
  msg: { title: string; body: string; data?: Record<string, unknown> },
): Promise<PushResult> {
  const valid = tokens.filter(isExpoPushToken);
  if (!valid.length) return { sent: 0, invalidTokens: [] };
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(valid.map((to) => ({ to, sound: 'default', ...msg }))),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
    const tickets = json.data ?? [];
    const invalidTokens = valid.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
    return { sent: tickets.filter((t) => t.status === 'ok').length, invalidTokens };
  } catch (err) {
    console.warn('[push] send failed:', (err as Error).message);
    return { sent: 0, invalidTokens: [] };
  }
}
