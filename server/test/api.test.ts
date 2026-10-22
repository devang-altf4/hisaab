import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import type { Store } from '../src/store/types.js';

// Runs fully offline: memory store + mock AI (see vitest.config.ts).

let store: Store;
let app: ReturnType<typeof createApp>;

// 1×1 JPEG
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

async function login(deviceId: string, name?: string) {
  const res = await request(app).post('/api/auth/guest').send({ deviceId, name });
  return { token: res.body.token as string, user: res.body.user, status: res.status };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function waitForMeal(token: string, id: string) {
  for (let i = 0; i < 50; i++) {
    const res = await request(app).get(`/api/meals/${id}`).set(auth(token));
    if (res.body.meal.status !== 'analyzing') return res.body.meal;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('meal never finished');
}

beforeAll(() => {
  store = createMemoryStore();
  app = createApp(store);
});

describe('auth', () => {
  it('guest login is idempotent per device', async () => {
    const a = await login('device-aaaa-1111', 'Mohak');
    const b = await login('device-aaaa-1111');
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.user.id).toBe(a.user.id);
    expect(a.user.deviceId).toBeUndefined();
  });

  it('rejects missing / bad tokens with UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    const bad = await request(app).get('/api/me').set(auth('nope'));
    expect(bad.status).toBe(401);
  });

  it('health is public', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toMatchObject({ ok: true, aiMode: 'mock', dbMode: 'memory' });
  });
});

describe('full day flow', () => {
  let token: string;

  beforeAll(async () => {
    ({ token } = await login('device-flow-0001', 'Devang'));
  });

  it('onboarding sets the daily capital', async () => {
    const res = await request(app).put('/api/me/profile').set(auth(token)).send({
      sex: 'male', age: 25, heightCm: 172, weightKg: 78, activityLevel: 'moderate', goal: 'lose',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.profile.goal).toBe('lose');
    expect(res.body.user.targets.calories).toBeGreaterThan(1500);
  });

  it('validates profile input', async () => {
    const res = await request(app).put('/api/me/profile').set(auth(token)).send({ sex: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('photo scan returns 202 instantly, then completes in the background', async () => {
    const res = await request(app)
      .post('/api/meals/analyze')
      .set(auth(token))
      .attach('image', JPEG, { filename: 'meal.jpg', contentType: 'image/jpeg' })
      .field('mealType', 'lunch');
    expect(res.status).toBe(202);
    expect(res.body.meal).toMatchObject({ status: 'analyzing', source: 'photo', hisaab: null });
    expect(res.body.meal.imageUrl).toMatch(/^\/uploads\/.+\.jpg$/);

    const done = await waitForMeal(token, res.body.meal.id);
    expect(done.status).toBe('done');
    expect(done.calories).toBeGreaterThan(0);
    expect(done.hisaab.status).toMatch(/PROFIT|LOSS|BREAK_EVEN/);

    const img = await request(app).get(res.body.meal.imageUrl);
    expect(img.status).toBe(200);
  });

  it('describe-a-meal with wait=true returns the full analysis', async () => {
    const res = await request(app)
      .post('/api/meals/analyze?wait=true')
      .set(auth(token))
      .send({ description: '2 roti aur dal tadka', mealType: 'dinner' });
    expect(res.status).toBe(200);
    expect(res.body.meal).toMatchObject({ status: 'done', source: 'text', calories: 400 });
    expect(res.body.meal.ingredients).toHaveLength(2);
  });

  it('Fix Results: servings rescale, explicit numbers override', async () => {
    const created = await request(app).post('/api/meals').set(auth(token)).send({
      dishName: 'Banana', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, mealType: 'snack',
    });
    expect(created.status).toBe(201);
    const id = created.body.meal.id;
    const doubled = await request(app).patch(`/api/meals/${id}`).set(auth(token)).send({ servings: 2 });
    expect(doubled.body.meal).toMatchObject({ calories: 210, carbsG: 54, servings: 2, edited: true });
    const fixed = await request(app).patch(`/api/meals/${id}`).set(auth(token)).send({ dishName: 'Kela', calories: 200 });
    expect(fixed.body.meal).toMatchObject({ dishName: 'Kela', calories: 200 });
  });

  it('water and workouts feed the ledger', async () => {
    const w = await request(app).post('/api/water').set(auth(token)).send({ ml: 250 });
    expect(w.status).toBe(201);
    expect(w.body.water.ml).toBe(250);
    await request(app).post('/api/water').set(auth(token)).send({ ml: 250 });
    const undo = await request(app).delete('/api/water/last').set(auth(token));
    expect(undo.body.water.ml).toBe(250);

    const wo = await request(app).post('/api/workouts').set(auth(token)).send({ type: 'Running', durationMin: 30 });
    expect(wo.status).toBe(201);
    expect(wo.body.workout.caloriesBurned).toBeGreaterThan(300);
  });

  it('dashboard adds it all up', async () => {
    const res = await request(app).get('/api/dashboard').set(auth(token));
    expect(res.status).toBe(200);
    const s = res.body.summary;
    expect(res.body.meals).toHaveLength(3);
    expect(s.eaten).toBe(res.body.meals.reduce((a: number, m: any) => a + m.calories, 0));
    expect(s.caloriesLeft).toBe(s.budget - s.eaten + s.burned);
    expect(res.body.streak).toBe(1);
    expect(res.body.usage.scans.used).toBe(2);
  });

  it('health sync imports once (idempotent by externalId)', async () => {
    const body = {
      source: 'apple_health',
      workouts: [{ externalId: 'hk-1', type: 'Walking', durationMin: 40, caloriesBurned: 180, startedAt: new Date().toISOString() }],
    };
    const first = await request(app).post('/api/health/sync').set(auth(token)).send(body);
    const second = await request(app).post('/api/health/sync').set(auth(token)).send(body);
    expect(first.body).toEqual({ imported: 1, skipped: 0 });
    expect(second.body).toEqual({ imported: 0, skipped: 1 });
  });

  it('ledger starts on the join date, then covers 7 days with totals', async () => {
    // Joined today: no fake "profit" days from before the account existed
    const fresh = await request(app).get('/api/ledger').set(auth(token));
    expect(fresh.body.days).toHaveLength(1);
    expect(fresh.body.totals.loggedDays).toBe(1);

    const me = (await request(app).get('/api/me').set(auth(token))).body.user;
    await store.users.update(me.id, { createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString() });
    const res = await request(app).get('/api/ledger').set(auth(token));
    expect(res.body.days).toHaveLength(7);
    expect(res.body.totals.loggedDays).toBe(1);
  });

  it('free tier: 3rd scan ok, 4th hits the paywall, mock upgrade unlocks', async () => {
    const scan = () => request(app).post('/api/meals/analyze?wait=true').set(auth(token)).send({ description: 'ek samosa' });
    expect((await scan()).status).toBe(200);
    const blocked = await scan();
    expect(blocked.status).toBe(402);
    expect(blocked.body.error).toMatchObject({ code: 'PAYWALL_LIMIT', details: { feature: 'scans', used: 3, limit: 3 } });

    const up = await request(app).post('/api/subscription/mock-upgrade').set(auth(token)).send({ planId: 'pro_monthly' });
    expect(up.status).toBe(200);
    expect(up.body.user.isPro).toBe(true);
    expect((await scan()).status).toBe(200);
  });

  it('Coach answers with real numbers and keeps history', async () => {
    const res = await request(app).post('/api/chat/coach').set(auth(token)).send({ message: 'What if I eat a slice of cake?' });
    expect(res.status).toBe(200);
    expect(res.body.reply.role).toBe('model');
    expect(res.body.reply.text).toMatch(/350 kcal/);
    const hist = await request(app).get('/api/chat/history').set(auth(token));
    expect(hist.body.messages.map((m: any) => m.role)).toEqual(['user', 'model']);
  });

  it('notification schedule respects the count and is time-ordered', async () => {
    const res = await request(app).get('/api/notifications/schedule?count=4').set(auth(token));
    expect(res.body.notifications).toHaveLength(4);
    const times = res.body.notifications.map((n: any) => n.hour * 60 + n.minute);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(res.body.notifications[0].title.length).toBeGreaterThan(0);

    const test = await request(app).post('/api/notifications/test').set(auth(token));
    expect(test.body).toMatchObject({ pushed: false });
    expect(test.body.notification.body.length).toBeGreaterThan(0);
  });

  it('cannot read another user\'s meal', async () => {
    const other = await login('device-other-999');
    const mine = await request(app).get('/api/dashboard').set(auth(token));
    const res = await request(app).get(`/api/meals/${mine.body.meals[0].id}`).set(auth(other.token));
    expect(res.status).toBe(403);
  });
});

describe('trainer', () => {
  it('client shares code, trainer links and reads the ledger, client revokes', async () => {
    const client = await login('device-client-01', 'Rahul');
    const trainer = await login('device-trainer-01', 'Coach Priya');

    const { body: codeBody } = await request(app).get('/api/trainer/invite-code').set(auth(client.token));
    expect(codeBody.code).toMatch(/^HSB-/);

    const self = await request(app).post('/api/trainer/link').set(auth(client.token)).send({ code: codeBody.code });
    expect(self.status).toBe(400);

    const link = await request(app).post('/api/trainer/link').set(auth(trainer.token)).send({ code: codeBody.code.toLowerCase() });
    expect(link.body.client).toMatchObject({ id: client.user.id, name: 'Rahul' });

    const list = await request(app).get('/api/trainer/clients').set(auth(trainer.token));
    expect(list.body.clients).toHaveLength(1);
    expect(list.body.clients[0].today.pnl.status).toBeDefined();

    const view = await request(app).get(`/api/trainer/clients/${client.user.id}`).set(auth(trainer.token));
    expect(view.status).toBe(200);
    expect(view.body.dashboard.summary).toBeDefined();

    await request(app).post('/api/trainer/revoke').set(auth(client.token));
    const after = await request(app).get(`/api/trainer/clients/${client.user.id}`).set(auth(trainer.token));
    expect(after.status).toBe(403);
  });
});

describe('guest login race', () => {
  it('parallel first-launch logins for one device create a single user', async () => {
    const results = await Promise.all([1, 2, 3].map(() => login('device-race-0001')));
    expect(new Set(results.map((r) => r.user.id)).size).toBe(1);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });
});

describe('P1: "How many?" + "Wrong?"', () => {
  let token: string;
  let userId: string;
  let mealId: string;

  beforeAll(async () => {
    const l = await login('device-p1-clarify-01', 'Asha');
    token = l.token;
    userId = l.user.id;
    await request(app).put('/api/me/profile').set(auth(token)).send({
      sex: 'female', age: 30, heightCm: 160, weightKg: 60, activityLevel: 'light', goal: 'lose',
    });
    const { clarifyFor } = await import('../src/domain/mealMath.js');
    const { blankMeal } = await import('../src/services/meals.js');
    const user = (await store.users.get(userId))!;
    const tikka = { name: 'Chicken tikka', quantity: '2 skewers', grams: 200, calories: 330, proteinG: 62, carbsG: 0, fatG: 8, fiberG: 0, pieces: 2, pieceUnit: 'skewer' };
    const oil = { name: 'Oil', quantity: '1 tbsp', grams: 14, calories: 124, proteinG: 0, carbsG: 0, fatG: 14, fiberG: 0 };
    const meal = await store.meals.create({
      ...blankMeal(user, { date: (await request(app).get('/api/dashboard').set(auth(token))).body.date, mealType: 'lunch', source: 'photo' }),
      status: 'done',
      dishName: 'Chicken Tikka Skewers',
      calories: 454, proteinG: 62, carbsG: 0, fatG: 22, fiberG: 0, healthScore: 8,
      ingredients: [tikka, oil],
      clarify: clarifyFor(tikka, 0),
    });
    mealId = meal.id;
  });

  it('dashboard exposes the question', async () => {
    const res = await request(app).get('/api/dashboard').set(auth(token));
    const meal = res.body.meals.find((m: any) => m.id === mealId);
    expect(meal.clarify).toEqual({ ingredientIndex: 0, question: 'How many skewers?', unit: 'skewer', current: 2, options: [1, 2, 3, 4] });
    expect(meal.corrections).toBe(0);
  });

  it('portion change keeps the question in sync', async () => {
    const res = await request(app).patch(`/api/meals/${mealId}`).set(auth(token)).send({ servings: 2 });
    expect(res.body.meal.clarify.current).toBe(4);
    const back = await request(app).patch(`/api/meals/${mealId}`).set(auth(token)).send({ servings: 1 });
    expect(back.body.meal).toMatchObject({ calories: 454, clarify: { current: 2 } });
  });

  it('answering "4 skewers" recalculates instantly and clears the question', async () => {
    const res = await request(app).post(`/api/meals/${mealId}/clarify`).set(auth(token)).send({ pieces: 4 });
    expect(res.status).toBe(200);
    expect(res.body.meal).toMatchObject({ calories: 784, proteinG: 124, fatG: 30, clarify: null, edited: true });
    expect(res.body.meal.ingredients[0]).toMatchObject({ pieces: 4, quantity: '4 skewers', grams: 400, calories: 660 });
    const usage = await request(app).get('/api/subscription').set(auth(token));
    expect(usage.body.usage.scans.used).toBe(0); // no scan used
  });

  it('a second answer without a question is rejected', async () => {
    const res = await request(app).post(`/api/meals/${mealId}/clarify`).set(auth(token)).send({ pieces: 3 });
    expect(res.status).toBe(400);
  });

  it('"Wrong?" needs at least one detail', async () => {
    const res = await request(app).post(`/api/meals/${mealId}/correct`).set(auth(token)).send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('"Wrong?" redoes the meal from the user details, without using a scan', async () => {
    const res = await request(app).post(`/api/meals/${mealId}/correct`).set(auth(token)).send({ name: 'chicken biryani', quantity: '2 plate' });
    expect(res.status).toBe(200);
    expect(res.body.meal.dishName).toMatch(/Chicken Biryani/);
    expect(res.body.meal).toMatchObject({ corrections: 1, clarify: null, status: 'done', servings: 1 });
    expect(res.body.meal.calories).toBe(1100);
    const usage = await request(app).get('/api/subscription').set(auth(token));
    expect(usage.body.usage.scans.used).toBe(0);
  });

  it('allows 3 corrections per meal, then asks for manual edit', async () => {
    for (let i = 0; i < 2; i++) {
      const ok = await request(app).post(`/api/meals/${mealId}/correct`).set(auth(token)).send({ quantity: '1 plate' });
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).post(`/api/meals/${mealId}/correct`).set(auth(token)).send({ quantity: '1 plate' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toMatch(/3 times/);
  });

  it('other users cannot clarify or correct this meal', async () => {
    const other = await login('device-p1-other-01');
    expect((await request(app).post(`/api/meals/${mealId}/clarify`).set(auth(other.token)).send({ pieces: 2 })).status).toBe(403);
    expect((await request(app).post(`/api/meals/${mealId}/correct`).set(auth(other.token)).send({ name: 'x' })).status).toBe(403);
  });
});

describe('MVP mode: LIMITS_ENABLED=false', () => {
  it('no scan, chat or recalculation caps, and the app is told to hide counters', async () => {
    const { config } = await import('../src/config.js');
    config.LIMITS_ENABLED = false;
    try {
      const { token } = await login('device-mvp-nolimits-01', 'Ceo Demo');
      let lastMeal: any;
      for (let i = 0; i < 5; i++) {
        const r = await request(app).post('/api/meals/analyze?wait=true').set(auth(token)).send({ description: '2 roti and dal tadka' });
        expect(r.status).toBe(200);
        lastMeal = r.body.meal;
      }
      for (let i = 0; i < 6; i++) {
        expect((await request(app).post('/api/chat/coach').set(auth(token)).send({ message: 'How is my day?' })).status).toBe(200);
      }
      for (let i = 0; i < 4; i++) {
        expect((await request(app).post(`/api/meals/${lastMeal.id}/correct`).set(auth(token)).send({ quantity: '3 roti' })).status).toBe(200);
      }
      const sub = await request(app).get('/api/subscription').set(auth(token));
      expect(sub.body.usage).toMatchObject({ limitsEnabled: false, scans: { used: 5 } });
    } finally {
      config.LIMITS_ENABLED = true;
    }
  });
});

describe('Edit items (totals are never typed)', () => {
  let token: string;
  let mealId: string;
  const sum = (m: any) => m.ingredients.reduce((t: number, i: any) => t + i.calories, 0);

  beforeAll(async () => {
    const l = await login('device-edit-items-01', 'Kiran');
    token = l.token;
    const { blankMeal } = await import('../src/services/meals.js');
    const { clarifyFor } = await import('../src/domain/mealMath.js');
    const user = (await store.users.get(l.user.id))!;
    const tikka = { name: 'Chicken tikka', quantity: '2 skewers', grams: 200, calories: 330, proteinG: 62, carbsG: 0, fatG: 8, fiberG: 0, pieces: 2, pieceUnit: 'skewer' };
    const oil = { name: 'Oil', quantity: '1 tbsp', grams: 14, calories: 124, proteinG: 0, carbsG: 0, fatG: 14, fiberG: 0 };
    const meal = await store.meals.create({
      ...blankMeal(user, { date: '2026-10-21', mealType: 'lunch', source: 'photo' }),
      status: 'done', dishName: 'Chicken Tikka', calories: 454, proteinG: 62, carbsG: 0, fatG: 22, fiberG: 0,
      ingredients: [tikka, oil], clarify: clarifyFor(tikka, 0),
    });
    mealId = meal.id;
  });

  const put = (body: object, t = token) => request(app).put(`/api/meals/${mealId}/ingredients`).set(auth(t)).send(body);

  it('changing grams scales that item exactly (no AI) and updates pieces + totals', async () => {
    const res = await put({ items: [{ ref: 0, name: 'Chicken tikka', grams: 300 }, { ref: 1, name: 'Oil' }] });
    expect(res.status).toBe(200);
    expect(res.body.meal.ingredients[0]).toMatchObject({ grams: 300, calories: 495, proteinG: 93, fatG: 12, pieces: 3, quantity: '3 skewers' });
    expect(res.body.meal).toMatchObject({ calories: 619, proteinG: 93, fatG: 26, clarify: null, edited: true });
    expect(res.body.meal.calories).toBe(sum(res.body.meal));
  });

  it('removing an item drops it from the totals', async () => {
    const res = await put({ items: [{ ref: 0, name: 'Chicken tikka' }] });
    expect(res.body.meal.ingredients).toHaveLength(1);
    expect(res.body.meal.calories).toBe(495);
  });

  it('adding an item estimates it at the weight given', async () => {
    const res = await put({ items: [{ ref: 0, name: 'Chicken tikka' }, { name: 'Raita', grams: 150 }] });
    const raita = res.body.meal.ingredients[1];
    expect(raita).toMatchObject({ name: 'Raita', grams: 150, quantity: '150 g' });
    expect(raita.calories).toBeGreaterThan(0);
    expect(res.body.meal.calories).toBe(sum(res.body.meal));
  });

  it('renaming an item re-estimates it; dish name and meal slot can change too', async () => {
    const res = await put({ items: [{ ref: 0, name: 'Paneer tikka', grams: 200 }, { ref: 1, name: 'Raita' }], dishName: 'Paneer Tikka', mealType: 'dinner' });
    expect(res.body.meal.ingredients[0]).toMatchObject({ name: 'Paneer tikka', grams: 200 });
    expect(res.body.meal).toMatchObject({ dishName: 'Paneer Tikka', mealType: 'dinner' });
    expect(res.body.meal.calories).toBe(sum(res.body.meal));
  });

  it('rejects an empty list, unknown refs and other users', async () => {
    expect((await put({ items: [] })).status).toBe(400);
    expect((await put({ items: [{ ref: 9, name: 'Ghost' }] })).status).toBe(400);
    const other = await login('device-edit-items-other');
    expect((await put({ items: [{ name: 'Rice', grams: 100 }] }, other.token)).status).toBe(403);
  });
});
