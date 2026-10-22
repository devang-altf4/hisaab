/**
 * P1 check against a RUNNING server with real AI: photo → question? → answer → "Wrong?" fix.
 *   npx tsx scripts/p1-check.ts <photo.jpg> "<correct name>" "<correct quantity>" [apiUrl]
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HisaabApiClient, type Meal } from '../../sdk/hisaabApi.js';

const [photo, name, quantity, baseUrl = 'http://localhost:4000'] = process.argv.slice(2);
let token: string | null = null;
const api = new HisaabApiClient({ baseUrl, getToken: () => token });
const show = (label: string, m: Meal) => {
  console.log(`${label}: ${m.dishName} — ${m.calories} kcal, P${m.proteinG} C${m.carbsG} F${m.fatG}`);
  for (const i of m.ingredients) console.log(`    - ${i.name}: ${i.quantity}${i.grams ? `, ${i.grams} g` : ''} → ${i.calories} kcal${i.pieces ? ` [${i.pieces} ${i.pieceUnit}]` : ''}`);
  console.log(`    question: ${m.clarify ? `"${m.clarify.question}" guess ${m.clarify.current}, options ${m.clarify.options.join('/')}` : 'none'}`);
};

token = (await api.auth.guest({ deviceId: `p1-check-${randomUUID()}`, name: 'P1 Check' })).token;
await api.me.updateProfile({ sex: 'male', age: 26, heightCm: 172, weightKg: 72, activityLevel: 'light', goal: 'lose' });

let t = Date.now();
let { meal } = await api.meals.analyze({ imageBase64: readFileSync(photo).toString('base64'), mimeType: 'image/jpeg' });
while (meal.status === 'analyzing') {
  await new Promise((r) => setTimeout(r, 400));
  meal = (await api.meals.get(meal.id)).meal;
}
console.log(`\n1) photo analysed in ${Date.now() - t} ms`);
show('   result', meal);

if (meal.clarify) {
  const answer = meal.clarify.current + 1;
  t = Date.now();
  meal = (await api.meals.clarify(meal.id, { pieces: answer, ingredientIndex: meal.clarify.ingredientIndex })).meal;
  console.log(`\n2) answered ${answer} in ${Date.now() - t} ms (no AI call)`);
  show('   result', meal);
} else {
  console.log('\n2) AI was sure of every count, so no question');
}

t = Date.now();
meal = (await api.meals.correct(meal.id, { name, quantity })).meal;
console.log(`\n3) "Wrong?" → "${name}", "${quantity}" recalculated in ${Date.now() - t} ms (corrections: ${meal.corrections})`);
show('   result', meal);

await api.meals.delete(meal.id);
console.log('\ncleanup → test meal deleted');
