import { Router } from 'express';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { isDateKey } from '../lib/dates.js';
import { inviteCode } from '../lib/ids.js';
import { parse } from '../middleware/error.js';
import { dashboard, goalOf, loadDay, todayFor } from '../services/ledger.js';
import { joinedOn } from '../services/users.js';
import type { Store, User } from '../store/types.js';

/**
 * Trainer access. A client shares their invite code; a trainer redeems it and
 * gets read-only access to that client's ledger. The client can revoke all access anytime.
 */
export function trainerRoutes(store: Store) {
  const r = Router();

  const linkedClient = async (trainer: User, clientId: string) => {
    const client = await store.users.get(clientId);
    if (!client) throw notFound('Client');
    if (!client.trainerIds.includes(trainer.id)) throw forbidden('This client hasn’t shared their log with you');
    return client;
  };

  r.get('/trainer/invite-code', (req, res) => {
    res.json({ code: req.user.trainerInviteCode, trainerCount: req.user.trainerIds.length });
  });

  /** Client side: remove every trainer and issue a fresh code. */
  r.post('/trainer/revoke', async (req, res) => {
    const user = await store.users.update(req.user.id, { trainerIds: [], trainerInviteCode: inviteCode() });
    res.json({ code: user!.trainerInviteCode, trainerCount: 0 });
  });

  /** Trainer side: redeem a client's code. */
  r.post('/trainer/link', async (req, res) => {
    const { code } = parse(z.object({ code: z.string().trim().min(4).max(20) }), req.body);
    const client = await store.users.findOne({ trainerInviteCode: code.toUpperCase() });
    if (!client) throw notFound('Invite code');
    if (client.id === req.user.id) throw badRequest('That’s your own code. Your trainer enters it on their phone.');
    if (!client.trainerIds.includes(req.user.id)) {
      await store.users.update(client.id, { trainerIds: [...client.trainerIds, req.user.id] });
    }
    if (req.user.role !== 'trainer') await store.users.update(req.user.id, { role: 'trainer' });
    res.json({ client: { id: client.id, name: client.name } });
  });

  r.get('/trainer/clients', async (req, res) => {
    const clients = await store.users.find({ trainerIds: req.user.id });
    const rows = await Promise.all(
      clients.map(async (c) => {
        const { summary } = await loadDay(store, c, todayFor(c));
        return {
          id: c.id,
          name: c.name,
          goal: goalOf(c),
          lastActiveAt: c.lastActiveAt,
          today: { caloriesLeft: summary.caloriesLeft, pnl: summary.pnl, meals: summary.counts.meals },
        };
      }),
    );
    res.json({ clients: rows });
  });

  r.get('/trainer/clients/:clientId', async (req, res) => {
    const client = await linkedClient(req.user, req.params.clientId);
    const { date } = parse(z.object({ date: z.string().refine(isDateKey).optional() }), req.query);
    res.json({
      client: {
        id: client.id,
        name: client.name,
        goal: goalOf(client),
        profile: client.profile,
        targets: client.targets,
        joinedOn: joinedOn(client),
      },
      dashboard: await dashboard(store, client, date ?? todayFor(client)),
    });
  });

  r.delete('/trainer/clients/:clientId', async (req, res) => {
    const client = await linkedClient(req.user, req.params.clientId);
    await store.users.update(client.id, { trainerIds: client.trainerIds.filter((t) => t !== req.user.id) });
    res.json({ ok: true });
  });

  return r;
}
