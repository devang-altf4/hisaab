import { pickFromBank } from '../ai/notifications.js';
import { dateKey, localTime } from '../lib/dates.js';
import type { MealType, Store } from '../store/types.js';
import { loadDay } from './ledger.js';
import { sendPush } from './push.js';

/**
 * Server-side "smart nudges": unlike the device's fixed schedule, these fire only
 * when a meal really hasn't been logged ("Hiding lunch?").
 * Runs in-process every 10 minutes. For multiple instances move this to a single cron worker.
 */
const RULES: Array<{ slot: string; mealType: MealType; from: number; to: number }> = [
  { slot: 'lunch_followup', mealType: 'lunch', from: 15 * 60, to: 16 * 60 + 30 },
  { slot: 'dinner', mealType: 'dinner', from: 21 * 60 + 30, to: 22 * 60 + 30 },
];

export async function runNudges(store: Store, now = new Date()): Promise<number> {
  const users = await store.users.find({ pushEnabled: true });
  let sent = 0;
  for (const user of users) {
    if (user.notificationsPerDay === 0) continue;
    const { hour, minute } = localTime(now, user.timezone);
    const mins = hour * 60 + minute;
    const today = dateKey(now, user.timezone);
    for (const rule of RULES) {
      if (mins < rule.from || mins > rule.to || user.nudgesSent[rule.slot] === today) continue;
      const { meals, summary } = await loadDay(store, user, today);
      if (meals.some((m) => m.mealType === rule.mealType)) continue;

      const copy = pickFromBank(rule.slot, user.id + today, { name: user.name, left: summary.caloriesLeft });
      const res = await sendPush(user.pushTokens, { ...copy, data: { screen: 'capture', slot: rule.slot } });
      const pushTokens = user.pushTokens.filter((t) => !res.invalidTokens.includes(t));
      user.nudgesSent = { ...user.nudgesSent, [rule.slot]: today };
      await store.users.update(user.id, { nudgesSent: user.nudgesSent, pushTokens, pushEnabled: pushTokens.length > 0 });
      sent += res.sent;
    }
  }
  return sent;
}

export function startNudgeJob(store: Store, everyMs = 10 * 60_000) {
  const tick = () =>
    runNudges(store)
      .then((n) => n && console.log(`[nudges] sent ${n}`))
      .catch((err) => console.warn('[nudges] failed:', (err as Error).message));
  const timer = setInterval(tick, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
