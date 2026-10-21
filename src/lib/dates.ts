/**
 * Date keys (YYYY-MM-DD) in the phone's local time — matches the server's IST "day".
 * Never use toISOString() for this: it's UTC, so 00:00–05:30 IST lands on the wrong day.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateKey(d);
}
