import { Router } from 'express';
import { z } from 'zod';
import { computeTargets } from '../domain/nutrition.js';
import { ApiError, badRequest } from '../lib/errors.js';
import { signToken } from '../middleware/auth.js';
import { parse } from '../middleware/error.js';
import { assertNotLockedOut, hashPassword, recordLogin, verifyPassword } from '../services/passwords.js';
import { newUser, publicUser } from '../services/users.js';
import type { Store, User } from '../store/types.js';

const GuestBody = z.object({
  deviceId: z.string().min(8).max(128),
  name: z.string().max(40).optional(),
});

const Email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254));
const LoginBody = z.object({ email: Email, password: z.string().min(1).max(128) });
const RegisterBody = z.object({
  email: Email,
  password: z.string().min(8, 'Use at least 8 characters for your password').max(128),
});

const emailTaken = () => new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Sign in instead.');

const MePatch = z.object({
  name: z.string().min(1).max(40).optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Unknown timezone')
    .optional(),
  notificationsPerDay: z.number().int().min(0).max(10).optional(),
});

export const ProfileBody = z.object({
  sex: z.enum(['male', 'female']),
  age: z.number().int().min(13).max(100),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(25).max(300),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  targetWeightKg: z.number().min(25).max(300).optional(),
});

const TargetsBody = z.object({
  calories: z.number().int().min(800).max(6000),
  proteinG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(400),
  waterMl: z.number().int().min(500).max(8000),
});

const inflightGuests = new Map<string, Promise<{ user: User; created: boolean }>>();

/** Public — mounted before the auth middleware. */
export function authRoutes(store: Store) {
  const r = Router();

  /**
   * Guest login keyed by a device id the app generates once and keeps in SecureStore.
   * Same deviceId → same account. (Phone OTP / Google sign-in can be layered on later.)
   */
  r.post('/auth/guest', async (req, res) => {
    const body = parse(GuestBody, req.body);
    // Concurrent first-launch calls for one device must not create two accounts.
    let pending = inflightGuests.get(body.deviceId);
    if (!pending) {
      pending = (async () => {
        const existing = await store.users.findOne({ deviceId: body.deviceId });
        // A guest key must never open an account that has a password.
        if (existing?.email) throw new ApiError(409, 'ACCOUNT_REGISTERED', 'This account has a password. Sign in instead.');
        if (existing) return { user: existing, created: false };
        return { user: await store.users.create(newUser(body.deviceId, body.name)), created: true };
      })().finally(() => inflightGuests.delete(body.deviceId));
      inflightGuests.set(body.deviceId, pending);
    }
    const { user, created } = await pending;
    res.status(created ? 201 : 200).json({ token: signToken(user.id), user: publicUser(user), created });
  });

  /** Email + password sign-in. Same answer for unknown email and wrong password. */
  r.post('/auth/login', async (req, res) => {
    const { email, password } = parse(LoginBody, req.body);
    assertNotLockedOut(email);
    const user = await store.users.findOne({ email });
    const ok = await verifyPassword(password, user?.passwordHash);
    recordLogin(email, ok);
    if (!user || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email or password.');
    res.json({ token: signToken(user.id), user: publicUser(user) });
  });

  return r;
}

export function accountRoutes(store: Store) {
  const r = Router();

  r.get('/me', (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  /**
   * Create an account: puts an email + password on the current guest account (all its data stays).
   * Called at the end of onboarding.
   */
  r.post('/auth/register', async (req, res) => {
    const { email, password } = parse(RegisterBody, req.body);
    if (req.user.email) throw badRequest('You already have an account. Sign out to create another one.');
    if (await store.users.findOne({ email })) throw emailTaken();
    let user;
    try {
      user = await store.users.update(req.user.id, { email, passwordHash: await hashPassword(password) });
    } catch (err: any) {
      if (err?.code === 11000) throw emailTaken(); // lost a race on the unique index
      throw err;
    }
    res.status(201).json({ token: signToken(user!.id), user: publicUser(user!) });
  });

  r.patch('/me', async (req, res) => {
    const patch = parse(MePatch, req.body);
    const user = await store.users.update(req.user.id, patch);
    res.json({ user: publicUser(user!) });
  });

  /** Onboarding / edit profile. Recomputes daily capital unless the user set custom targets. */
  r.put('/me/profile', async (req, res) => {
    const profile = parse(ProfileBody, req.body);
    const user = await store.users.update(req.user.id, {
      profile,
      ...(req.user.customTargets ? {} : { targets: computeTargets(profile) }),
    });
    res.json({ user: publicUser(user!) });
  });

  /** Manual targets. Send { reset: true } to go back to computed targets. */
  r.put('/me/targets', async (req, res) => {
    if (req.body?.reset === true) {
      const targets = req.user.profile ? computeTargets(req.user.profile) : req.user.targets;
      const user = await store.users.update(req.user.id, { targets, customTargets: false });
      res.json({ user: publicUser(user!) });
      return;
    }
    const targets = parse(TargetsBody, req.body);
    const user = await store.users.update(req.user.id, { targets, customTargets: true });
    res.json({ user: publicUser(user!) });
  });

  return r;
}
