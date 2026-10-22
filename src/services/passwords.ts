import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from '../lib/errors.js';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEYLEN = 64;

/** "scrypt$<salt hex>$<hash hex>" — no extra dependency, built into Node. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(KEYLEN * 2)}`;

/** Constant-ish time: an unknown email still pays for one scrypt, so timing doesn't reveal accounts. */
export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [algo, saltHex, hashHex] = (stored ?? DUMMY_HASH).split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return Boolean(stored) && timingSafeEqual(actual, expected);
}

// Sign-in throttle: 10 wrong passwords per email per 15 minutes (in memory; fine for one server).
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 10;
const fails = new Map<string, { count: number; since: number }>();

export function assertNotLockedOut(email: string) {
  const f = fails.get(email);
  if (f && Date.now() - f.since < WINDOW_MS && f.count >= MAX_FAILS) {
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong passwords. Try again in 15 minutes.');
  }
}

export function recordLogin(email: string, ok: boolean) {
  if (ok) return void fails.delete(email);
  const f = fails.get(email);
  if (!f || Date.now() - f.since >= WINDOW_MS) fails.set(email, { count: 1, since: Date.now() });
  else f.count++;
}
