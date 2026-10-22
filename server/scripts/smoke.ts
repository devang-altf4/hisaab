/**
 * End-to-end check of every endpoint the app uses, through the SAME API client the app ships
 * (sdk/hisaabApi.ts), against a RUNNING server. Photo upload uses the same base64 request
 * the phone sends.
 *
 *   npm run dev                                   (terminal 1)
 *   npm run smoke                                 (terminal 2)
 *   API_URL=http://192.168.29.159:4000 PHOTO=path/to/meal.jpg npm run smoke
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HisaabApiClient, HisaabApiError, type Meal } from '../../sdk/hisaabApi.js';

const baseUrl = process.env.API_URL ?? 'http://localhost:4000';
let token: string | null = null;
const api = new HisaabApiClient({ baseUrl, getToken: () => token });

// Real photo if provided, else a tiny valid JPEG
const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const photo = process.env.PHOTO ? readFileSync(process.env.PHOTO).toString('base64') : TINY_JPEG;

let failures = 0;
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(`  ✓ ${name} (${Date.now() - t}ms)`);
    return out;
  } catch (err) {
    failures++;
    const e = err as HisaabApiError;
    console.log(`  ✗ ${name}: ${e.status ?? ''} ${e.code ?? ''} ${e.message}`);
    return undefined;
  }
}
function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
async function waitForMeal(id: string): Promise<Meal> {
  for (let i = 0; i < 60; i++) {
    const { meal } = await api.meals.get(id);
    if (meal.status !== 'analyzing') return meal;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('analysis timed out');
}
async function expectError(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
  } catch (e) {
    check(e instanceof HisaabApiError && e.code === code, `expected ${code}, got ${(e as Error).message}`);
    return e as HisaabApiError;
  }
  throw new Error(`expected ${code}, but the call succeeded`);
}

console.log(`\nHisaab smoke test → ${baseUrl}\n`);

const health = await step('server health', () => api.health());
console.log(`    aiMode=${health?.aiMode} db=${health?.dbMode}`);

await step('guest login (new user)', async () => {
  const r = await api.auth.guest({ deviceId: `smoke-${randomUUID()}` });
  token = r.token;
  check(r.created && r.user.profile === null, 'expected a fresh user without profile');
});

await step('onboarding: name + profile', async () => {
  await api.me.patch({ name: 'Smoke Tester' });
  const { user } = await api.me.updateProfile({ sex: 'male', age: 27, heightCm: 174, weightKg: 76, activityLevel: 'light', goal: 'lose' });
  check(user.name === 'Smoke Tester' && user.profile?.goal === 'lose', 'profile not saved');
  console.log(`    budget ${user.targets.calories} kcal, P${user.targets.proteinG} C${user.targets.carbsG} F${user.targets.fatG}`);
});

const snapped = await step('snap photo (base64, like the phone) → 202 analyzing', async () => {
  const { meal } = await api.meals.analyze({ imageBase64: photo, mimeType: 'image/jpeg' });
  check(meal.status === 'analyzing' && meal.imageUrl, `got status ${meal.status}`);
  return meal;
});
if (snapped) {
  await step('photo analysis finishes + image is served', async () => {
    const meal = await waitForMeal(snapped.id);
    check(meal.status === 'done', `status ${meal.status}: ${meal.error}`);
    const res = await fetch(api.resolveImageUrl(meal.imageUrl)!);
    check(res.ok, `image HTTP ${res.status}`);
    console.log(`    ${meal.dishName}, ${meal.calories} kcal, ${meal.hisaab?.label}. "${meal.verdict}"`);
  });
}

const described = await step('describe meal (wait)', async () => {
  const { meal } = await api.meals.analyze({ description: '2 idlis, sambar and a filter coffee', mealType: 'breakfast' }, { wait: true });
  check(meal.status === 'done' && meal.calories > 0, 'describe failed');
  console.log(`    ${meal.dishName}, ${meal.calories} kcal`);
  return meal;
});

if (described) {
  await step('Fix Results: 2× servings with edited numbers', async () => {
    const c = described.calories * 2;
    const { meal } = await api.meals.patch(described.id, { servings: 2, calories: c });
    check(meal.servings === 2 && meal.calories === c && meal.edited, 'patch did not stick');
  });
}

await step('manual / barcode-style meal', async () => {
  const { meal } = await api.meals.create({ dishName: 'Banana', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, source: 'barcode', servings: 2 });
  check(meal.calories === 210, `calories ${meal.calories}`);
  await api.meals.delete(meal.id);
});

await step('barcode lookup (needs internet; 404 is fine)', async () => {
  try {
    const { product } = await api.food.barcode('8901058851427');
    console.log(`    ${product.name}: ${product.calories} kcal / ${product.servingLabel}`);
  } catch (e) {
    check(e instanceof HisaabApiError && [400, 404].includes(e.status), (e as Error).message);
    console.log(`    (${(e as HisaabApiError).status}: ${(e as Error).message})`);
  }
});

await step('water add + undo', async () => {
  await api.water.log(250);
  const { water } = await api.water.log(250);
  check(water.ml === 500, `water ${water.ml}`);
  const after = await api.water.deleteLast();
  check(after.water.ml === 250, 'undo failed');
});

await step('workout log, list, delete', async () => {
  const { workout } = await api.workouts.create({ type: 'Cricket', durationMin: 45 });
  check(workout.caloriesBurned > 0, 'no burn estimate');
  const { workouts } = await api.workouts.list();
  check(workouts.some((w) => w.id === workout.id), 'not listed');
  await api.workouts.create({ type: 'Walking', durationMin: 30 });
  await api.workouts.delete(workout.id);
});

await step('health sync is idempotent', async () => {
  const payload = {
    source: 'health_connect' as const,
    workouts: [{ externalId: randomUUID(), type: 'Running', durationMin: 20, caloriesBurned: 200, startedAt: new Date().toISOString() }],
  };
  const a = await api.healthSync.sync(payload);
  const b = await api.healthSync.sync(payload);
  check(a.imported === 1 && b.skipped === 1, JSON.stringify({ a, b }));
  await api.healthSync.updateSettings({ healthConnect: true });
});

await step('dashboard adds up', async () => {
  const d = await api.dashboard.get();
  const s = d.summary;
  check(s.caloriesLeft === s.budget - s.eaten + s.burned, 'ledger math');
  check(d.meals.every((m) => m.status !== 'failed'), 'a meal failed');
  console.log(`    budget ${s.budget} − eaten ${s.eaten} + burned ${s.burned} = ${s.caloriesLeft} → ${s.pnl.label}; streak ${d.streak}`);
});

await step('ledger starts on the join date (week + month)', async () => {
  // A brand-new account only has today: history starts on the join date.
  const { user } = await api.me.get();
  const week = await api.ledger.get();
  check(week.days.length === 1 && week.days[0].date === user.joinedOn && week.days[0].logged, `week has ${week.days.length} days`);
  const today = new Date();
  const from = new Date(today.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
  const month = await api.ledger.get(from);
  check(month.days.every((d) => d.date >= user.joinedOn), 'month shows nothing before the join date');
});

await step('coach chat (English) + history', async () => {
  const { reply } = await api.chat.send('If I eat a slice of cake, how much loss is that?');
  check(reply.role === 'model' && reply.text.length > 0, 'empty reply');
  check(!/\b(bhai|hai|karo|kya)\b/i.test(reply.text), `reply not English: ${reply.text}`);
  const { messages } = await api.chat.history();
  check(messages.length === 2, `history ${messages.length}`);
  console.log(`    Coach: ${reply.text.slice(0, 140)}…`);
});

await step('notification schedule + test notification', async () => {
  const { notifications } = await api.notifications.schedule(10);
  check(notifications.length === 10, `got ${notifications.length}`);
  const t = await api.notifications.test();
  check(t.notification.title.length > 0, 'empty test notification');
  console.log(`    e.g. "${notifications[3].title}: ${notifications[3].body}"`);
});

const limits = (await api.subscription.get().catch(() => null))?.usage.limitsEnabled !== false;
if (limits) {
  await step('free plan: 4th scan → 402 paywall', async () => {
    // photo + describe already used 2 of 3
    await api.meals.analyze({ description: 'one samosa' }, { wait: true });
    const e = await expectError(() => api.meals.analyze({ description: 'another samosa' }, { wait: true }), 'PAYWALL_LIMIT');
    console.log(`    402: ${e.message}`);
  });
} else {
  await step('limits off (MVP): 4th and 5th scans still work', async () => {
    await api.meals.analyze({ description: 'one samosa' }, { wait: true });
    const { meal } = await api.meals.analyze({ description: 'another samosa' }, { wait: true });
    check(meal.status === 'done', `scan not done with limits off: ${meal.status} ${meal.error ?? ''}`);
  });
}

await step('mock upgrade → Pro unlocks scans, cancel', async () => {
  const sub = await api.subscription.get();
  check(sub.plans.length === 2 && !sub.isPro, 'subscription info');
  const { user } = await api.subscription.mockUpgrade('pro_yearly');
  check(user.isPro, 'not pro');
  await api.meals.analyze({ description: 'masala dosa' }, { wait: true });
  await api.subscription.cancel();
});

await step('trainer: invite, link, view, revoke', async () => {
  const clientToken = token;
  const { code } = await api.trainer.inviteCode();
  token = (await api.auth.guest({ deviceId: `smoke-trainer-${randomUUID()}`, name: 'Coach Priya' })).token;
  await api.trainer.link(code.toLowerCase());
  const { clients } = await api.trainer.clients();
  check(clients.length === 1, 'no client');
  const view = await api.trainer.clientDashboard(clients[0].id);
  check(view.dashboard.meals.length > 0, 'trainer sees no meals');
  token = clientToken;
  await api.trainer.revoke();
});

await step('accounts: create account, sign in again, trainer shares across accounts', async () => {
  const clientToken = token;
  const email = `smoke-${randomUUID().slice(0, 8)}@example.com`;
  const created = await api.auth.register({ email, password: 'smoke-pass-123' });
  check(created.user.email === email, 'account not created');
  // "Another phone": sign in with email + password, same account and data
  token = null;
  const signedIn = await api.auth.login({ email: email.toUpperCase(), password: 'smoke-pass-123' });
  check(signedIn.user.id === created.user.id, 'sign-in opened a different account');
  await expectError(() => api.auth.login({ email, password: 'wrong-password' }), 'INVALID_CREDENTIALS');
  token = signedIn.token;
  const { code } = await api.trainer.inviteCode();
  // Same phone: sign out, the trainer starts as a guest and creates their own account
  token = (await api.auth.guest({ deviceId: `smoke-trainer-${randomUUID()}`, name: 'Coach Asha' })).token;
  const trainerEmail = `smoke-trainer-${randomUUID().slice(0, 8)}@example.com`;
  await api.auth.register({ email: trainerEmail, password: 'trainer-pass-1' });
  await api.trainer.link(code);
  token = (await api.auth.login({ email: trainerEmail, password: 'trainer-pass-1' })).token;
  const { clients } = await api.trainer.clients();
  check(clients.some((c) => c.id === created.user.id), 'trainer account does not see the client');
  token = clientToken;
  await api.trainer.revoke();
});

await step('expired token → 401 UNAUTHORIZED', async () => {
  const saved = token;
  token = 'not-a-real-token';
  await expectError(() => api.me.get(), 'UNAUTHORIZED');
  token = saved;
});

console.log(failures ? `\n${failures} step(s) FAILED\n` : '\nAll checks passed ✅\n');
process.exit(failures ? 1 : 0);
