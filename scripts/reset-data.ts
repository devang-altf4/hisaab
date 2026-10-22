/**
 * Start from zero: delete every Hisaab account and all logged data (Hisaab's own collections only;
 * other apps' collections in the same database are never touched) and every uploaded photo.
 * Dry run by default.
 *   npx tsx scripts/reset-data.ts            (shows what would be deleted)
 *   npx tsx scripts/reset-data.ts --yes      (deletes)
 *   add --smoke to remove only the test accounts the smoke/check scripts create (deviceId "smoke-…", "p1-check-…", etc.)
 * Phones re-login automatically and land on onboarding as a new user.
 */
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';

if (existsSync('.env')) process.loadEnvFile('.env');
const uri = process.env.MONGODB_URI ?? '';
const dbName = process.env.MONGODB_DATABASE || 'hisaab';
if (!uri) throw new Error('MONGODB_URI is not set in .env');
const really = process.argv.includes('--yes');
const smokeOnly = process.argv.includes('--smoke');

await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db!;
// Only Hisaab's own collections. The database may be shared with other apps (e.g. "demo_requests");
// never touch anything else.
const HISAAB = ['users', 'meallogs', 'workoutlogs', 'waterlogs', 'chathistories', 'usagedays'];
const existing = (await db.listCollections().toArray()).map((c) => c.name);
const collections = HISAAB.filter((c) => existing.includes(c));
const others = existing.filter((c) => !HISAAB.includes(c)).sort();
const counts: Record<string, number> = {};
for (const c of collections) counts[c] = await db.collection(c).countDocuments();

const userFilter = smokeOnly ? { deviceId: { $regex: '^(smoke|p1-check|items-check|upload-check)-' } } : { deviceId: { $exists: true } };
const users = await db.collection('users').find(userFilter, { projection: { name: 1, deviceId: 1 } }).toArray();
const userIds = users.map((u: any) => String(u._id));
// Everything except "users" is keyed by userId
const dataFilter = (c: string) => (c === 'users' ? userFilter : smokeOnly ? { userId: { $in: userIds } } : {});
if (smokeOnly) {
  for (const c of collections) counts[c] = await db.collection(c).countDocuments(dataFilter(c));
}
console.log(`database "${dbName}", ${smokeOnly ? 'smoke-test data' : 'Hisaab collections'}: ${JSON.stringify(counts)}`);
if (others.length) console.log(`left untouched (not Hisaab's): ${others.join(', ')}`);
console.log(`accounts: ${users.map((u: any) => `${u.name} (${String(u.deviceId).slice(0, 14)}…)`).join(', ') || 'none'}`);

const uploadDir = join(process.cwd(), 'uploads');
const allPhotos = existsSync(uploadDir) ? readdirSync(uploadDir).filter((f) => f !== '.gitkeep') : [];
// With --smoke, keep only photos that real users' meals point to (test photos and orphans go).
const keepPhotos = smokeOnly
  ? new Set(
      (await db.collection('meallogs').find({ userId: { $nin: userIds } }, { projection: { imageUrl: 1 } }).toArray())
        .map((m: any) => String(m.imageUrl ?? '').replace('/uploads/', ''))
        .filter(Boolean),
    )
  : null;
const photos = keepPhotos ? allPhotos.filter((f) => !keepPhotos.has(f)) : allPhotos;
console.log(`uploaded photos: ${photos.length}`);

if (!really) {
  console.log('\nDry run. Re-run with --yes to delete all of the above.');
} else {
  for (const c of collections) {
    // "users" is a generic name: only delete Hisaab accounts (they always have a deviceId).
    await db.collection(c).deleteMany(dataFilter(c));
  }
  for (const f of photos) unlinkSync(join(uploadDir, f));
  const after: Record<string, number> = {};
  for (const c of collections) after[c] = await db.collection(c).countDocuments();
  console.log(`\nDeleted. Now: ${JSON.stringify(after)}, photos left: ${readdirSync(uploadDir).filter((f) => f !== '.gitkeep').length}`);
}
await mongoose.disconnect();
