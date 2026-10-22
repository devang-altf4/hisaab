import { addDays, dateKey, dateRange } from '../lib/dates.js';
import { mealImpact, streak, summarizeDay, summarizeRange, type DaySummary, type LedgerRange } from '../domain/hisaab.js';
import type { Goal, Meal, Store, User, WaterLog, Workout } from '../store/types.js';
import { getUsage } from './usage.js';

export const goalOf = (u: User): Goal => u.profile?.goal ?? 'lose';
export const todayFor = (u: User) => dateKey(new Date(), u.timezone);

/** Meal as the API returns it: adds the per-meal P&L tag. */
export function mealView(meal: Meal, user: User) {
  const { userId: _u, ...rest } = meal;
  return {
    ...rest,
    clarify: meal.clarify ?? null,
    corrections: meal.corrections ?? 0,
    hisaab: mealImpact(meal, user.targets.calories, goalOf(user)),
  };
}
export type MealView = ReturnType<typeof mealView>;

export async function loadDay(store: Store, user: User, date: string) {
  const [meals, workouts, water] = await Promise.all([
    store.meals.find({ userId: user.id, date }, { sort: { loggedAt: -1 } }),
    store.workouts.find({ userId: user.id, date }, { sort: { loggedAt: -1 } }),
    store.water.find({ userId: user.id, date }),
  ]);
  const summary = summarizeDay({ date, goal: goalOf(user), targets: user.targets, meals, workouts, water });
  return { summary, meals, workouts, water };
}

export async function userStreak(store: Store, user: User): Promise<number> {
  const today = todayFor(user);
  const meals = await store.meals.find({ userId: user.id, date: { $gte: addDays(today, -120), $lte: today } });
  return streak(new Set(meals.filter((m) => m.status === 'done').map((m) => m.date)), today, addDays);
}

/** Everything the Home screen needs in one round trip. */
export async function dashboard(store: Store, user: User, date: string) {
  const [{ summary, meals, workouts }, streakDays, usage] = await Promise.all([
    loadDay(store, user, date),
    userStreak(store, user),
    getUsage(store, user, todayFor(user)),
  ]);
  return {
    date,
    summary,
    streak: streakDays,
    meals: meals.map((m) => mealView(m, user)),
    workouts: workouts.map(({ userId: _u, ...w }) => w),
    usage,
  };
}

export async function ledger(store: Store, user: User, from: string, to: string): Promise<LedgerRange> {
  const filter = { userId: user.id, date: { $gte: from, $lte: to } };
  const [meals, workouts, water] = await Promise.all([
    store.meals.find(filter),
    store.workouts.find(filter),
    store.water.find(filter),
  ]);
  const by = <T extends { date: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.date, [...(m.get(r.date) ?? []), r]);
    return m;
  };
  const [mb, wb, hb] = [by<Meal>(meals), by<Workout>(workouts), by<WaterLog>(water)];
  const days: DaySummary[] = dateRange(from, to).map((date) =>
    summarizeDay({
      date,
      goal: goalOf(user),
      targets: user.targets,
      meals: mb.get(date) ?? [],
      workouts: wb.get(date) ?? [],
      water: hb.get(date) ?? [],
    }),
  );
  return summarizeRange(from, to, days);
}
