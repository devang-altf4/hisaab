/**
 * Item-editor check against a RUNNING server with real AI.
 *   npx tsx scripts/items-check.ts <photo.jpg> [apiUrl]
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HisaabApiClient, type Meal } from '../../sdk/hisaabApi.js';

const [photo, baseUrl = 'http://localhost:4000'] = process.argv.slice(2);
let token: string | null = null;
const api = new HisaabApiClient({ baseUrl, getToken: () => token });
const show = (label: string, m: Meal) => {
  const sum = m.ingredients.reduce((t, i) => t + i.calories, 0);
  console.log(`${label}: ${m.calories} kcal (items add up to ${sum}${sum === m.calories ? ' ✓' : ' ✗ MISMATCH'}), P${m.proteinG} C${m.carbsG} F${m.fatG}`);
  m.ingredients.forEach((i, idx) => console.log(`    [${idx}] ${i.name}: ${i.quantity}${i.grams ? `, ${i.grams} g` : ''} → ${i.calories} kcal`));
  if (sum !== m.calories) process.exitCode = 1;
};

token = (await api.auth.guest({ deviceId: `items-check-${randomUUID()}`, name: 'Items Check' })).token;
await api.me.updateProfile({ sex: 'male', age: 26, heightCm: 172, weightKg: 72, activityLevel: 'light', goal: 'lose' });
let { meal } = await api.meals.analyze({ imageBase64: readFileSync(photo).toString('base64'), mimeType: 'image/jpeg' });
while (meal.status === 'analyzing') {
  await new Promise((r) => setTimeout(r, 400));
  meal = (await api.meals.get(meal.id)).meal;
}
show('\n1) AI result', meal);

const main = meal.ingredients.reduce((best, i, idx) => (i.calories > meal.ingredients[best].calories ? idx : best), 0);
const oil = meal.ingredients.findIndex((i) => /oil|butter|ghee/i.test(i.name));
const g = meal.ingredients[main].grams ?? 200;
const items = meal.ingredients
  .map((i, idx) => ({ ref: idx, name: i.name, ...(idx === main ? { grams: Math.round(g * 1.5) } : {}) }))
  .filter((r) => r.ref !== oil)
  .concat([{ name: 'Raita', grams: 150 } as any]);

let t = Date.now();
meal = (await api.meals.editItems(meal.id, { items })).meal;
console.log(`\n2) edited in ${Date.now() - t} ms: main item ${g} → ${Math.round(g * 1.5)} g, removed oil (${oil >= 0 ? 'yes' : 'none found'}), added "Raita 150 g"`);
show('   result', meal);

t = Date.now();
meal = (await api.meals.editItems(meal.id, { items: meal.ingredients.map((i, idx) => ({ ref: idx, name: i.name, ...(idx === 0 ? { grams: (i.grams ?? 100) / 1.5 } : {}) })) })).meal;
console.log(`\n3) only grams changed (no AI) in ${Date.now() - t} ms`);
show('   result', meal);

await api.meals.delete(meal.id);
console.log('\ncleanup → test meal deleted');
