import { Router } from 'express';
import { z } from 'zod';
import { estimateBurn } from '../domain/nutrition.js';
import { addDays, dateKey, isDateKey } from '../lib/dates.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { parse } from '../middleware/error.js';
import { dashboard, ledger, loadDay, todayFor } from '../services/ledger.js';
import { joinedOn, publicUser } from '../services/users.js';
import type { Store, User, Workout } from '../store/types.js';

const dateField = z.string().refine(isDateKey, 'Expected YYYY-MM-DD').optional();
const DateQuery = z.object({ date: dateField });

const WaterBody = z.object({ ml: z.number().int().min(1).max(2000), date: dateField });

const WorkoutBody = z.object({
  type: z.string().trim().min(1).max(40),
  durationMin: z.number().min(1).max(600),
  caloriesBurned: z.number().min(0).max(5000).optional(),
  date: dateField,
  notes: z.string().max(200).optional(),
});

const HealthSettings = z.object({ appleHealth: z.boolean().optional(), healthConnect: z.boolean().optional() });

const HealthSync = z.object({
  source: z.enum(['apple_health', 'health_connect']),
  workouts: z
    .array(
      z.object({
        externalId: z.string().min(1).max(200),
        type: z.string().min(1).max(40),
        durationMin: z.number().min(0).max(1440),
        caloriesBurned: z.number().min(0).max(5000),
        startedAt: z.iso.datetime({ offset: true }),
      }),
    )
    .max(200),
});

const dateOr = (user: User, d?: string) => d ?? todayFor(user);

export function trackingRoutes(store: Store) {
  const r = Router();

  r.get('/dashboard', async (req, res) => {
    const { date } = parse(DateQuery, req.query);
    res.json(await dashboard(store, req.user, dateOr(req.user, date)));
  });

  /** P&L ledger for a date range (default: last 7 days incl. today). Max 92 days. */
  r.get('/ledger', async (req, res) => {
    const q = parse(z.object({ from: dateField, to: dateField }), req.query);
    const to = q.to ?? todayFor(req.user);
    const from = q.from ?? addDays(to, -6);
    if (from > to) throw badRequest('`from` must be on or before `to`');
    if (from < addDays(to, -91)) throw badRequest('Range too long (max 92 days)');
    // Nothing before the account existed: those days would show a fake full-budget "profit".
    const first = joinedOn(req.user);
    res.json(await ledger(store, req.user, from < first ? first : from, to));
  });

  // ─── Water ──────────────────────────────────────────────
  const waterSummary = async (user: User, date: string) => (await loadDay(store, user, date)).summary.water;

  r.post('/water', async (req, res) => {
    const b = parse(WaterBody, req.body);
    const date = dateOr(req.user, b.date);
    await store.water.create({ id: newId(), userId: req.user.id, date, ml: b.ml, loggedAt: new Date().toISOString() });
    res.status(201).json({ water: await waterSummary(req.user, date) });
  });

  r.delete('/water/last', async (req, res) => {
    const { date: d } = parse(DateQuery, req.query);
    const date = dateOr(req.user, d);
    const [last] = await store.water.find({ userId: req.user.id, date }, { sort: { loggedAt: -1 }, limit: 1 });
    if (last) await store.water.delete(last.id);
    res.json({ water: await waterSummary(req.user, date) });
  });

  // ─── Workouts (bonus credit) ────────────────────────────
  const strip = ({ userId: _u, ...w }: Workout) => w;

  r.get('/workouts', async (req, res) => {
    const { date } = parse(DateQuery, req.query);
    const rows = await store.workouts.find({ userId: req.user.id, date: dateOr(req.user, date) }, { sort: { loggedAt: -1 } });
    res.json({ workouts: rows.map(strip) });
  });

  r.post('/workouts', async (req, res) => {
    const b = parse(WorkoutBody, req.body);
    const workout = await store.workouts.create({
      id: newId(),
      userId: req.user.id,
      date: dateOr(req.user, b.date),
      loggedAt: new Date().toISOString(),
      type: b.type,
      durationMin: b.durationMin,
      caloriesBurned: Math.round(b.caloriesBurned ?? estimateBurn(b.type, b.durationMin, req.user.profile?.weightKg)),
      source: 'manual',
      externalId: null,
      notes: b.notes ?? null,
    });
    res.status(201).json({ workout: strip(workout) });
  });

  r.delete('/workouts/:id', async (req, res) => {
    const w = await store.workouts.get(req.params.id);
    if (!w) throw notFound('Workout');
    if (w.userId !== req.user.id) throw forbidden();
    await store.workouts.delete(w.id);
    res.json({ ok: true });
  });

  // ─── Health sync (Apple Health / Health Connect) ────────
  r.put('/health/settings', async (req, res) => {
    const b = parse(HealthSettings, req.body);
    const user = await store.users.update(req.user.id, { healthSync: { ...req.user.healthSync, ...b } });
    res.json({ user: publicUser(user!) });
  });

  /**
   * The phone reads HealthKit / Health Connect (needs a dev build) and pushes workouts here.
   * Idempotent: `externalId` dedups, so the app can resend the last 48 h on every open.
   */
  r.post('/health/sync', async (req, res) => {
    const b = parse(HealthSync, req.body);
    let imported = 0;
    let skipped = 0;
    for (const w of b.workouts) {
      const exists = await store.workouts.findOne({ userId: req.user.id, externalId: `${b.source}:${w.externalId}` });
      if (exists || w.durationMin === 0) {
        skipped++;
        continue;
      }
      await store.workouts.create({
        id: newId(),
        userId: req.user.id,
        date: dateKey(new Date(w.startedAt), req.user.timezone),
        loggedAt: new Date().toISOString(),
        type: w.type,
        durationMin: Math.round(w.durationMin),
        caloriesBurned: Math.round(w.caloriesBurned),
        source: b.source,
        externalId: `${b.source}:${w.externalId}`,
        notes: null,
      });
      imported++;
    }
    res.json({ imported, skipped });
  });

  return r;
}
