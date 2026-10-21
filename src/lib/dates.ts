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

export function parseLocalDate(key: string): Date {
  const parts = key.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

export function addDays(key: string, delta: number): string {
  const d = parseLocalDate(key);
  d.setDate(d.getDate() + delta);
  return localDateKey(d);
}

export function isToday(key: string): boolean {
  return key === localDateKey();
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatHeaderDate(key: string): string {
  const todayKey = localDateKey();
  if (key === todayKey) return 'Today';
  const yesterdayKey = daysAgoKey(1);
  if (key === yesterdayKey) return 'Yesterday';

  const d = parseLocalDate(key);
  const dayName = DAYS_SHORT[d.getDay()];
  const dayNum = d.getDate();
  const monthName = MONTHS_SHORT[d.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}
