/**
 * Copy chosen accounts (and all their data) from the JSON file store into MongoDB.
 * Safe to re-run: documents that already exist (same id) are skipped.
 *   npx tsx scripts/migrate-to-mongo.ts <userIdPrefix> [more prefixes…]
 */
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PENDING || '';
const dbName = process.env.MONGODB_DATABASE || 'hisaab';
const prefixes = process.argv.slice(2);
if (!uri || !prefixes.length) throw new Error('usage: migrate-to-mongo.ts <userIdPrefix…> (needs MONGODB_URI in .env)');

const { createMongoStore } = await import('../src/store/mongo/mongoStore.js');
const file = JSON.parse(readFileSync('data/db.json', 'utf8')) as Record<string, any[]>;
const users = file.users.filter((u) => prefixes.some((p) => u.id.startsWith(p)));
if (!users.length) throw new Error('no matching users in data/db.json');
const ids = new Set(users.map((u) => u.id));

const store = await createMongoStore(uri, dbName);
const counts: Record<string, { copied: number; skipped: number }> = {};
try {
  for (const [collection, rows] of [
    ['users', users],
    ['meals', file.meals.filter((r) => ids.has(r.userId))],
    ['workouts', file.workouts.filter((r) => ids.has(r.userId))],
    ['water', file.water.filter((r) => ids.has(r.userId))],
    ['chat', file.chat.filter((r) => ids.has(r.userId))],
    ['usage', file.usage.filter((r) => ids.has(r.userId))],
  ] as const) {
    const repo = (store as any)[collection];
    counts[collection] = { copied: 0, skipped: 0 };
    for (const row of rows) {
      if (await repo.get(row.id)) counts[collection].skipped++;
      else {
        // Older meals predate these fields
        if (collection === 'meals') row.clarify ??= null, row.corrections ??= 0;
        await repo.create(row);
        counts[collection].copied++;
      }
    }
  }
} finally {
  await store.close();
}
console.log(`migrated ${users.map((u) => `${u.name} (${u.id.slice(0, 8)})`).join(', ')} → db "${dbName}"`);
console.table(counts);
