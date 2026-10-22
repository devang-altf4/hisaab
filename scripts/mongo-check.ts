/**
 * Checks every store operation the app uses against a real MongoDB, in a throwaway database
 * that is dropped afterwards. Reads MONGODB_URI (or MONGODB_URI_PENDING) from .env.
 *   npx tsx scripts/mongo-check.ts
 */
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';

if (existsSync('.env')) process.loadEnvFile('.env');
const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PENDING || '';
if (!uri) throw new Error('No MONGODB_URI in .env');

const { createMongoStore } = await import('../src/store/mongo/mongoStore.js');
const { newUser } = await import('../src/services/users.js');
const { blankMeal } = await import('../src/services/meals.js');

const DB = 'moki_check';
let ok = 0;
const check = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  ok++;
  console.log(`  ✓ ${msg}`);
};

const t0 = Date.now();
const store = await createMongoStore(uri, DB);
console.log(`connected to cluster, db "${DB}" in ${Date.now() - t0} ms`);
try {
  const u = await store.users.create(newUser('mongo-check-device-1', 'Mongo Check'));
  check((await store.users.get(u.id))?.name === 'Mongo Check', 'create + get user');
  check((await store.users.findOne({ deviceId: 'mongo-check-device-1' }))?.id === u.id, 'findOne by deviceId');
  const upd = await store.users.update(u.id, { name: 'Renamed', trainerIds: ['t1'] });
  check(upd?.name === 'Renamed', 'update returns the new document');
  check((await store.users.find({ trainerIds: 't1' })).length === 1, 'array-contains filter (trainer → clients)');

  const date = '2026-10-21';
  const m1 = await store.meals.create({ ...blankMeal(u, { date, mealType: 'lunch', source: 'photo' }), status: 'done', calories: 500,
    ingredients: [{ name: 'Tikka', quantity: '3 skewers', calories: 400, pieces: 3, pieceUnit: 'skewer', proteinG: 60, carbsG: 0, fatG: 15, fiberG: 0, grams: 250 }],
    clarify: { ingredientIndex: 0, question: 'How many skewers?', unit: 'skewer', current: 3, options: [2, 3, 4, 5] } });
  await store.meals.create({ ...blankMeal(u, { date: '2026-10-19', mealType: 'dinner', source: 'text' }), status: 'done', calories: 300 });
  const got = await store.meals.get(m1.id);
  check(got?.clarify?.question === 'How many skewers?' && got.ingredients[0].pieces === 3, 'meal keeps clarify + ingredient pieces');
  check((await store.meals.find({ userId: u.id, date: { $gte: '2026-10-15', $lte: '2026-10-21' } })).length === 2, 'date range query (ledger)');
  check((await store.meals.find({ userId: u.id }, { sort: { loggedAt: -1 }, limit: 1 })).length === 1, 'sort + limit');
  check((await store.meals.count({ status: 'done', userId: u.id })) === 2, 'count');
  check((await store.meals.update(m1.id, { clarify: null }))?.clarify === null, 'clear clarify');

  await store.incUsage(u.id, date, { scans: 1, inputTokens: 100, costUsd: 0.001 });
  const usage = await store.incUsage(u.id, date, { scans: 1, outputTokens: 50 });
  check(usage.scans === 2 && usage.inputTokens === 100 && usage.outputTokens === 50, 'atomic usage upsert-increment');

  check(await store.meals.delete(m1.id), 'delete');
  check((await store.meals.get(m1.id)) === null, 'deleted meal is gone');
} finally {
  await mongoose.connection.db?.dropDatabase();
  await store.close();
}
console.log(`\nMongo check passed: ${ok} checks, throwaway db "${DB}" dropped.`);
