import { Router } from 'express';
import { z } from 'zod';
import { generateSchedule, pickFromBank, SLOTS, type ScheduledNotification } from '../ai/notifications.js';
import { badRequest } from '../lib/errors.js';
import { parse } from '../middleware/error.js';
import { loadDay, todayFor } from '../services/ledger.js';
import { isExpoPushToken, sendPush } from '../services/push.js';
import { recordUse } from '../services/usage.js';
import type { Store } from '../store/types.js';

const TokenBody = z.object({ expoPushToken: z.string().min(10).max(200) });

/** One AI generation per user per day per count — the app re-fetches on every open. */
const scheduleCache = new Map<string, ScheduledNotification[]>();

export function notificationRoutes(store: Store) {
  const r = Router();

  r.post('/notifications/register', async (req, res) => {
    const { expoPushToken } = parse(TokenBody, req.body);
    if (!isExpoPushToken(expoPushToken)) throw badRequest('Not an Expo push token (ExponentPushToken[...])');
    const pushTokens = [...new Set([...req.user.pushTokens, expoPushToken])].slice(-5);
    await store.users.update(req.user.id, { pushTokens, pushEnabled: true });
    res.json({ ok: true });
  });

  r.delete('/notifications/register', async (req, res) => {
    const { expoPushToken } = parse(TokenBody, req.body);
    const pushTokens = req.user.pushTokens.filter((t) => t !== expoPushToken);
    await store.users.update(req.user.id, { pushTokens, pushEnabled: pushTokens.length > 0 });
    res.json({ ok: true });
  });

  /** Today's personalized schedule for local scheduling on the device. */
  r.get('/notifications/schedule', async (req, res) => {
    const user = req.user;
    const { count } = parse(z.object({ count: z.coerce.number().int().min(0).max(10).optional() }), req.query);
    const n = count ?? user.notificationsPerDay;
    if (n === 0) {
      res.json({ notifications: [] });
      return;
    }
    const date = todayFor(user);
    const key = `${user.id}:${date}:${n}`;
    let notifications = scheduleCache.get(key);
    if (!notifications) {
      const { summary, meals } = await loadDay(store, user, date);
      const logged = new Set(meals.map((m) => m.mealType));
      const notLogged = (['breakfast', 'lunch', 'dinner'] as const).filter((t) => !logged.has(t));
      const out = await generateSchedule({ userId: user.id, name: user.name, date, count: n, today: summary, notLogged });
      await recordUse(store, user.id, date, null, out.usage);
      notifications = out.notifications;
      if (scheduleCache.size > 20_000) scheduleCache.clear();
      scheduleCache.set(key, notifications);
    }
    res.json({ notifications });
  });

  /** "Test Zomato-style notification" button. Pushes to the device if a token is registered. */
  r.post('/notifications/test', async (req, res) => {
    const user = req.user;
    const { summary } = await loadDay(store, user, todayFor(user));
    const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
    const notification = pickFromBank(slot.id, String(Math.random()), { name: user.name, left: summary.caloriesLeft });
    const result = await sendPush(user.pushTokens, { ...notification, data: { screen: 'capture', slot: slot.id } });
    if (result.invalidTokens.length) {
      const pushTokens = user.pushTokens.filter((t) => !result.invalidTokens.includes(t));
      await store.users.update(user.id, { pushTokens, pushEnabled: pushTokens.length > 0 });
    }
    res.json({ notification, pushed: result.sent > 0 });
  });

  return r;
}
