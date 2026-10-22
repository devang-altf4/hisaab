/**
 * Photo-upload check — exercises the exact request the phone sends after a snap:
 * JPEG → base64 → api.meals.analyze({ imageBase64 }) → 202 "analyzing" → poll → done.
 *
 *   npx tsx scripts/upload-check.ts <path-to.jpg> [apiUrl]
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HisaabApiClient } from '../../sdk/hisaabApi.js';

const [file, baseUrl = 'http://localhost:4000'] = process.argv.slice(2);
if (!file) throw new Error('usage: upload-check.ts <jpg> [apiUrl]');

let token: string | null = null;
const api = new HisaabApiClient({ baseUrl, getToken: () => token });

const jpeg = readFileSync(file);
const base64 = jpeg.toString('base64');
console.log(`image: ${file} (${Math.round(jpeg.length / 1024)} KB, base64 ${Math.round(base64.length / 1024)} KB)`);

token = (await api.auth.guest({ deviceId: `upload-check-${randomUUID()}`, name: 'Upload Check' })).token;
await api.me.updateProfile({ sex: 'male', age: 26, heightCm: 172, weightKg: 72, activityLevel: 'light', goal: 'lose' });

const t0 = Date.now();
const { meal } = await api.meals.analyze({ imageBase64: base64, mimeType: 'image/jpeg' });
console.log(`POST /meals/analyze → status=${meal.status} in ${Date.now() - t0} ms, imageUrl=${meal.imageUrl}`);
if (meal.status !== 'analyzing' || !meal.imageUrl) throw new Error('expected an analyzing meal with an image');

let done = meal;
for (let i = 0; i < 40 && done.status === 'analyzing'; i++) {
  await new Promise((r) => setTimeout(r, 500));
  done = (await api.meals.get(meal.id)).meal;
}
if (done.status !== 'done') throw new Error(`analysis ended as ${done.status}: ${done.error}`);
console.log(`analysis → ${done.dishName}, ${done.calories} kcal, "${done.verdict}" (${done.hisaab?.label})`);

const img = await fetch(api.resolveImageUrl(done.imageUrl)!);
const served = Buffer.from(await img.arrayBuffer());
if (!img.ok || !served.equals(jpeg)) throw new Error('stored image does not match the upload');
console.log(`GET ${done.imageUrl} → ${img.status}, ${served.length} bytes, byte-identical to upload`);

const dash = await api.dashboard.get();
if (!dash.meals.some((m) => m.id === meal.id)) throw new Error('meal missing from dashboard');
console.log(`dashboard → ${dash.meals.length} meal(s), balance ${dash.summary.caloriesLeft} kcal, ${dash.summary.pnl.label}`);

await api.meals.delete(meal.id);
console.log('cleanup → test meal deleted\nPHOTO UPLOAD OK');
