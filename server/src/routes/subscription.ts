import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { addDays, dateKey } from '../lib/dates.js';
import { forbidden } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { parse } from '../middleware/error.js';
import { todayFor } from '../services/ledger.js';
import { getUsage } from '../services/usage.js';
import { publicUser } from '../services/users.js';
import type { Store } from '../store/types.js';

/** Placeholder pricing — tune after the unit-economics numbers from /admin/economics come in. */
export const PLANS = [
  { id: 'pro_monthly', name: 'Pro Monthly', priceInr: 149, period: 'month', days: 30, badge: null },
  { id: 'pro_yearly', name: 'Pro Yearly', priceInr: 999, period: 'year', days: 365, badge: 'Save 44%' },
] as const;

export const PRO_FEATURES = [
  `${config.PRO_SCANS_PER_DAY} AI meal scans a day (free: ${config.FREE_SCANS_PER_DAY})`,
  `${config.PRO_CHATS_PER_DAY} coach chats a day (free: ${config.FREE_CHATS_PER_DAY})`,
  'Trainer sharing & weekly P&L reports',
  'Smart meal reminders',
];

export function subscriptionRoutes(store: Store) {
  const r = Router();

  r.get('/subscription', async (req, res) => {
    const u = publicUser(req.user);
    res.json({
      isPro: u.isPro,
      proUntil: req.user.proUntil,
      plans: PLANS,
      features: PRO_FEATURES,
      usage: await getUsage(store, req.user, todayFor(req.user)),
      mockUpgradeEnabled: config.ALLOW_MOCK_UPGRADE,
    });
  });

  /**
   * Test-mode upgrade (no payment). Replace with a RevenueCat / Razorpay / Play Billing
   * webhook that sets isPro + proUntil after a verified purchase.
   */
  r.post('/subscription/mock-upgrade', async (req, res) => {
    if (!config.ALLOW_MOCK_UPGRADE) throw forbidden('Mock upgrades are disabled');
    const { planId } = parse(z.object({ planId: z.enum(['pro_monthly', 'pro_yearly']).default('pro_monthly') }), req.body ?? {});
    const plan = PLANS.find((p) => p.id === planId)!;
    const proUntil = new Date(Date.now() + plan.days * 86_400_000).toISOString();
    const user = await store.users.update(req.user.id, { isPro: true, proUntil });
    res.json({ user: publicUser(user!) });
  });

  r.post('/subscription/cancel', async (req, res) => {
    const user = await store.users.update(req.user.id, { isPro: false, proUntil: null });
    res.json({ user: publicUser(user!) });
  });

  return r;
}

/**
 * Unit economics — answers "what does one user actually cost us?".
 * GET /api/admin/economics?days=30   (header x-admin-key)
 */
export function adminRoutes(store: Store) {
  const r = Router();
  r.use('/admin', requireAdmin);

  r.get('/admin/economics', async (req, res) => {
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), req.query);
    const to = dateKey();
    const from = addDays(to, -(days - 1));
    const [rows, totalUsers, proUsers] = await Promise.all([
      store.usage.find({ date: { $gte: from, $lte: to } }),
      store.users.count({}),
      store.users.count({ isPro: true }),
    ]);

    const sum = (k: 'scans' | 'chats' | 'aiCalls' | 'inputTokens' | 'outputTokens' | 'costUsd') =>
      rows.reduce((s, r) => s + (r[k] || 0), 0);
    const activeUsers = new Set(rows.map((r) => r.userId)).size;
    const userDays = rows.length;
    const cost = sum('costUsd');
    const scans = sum('scans');
    const chats = sum('chats');
    const per = (a: number, b: number) => (b ? Math.round((a / b) * 1e6) / 1e6 : 0);

    res.json({
      range: { from, to, days },
      model: config.GEMINI_MODEL,
      aiMode: config.aiMode,
      pricing: { inputPerM: config.GEMINI_PRICE_INPUT_PER_M, outputPerM: config.GEMINI_PRICE_OUTPUT_PER_M },
      users: { total: totalUsers, pro: proUsers, activeInRange: activeUsers },
      totals: {
        scans,
        chats,
        aiCalls: sum('aiCalls'),
        inputTokens: sum('inputTokens'),
        outputTokens: sum('outputTokens'),
        costUsd: Math.round(cost * 1e4) / 1e4,
      },
      unit: {
        costPerActiveUserUsd: per(cost, activeUsers),
        costPerUserDayUsd: per(cost, userDays),
        projectedMonthlyCostPerDailyUserUsd: per(cost * 30, userDays),
        avgScansPerUserDay: per(scans, userDays),
        avgChatsPerUserDay: per(chats, userDays),
      },
    });
  });

  return r;
}
