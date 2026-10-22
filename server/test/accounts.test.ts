import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import type { Store } from '../src/store/types.js';

// Email + password accounts on top of guest sessions. Offline: memory store.

let store: Store;
let app: ReturnType<typeof createApp>;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const guest = async (deviceId: string, name?: string) =>
  (await request(app).post('/api/auth/guest').send({ deviceId, name })).body.token as string;
const register = (token: string, email: string, password: string) =>
  request(app).post('/api/auth/register').set(auth(token)).send({ email, password });
const signIn = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });

beforeAll(() => {
  store = createMemoryStore();
  app = createApp(store);
});

describe('accounts', () => {
  let guestToken: string;
  let userId: string;

  beforeAll(async () => {
    guestToken = await guest('acct-device-0001', 'Asha');
    await request(app).post('/api/meals').set(auth(guestToken)).send({ dishName: 'Poha', calories: 250, proteinG: 6, carbsG: 45, fatG: 6 });
    userId = (await request(app).get('/api/me').set(auth(guestToken))).body.user.id;
  });

  it('a guest creates an account and keeps everything they logged', async () => {
    const res = await register(guestToken, '  Asha@Example.com ', 'chai-and-poha');
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ id: userId, email: 'asha@example.com', name: 'Asha' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const meals = (await request(app).get('/api/dashboard').set(auth(res.body.token))).body.meals;
    expect(meals.map((m: { dishName: string }) => m.dishName)).toEqual(['Poha']);
  });

  it('signs in with email + password from any phone (email is case-insensitive)', async () => {
    const res = await signIn('ASHA@example.com', 'chai-and-poha');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    const me = await request(app).get('/api/me').set(auth(res.body.token));
    expect(me.body.user.email).toBe('asha@example.com');
  });

  it('wrong password and unknown email get the same answer', async () => {
    const wrong = await signIn('asha@example.com', 'not-the-password');
    const unknown = await signIn('nobody@example.com', 'chai-and-poha');
    for (const r of [wrong, unknown]) {
      expect(r.status).toBe(401);
      expect(r.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Wrong email or password.' });
    }
  });

  it('validates email and password length with readable messages', async () => {
    const t = await guest('acct-device-0002');
    const badEmail = await register(t, 'not-an-email', 'longenough');
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.message).toBe('Enter a valid email address');
    const short = await register(t, 'short@example.com', '1234567');
    expect(short.body.error.message).toBe('Use at least 8 characters for your password');
  });

  it('one account per email', async () => {
    const t = await guest('acct-device-0003');
    const res = await register(t, 'asha@example.com', 'something-else');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('an account can only be created once', async () => {
    const t = (await signIn('asha@example.com', 'chai-and-poha')).body.token;
    const res = await register(t, 'asha2@example.com', 'chai-and-poha');
    expect(res.status).toBe(400);
  });

  it('the old guest key no longer opens an account that has a password', async () => {
    const res = await request(app).post('/api/auth/guest').send({ deviceId: 'acct-device-0001' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_REGISTERED');
  });

  it('locks sign-in for an email after 10 wrong passwords', async () => {
    const t = await guest('acct-device-0004');
    await register(t, 'locked@example.com', 'right-password');
    for (let i = 0; i < 10; i++) await signIn('locked@example.com', 'wrong-password');
    const res = await signIn('locked@example.com', 'right-password');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('every user carries the day they joined', async () => {
    const t = (await signIn('asha@example.com', 'chai-and-poha')).body.token;
    const me = (await request(app).get('/api/me').set(auth(t))).body.user;
    expect(me.joinedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ledger = (await request(app).get('/api/ledger').set(auth(t))).body;
    expect(ledger.days.map((d: { date: string }) => d.date)).toEqual([me.joinedOn]);
  });
});

describe('trainer sharing between two real accounts (one phone, sign out and in)', () => {
  it('client shares code, trainer signs in as themself, links and sees the client', async () => {
    const client = (await register(await guest('acct-client-0001', 'Rahul'), 'rahul@example.com', 'rahul-pass-1')).body;
    const code = (await request(app).get('/api/trainer/invite-code').set(auth(client.token))).body.code;

    // Same phone: sign out, start fresh as the trainer, create their account
    const trainer = (await register(await guest('acct-trainer-0001', 'Coach Priya'), 'priya@example.com', 'priya-pass-1')).body;
    const link = await request(app).post('/api/trainer/link').set(auth(trainer.token)).send({ code });
    expect(link.status).toBe(200);
    expect(link.body.client.name).toBe('Rahul');

    // Trainer signs in again later and still sees the client, with their join date
    const again = (await signIn('priya@example.com', 'priya-pass-1')).body.token;
    const clients = (await request(app).get('/api/trainer/clients').set(auth(again))).body.clients;
    expect(clients.map((c: { name: string }) => c.name)).toEqual(['Rahul']);
    const view = await request(app).get(`/api/trainer/clients/${client.user.id}`).set(auth(again));
    expect(view.body.client.joinedOn).toBe(client.user.joinedOn);
  });
});
