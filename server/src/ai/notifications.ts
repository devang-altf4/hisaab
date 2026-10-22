import { createHash } from 'node:crypto';
import { statusInWords, type DaySummary } from '../domain/hisaab.js';
import { geminiEnabled, generate, parseJson, ZERO_USAGE, type AiUsage } from './gemini.js';
import { NOTIFICATIONS_SCHEMA, NOTIFICATIONS_SYSTEM } from './prompts.js';

/**
 * Zomato-style notification engine.
 * The day has 10 slots; users choose how many they want (1–10) and we keep the most important ones.
 * Copy is generated once per user per day (cheap) — or picked from the template bank in mock mode.
 */

export interface Slot {
  id: string;
  hour: number;
  minute: number;
  purpose: string;
  priority: number;
}

export const SLOTS: Slot[] = [
  { id: 'morning_water', hour: 8, minute: 0, purpose: 'drink water after waking up', priority: 8 },
  { id: 'breakfast', hour: 9, minute: 30, purpose: 'log breakfast photo', priority: 2 },
  { id: 'midmorning_water', hour: 11, minute: 15, purpose: 'drink water', priority: 9 },
  { id: 'lunch', hour: 13, minute: 30, purpose: 'log lunch photo', priority: 1 },
  { id: 'lunch_followup', hour: 15, minute: 15, purpose: 'remind if lunch not logged / check balance', priority: 6 },
  { id: 'snack', hour: 17, minute: 0, purpose: 'tea-time snack: log it, pick a snack that keeps the day in profit', priority: 7 },
  { id: 'workout', hour: 18, minute: 30, purpose: 'log a workout to earn bonus credit', priority: 5 },
  { id: 'evening_water', hour: 19, minute: 45, purpose: 'water target check', priority: 10 },
  { id: 'dinner', hour: 21, minute: 0, purpose: 'log dinner photo', priority: 3 },
  { id: 'daily_report', hour: 22, minute: 30, purpose: "check today's final profit/loss and protect the streak", priority: 4 },
];

export function slotsFor(count: number): Slot[] {
  const n = Math.max(1, Math.min(SLOTS.length, Math.round(count)));
  return [...SLOTS].sort((a, b) => a.priority - b.priority).slice(0, n).sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

export interface PushCopy {
  title: string;
  body: string;
}

const BANK: Record<string, PushCopy[]> = {
  morning_water: [
    { title: 'Good morning, {name} ☀️', body: 'First entry of the day: one glass of water.' },
    { title: 'Water first', body: 'You’ve been running dry all night. One glass before chai.' },
  ],
  breakfast: [
    { title: 'Breakfast done? 👀', body: 'Snap it. Two seconds, and your coach does the math.' },
    { title: 'What was breakfast?', body: 'Paratha or poha, we won’t judge. We just need it in the ledger.' },
    { title: 'Morning, {name}', body: 'Log your first meal and start the day’s ledger.' },
  ],
  midmorning_water: [
    { title: 'Water break 💧', body: 'Your body is 60% water. Top up the rest.' },
    { title: 'Hydration check', body: 'Chai doesn’t count as water. One glass, right now.' },
  ],
  lunch: [
    { title: 'Lunch time. Log it?', body: 'Snap your plate before it gets cold. The ledger won’t.' },
    { title: 'Thali’s here? 🍛', body: 'One photo before the first bite, and you’ll know where the day stands.' },
    { title: '{name}, lunch time', body: 'Rajma chawal or a salad, just snap it. We won’t judge. Probably.' },
  ],
  lunch_followup: [
    { title: 'Hiding lunch? 🕵️', body: 'An unlogged samosa still counts. Add it now.' },
    { title: 'Balance check', body: 'You have {left} kcal left. Plan the evening snack smartly.' },
  ],
  snack: [
    { title: 'Chai time ☕', body: 'Chai and biscuits run about 150 kcal. Sprouts chaat keeps you in profit.' },
    { title: 'Evening cravings?', body: 'Pakoras are calling. Check your balance, then log what you pick.' },
  ],
  workout: [
    { title: 'Earn some bonus 💪', body: 'A 30-minute walk adds about 150 kcal to your balance.' },
    { title: 'Shoes on, {name}', body: 'Gym, cricket or dance: log the workout and grow your balance.' },
  ],
  evening_water: [
    { title: 'Water goal?', body: 'The day’s almost over and your bottle is still full.' },
    { title: 'Last call for water 💧', body: 'Two more glasses and today’s water goal is done.' },
  ],
  dinner: [
    { title: 'What’s for dinner?', body: 'Snap it and close out today’s ledger.' },
    { title: 'Dinner check', body: '{left} kcal left. Keep it light and the day ends in profit.' },
    { title: '{name}, dinner ready? 🍽️', body: 'One tap to log it, then enjoy your meal.' },
  ],
  daily_report: [
    { title: 'Today’s P&L is ready 📊', body: 'See if today ended in profit or loss. Don’t break the streak.' },
    { title: 'Closing the books', body: 'Anything left to log? Add it now and start tomorrow fresh.' },
  ],
};

function fill(c: PushCopy, vars: { name: string; left: number }): PushCopy {
  const f = (s: string) => s.replaceAll('{name}', vars.name).replaceAll('{left}', String(Math.max(0, vars.left)));
  return { title: f(c.title), body: f(c.body) };
}

export function pickFromBank(slotId: string, seed: string, vars: { name: string; left: number }): PushCopy {
  const pool = BANK[slotId] ?? BANK.lunch;
  const n = createHash('md5').update(seed + slotId).digest().readUInt32BE(0);
  return fill(pool[n % pool.length], vars);
}

export interface ScheduledNotification extends PushCopy {
  id: string;
  slot: string;
  hour: number;
  minute: number;
}

export async function generateSchedule(opts: {
  userId: string;
  name: string;
  date: string;
  count: number;
  today: DaySummary;
  notLogged: string[];
}): Promise<{ notifications: ScheduledNotification[]; usage: AiUsage }> {
  const slots = slotsFor(opts.count);
  const vars = { name: opts.name || 'Friend', left: opts.today.caloriesLeft };
  const fromBank = (s: Slot): ScheduledNotification => ({
    id: `${opts.date}:${s.id}`,
    slot: s.id,
    hour: s.hour,
    minute: s.minute,
    ...pickFromBank(s.id, opts.userId + opts.date, vars),
  });

  if (!geminiEnabled()) return { notifications: slots.map(fromBank), usage: ZERO_USAGE };

  const prompt = [
    `User name: ${vars.name}. Goal: ${opts.today.goal}. Daily budget: ${opts.today.budget} kcal.`,
    `Yesterday/today status: ${statusInWords(opts.today.pnl, opts.today.goal)}. Not logged yet today: ${opts.notLogged.join(', ') || 'nothing'}.`,
    'Write exactly one notification for each slot below:',
    ...slots.map((s) => `- slot "${s.id}" at ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} — purpose: ${s.purpose}`),
  ].join('\n');

  try {
    const { text, usage } = await generate({
      systemInstruction: NOTIFICATIONS_SYSTEM,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      json: { schema: NOTIFICATIONS_SCHEMA },
      temperature: 1,
      maxOutputTokens: 1500,
    });
    const parsed = parseJson<{ notifications: Array<{ slot: string; title: string; body: string }> }>(text);
    const bySlot = new Map(parsed.notifications.map((n) => [n.slot, n]));
    return {
      usage,
      notifications: slots.map((s) => {
        const n = bySlot.get(s.id);
        return n?.title && n?.body
          ? { id: `${opts.date}:${s.id}`, slot: s.id, hour: s.hour, minute: s.minute, title: n.title.slice(0, 60), body: n.body.slice(0, 160) }
          : fromBank(s);
      }),
    };
  } catch (err) {
    console.warn('[notifications] AI generation failed, using bank:', (err as Error).message);
    return { notifications: slots.map(fromBank), usage: ZERO_USAGE };
  }
}
