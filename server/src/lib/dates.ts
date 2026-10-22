/**
 * "Day" in Hisaab = a calendar date in the user's timezone (default IST),
 * stored as a YYYY-MM-DD string. Every ledger row is keyed by this.
 */
export const DEFAULT_TZ = 'Asia/Kolkata';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(s: unknown): s is string {
  return typeof s === 'string' && DATE_RE.test(s);
}

/** YYYY-MM-DD for an instant in a timezone. */
export function dateKey(at: Date = new Date(), tz = DEFAULT_TZ): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Hour (0-23) and minute in a timezone. */
export function localTime(at: Date = new Date(), tz = DEFAULT_TZ): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get('hour'), minute: get('minute') };
}

/** Add days to a YYYY-MM-DD key (calendar arithmetic, timezone-free). */
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of date keys from..to. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to && out.length < 400; k = addDays(k, 1)) out.push(k);
  return out;
}
