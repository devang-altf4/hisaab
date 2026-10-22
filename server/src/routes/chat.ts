import { Router } from 'express';
import { z } from 'zod';
import { askCoach } from '../ai/coach.js';
import { addDays } from '../lib/dates.js';
import { ApiError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { parse } from '../middleware/error.js';
import { ledger, loadDay, todayFor } from '../services/ledger.js';
import { assertQuota, getUsage, recordUse } from '../services/usage.js';
import type { ChatMessage, Store } from '../store/types.js';

const ChatBody = z.object({ message: z.string().trim().min(1).max(1000) });

const view = ({ userId: _u, ...m }: ChatMessage) => m;

export function chatRoutes(store: Store) {
  const r = Router();

  // '/chat/bada-bhai' is the old path, kept so older app builds keep working.
  r.post(['/chat/coach', '/chat/bada-bhai'], async (req, res) => {
    const { message } = parse(ChatBody, req.body);
    const user = req.user;
    const today = todayFor(user);
    await assertQuota(store, user, today, 'chats');

    const [{ summary, meals }, week, recent] = await Promise.all([
      loadDay(store, user, today),
      ledger(store, user, addDays(today, -6), today),
      store.chat.find({ userId: user.id }, { sort: { createdAt: -1 }, limit: 12 }),
    ]);

    let reply;
    try {
      reply = await askCoach({ user, today: summary, meals, weekPnl: week.totals.pnl.amount }, recent.reverse(), message);
    } catch (err) {
      console.error('[chat] AI failed:', (err as Error).message);
      throw new ApiError(502, 'AI_UNAVAILABLE', 'Coach is unavailable right now. Try again in a minute.');
    }

    // Saved only after a successful reply so history never has dangling questions.
    const now = Date.now();
    await store.chat.create({ id: newId(), userId: user.id, role: 'user', text: message, createdAt: new Date(now).toISOString() });
    const saved = await store.chat.create({
      id: newId(),
      userId: user.id,
      role: 'model',
      text: reply.text,
      createdAt: new Date(now + 1).toISOString(),
    });
    await recordUse(store, user.id, today, 'chats', reply.usage);

    res.json({ reply: view(saved), usage: await getUsage(store, user, today) });
  });

  r.get('/chat/history', async (req, res) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    const rows = await store.chat.find({ userId: req.user.id }, { sort: { createdAt: -1 }, limit });
    res.json({ messages: rows.reverse().map(view) });
  });

  r.delete('/chat/history', async (req, res) => {
    const rows = await store.chat.find({ userId: req.user.id });
    await Promise.all(rows.map((m) => store.chat.delete(m.id)));
    res.json({ ok: true });
  });

  return r;
}
