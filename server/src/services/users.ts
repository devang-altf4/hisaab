import { DEFAULT_TZ, dateKey } from '../lib/dates.js';
import { inviteCode, newId } from '../lib/ids.js';
import { DEFAULT_TARGETS } from '../domain/nutrition.js';
import type { Store, User } from '../store/types.js';

export function newUser(deviceId: string, name?: string): User {
  const now = new Date().toISOString();
  return {
    id: newId(),
    deviceId,
    name: name?.trim() || 'Friend',
    role: 'user',
    timezone: DEFAULT_TZ,
    profile: null,
    targets: { ...DEFAULT_TARGETS },
    customTargets: false,
    isPro: false,
    proUntil: null,
    pushTokens: [],
    pushEnabled: false,
    notificationsPerDay: 10,
    nudgesSent: {},
    healthSync: { appleHealth: false, healthConnect: false },
    trainerInviteCode: inviteCode(),
    trainerIds: [],
    createdAt: now,
    lastActiveAt: now,
  };
}

/** Pro is active if flagged and not expired. */
export function isProActive(u: Pick<User, 'isPro' | 'proUntil'>): boolean {
  return u.isPro && (!u.proUntil || new Date(u.proUntil).getTime() > Date.now());
}

/** The user's first day (their timezone): history before it is never shown. */
export const joinedOn = (u: Pick<User, 'createdAt' | 'timezone'>) => dateKey(new Date(u.createdAt), u.timezone);

/** What the client sees. Device id, password hash and push tokens stay server-side. */
export function publicUser(u: User) {
  const { deviceId: _d, passwordHash: _h, pushTokens: _p, nudgesSent: _n, trainerIds, ...rest } = u;
  return {
    ...rest,
    email: u.email ?? null,
    joinedOn: joinedOn(u),
    isPro: isProActive(u),
    trainerCount: trainerIds.length,
    hasPushToken: u.pushTokens.length > 0,
  };
}

export async function touch(store: Store, u: User) {
  // Cheap "last active" for DAU — at most one write per 10 minutes.
  if (Date.now() - new Date(u.lastActiveAt).getTime() > 10 * 60_000) {
    await store.users.update(u.id, { lastActiveAt: new Date().toISOString() });
  }
}
