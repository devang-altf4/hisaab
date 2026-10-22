import { randomBytes, randomUUID } from 'node:crypto';

export const newId = () => randomUUID();

/** Short human-friendly code (no 0/O/1/I) e.g. for trainer invites: "HSB-7KQ2MX". */
export function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `HSB-${s}`;
}
