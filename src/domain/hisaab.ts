import type { Goal, Meal, MealType, Targets, WaterLog, Workout } from '../store/types.js';
import { KCAL_PER_KG, MEAL_SHARE } from './nutrition.js';

/**
 * THE HISAAB LEDGER
 * ─────────────────
 *  Budget   = daily calorie target
 *  Eaten    = calories eaten
 *  Bonus    = calories burned in workouts
 *  Balance  = budget − eaten + bonus   ("Calories left")
 *
 *  Goal lose / maintain → positive balance = PROFIT, negative = LOSS
 *  Goal gain            → the scoreboard flips: eating past the budget is profit
 */

export type PnlStatus = 'PROFIT' | 'LOSS' | 'BREAK_EVEN';

export interface Pnl {
  /** kcal, signed: + profit, − loss */
  amount: number;
  status: PnlStatus;
  /** "IN PROFIT (+320 kcal)" */
  label: string;
  /** Approximate body-fat equivalent of `amount`, kg. */
  kgEquivalent: number;
}

export interface MacroLine {
  target: number;
  eaten: number;
  left: number;
  /** 0..1+ for progress rings */
  progress: number;
}

export interface DaySummary {
  date: string;
  goal: Goal;
  budget: number;
  eaten: number;
  burned: number;
  net: number;
  caloriesLeft: number;
  pnl: Pnl;
  macros: { protein: MacroLine; carbs: MacroLine; fat: MacroLine };
  water: { targetMl: number; ml: number; progress: number };
  counts: { meals: number; pendingMeals: number; workouts: number };
}

const BREAK_EVEN_BAND = 25; // kcal either side counts as break-even

export function pnlFrom(amount: number): Pnl {
  const a = Math.round(amount);
  const status: PnlStatus = Math.abs(a) <= BREAK_EVEN_BAND ? 'BREAK_EVEN' : a > 0 ? 'PROFIT' : 'LOSS';
  const label =
    status === 'BREAK_EVEN'
      ? 'BREAK EVEN (±0 kcal)'
      : status === 'PROFIT'
        ? `IN PROFIT (+${a} kcal)`
        : `IN LOSS (${a} kcal)`;
  return { amount: a, status, label, kgEquivalent: Math.round((a / KCAL_PER_KG) * 1000) / 1000 };
}

/**
 * The status in words, for the AI. For a GAIN goal, under budget is food still to eat, never a
 * "loss" (that framing demotivates someone who simply hasn't eaten enough yet).
 */
export function statusInWords(pnl: Pnl, goal: Goal): string {
  const n = Math.abs(pnl.amount);
  if (pnl.status === 'BREAK_EVEN') return 'Right on budget';
  if (pnl.status === 'PROFIT') return goal === 'gain' ? `Budget reached, ${n} kcal above it (profit)` : `In profit: ${n} kcal under budget`;
  return goal === 'gain' ? `Needs ${n} kcal more to reach the budget (not a loss: food still to eat)` : `In loss: ${n} kcal over budget`;
}

const line = (target: number, eaten: number): MacroLine => ({
  target,
  eaten: Math.round(eaten),
  left: Math.round(target - eaten),
  progress: target > 0 ? Math.round((eaten / target) * 100) / 100 : 0,
});

export function summarizeDay(input: {
  date: string;
  goal: Goal;
  targets: Targets;
  meals: Meal[];
  workouts: Workout[];
  water: WaterLog[];
}): DaySummary {
  const { targets, goal } = input;
  const done = input.meals.filter((m) => m.status === 'done');
  const sum = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') => done.reduce((s, m) => s + (m[k] || 0), 0);

  const eaten = Math.round(sum('calories'));
  const burned = Math.round(input.workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0));
  const net = eaten - burned;
  const caloriesLeft = targets.calories - net;
  const ml = input.water.reduce((s, w) => s + w.ml, 0);

  return {
    date: input.date,
    goal,
    budget: targets.calories,
    eaten,
    burned,
    net,
    caloriesLeft,
    pnl: pnlFrom(goal === 'gain' ? -caloriesLeft : caloriesLeft),
    macros: {
      protein: line(targets.proteinG, sum('proteinG')),
      carbs: line(targets.carbsG, sum('carbsG')),
      fat: line(targets.fatG, sum('fatG')),
    },
    water: { targetMl: targets.waterMl, ml, progress: Math.round((ml / targets.waterMl) * 100) / 100 },
    counts: {
      meals: done.length,
      pendingMeals: input.meals.filter((m) => m.status === 'analyzing').length,
      workouts: input.workouts.length,
    },
  };
}

/** Per-meal P&L tag: how this meal compares to its fair share of the day's budget. */
export function mealImpact(meal: Pick<Meal, 'calories' | 'mealType' | 'status'>, budget: number, goal: Goal): Pnl | null {
  if (meal.status !== 'done') return null;
  const share = budget * MEAL_SHARE[meal.mealType as MealType];
  const diff = share - meal.calories;
  return pnlFrom(goal === 'gain' ? -diff : diff);
}

/** What-if: how would eating `kcal` more change today's P&L? (used by the coach) */
export function whatIf(day: DaySummary, kcal: number): { before: Pnl; after: Pnl } {
  const after = day.caloriesLeft - kcal;
  return { before: day.pnl, after: pnlFrom(day.goal === 'gain' ? -after : after) };
}

export interface LedgerRange {
  from: string;
  to: string;
  days: Array<Pick<DaySummary, 'date' | 'budget' | 'eaten' | 'burned' | 'net' | 'pnl'> & { logged: boolean }>;
  totals: { eaten: number; burned: number; pnl: Pnl; loggedDays: number; profitDays: number; lossDays: number };
}

/** Multi-day ledger. Days with nothing logged are shown but excluded from the P&L total. */
export function summarizeRange(from: string, to: string, days: DaySummary[]): LedgerRange {
  const rows = days.map((d) => ({
    date: d.date,
    budget: d.budget,
    eaten: d.eaten,
    burned: d.burned,
    net: d.net,
    pnl: d.pnl,
    logged: d.counts.meals > 0,
  }));
  const logged = rows.filter((r) => r.logged);
  return {
    from,
    to,
    days: rows,
    totals: {
      eaten: logged.reduce((s, r) => s + r.eaten, 0),
      burned: rows.reduce((s, r) => s + r.burned, 0),
      pnl: pnlFrom(logged.reduce((s, r) => s + r.pnl.amount, 0)),
      loggedDays: logged.length,
      profitDays: logged.filter((r) => r.pnl.status === 'PROFIT').length,
      lossDays: logged.filter((r) => r.pnl.status === 'LOSS').length,
    },
  };
}

/** Consecutive days (ending today, or yesterday if today is still empty) with at least one meal. */
export function streak(loggedDates: Set<string>, today: string, addDays: (k: string, n: number) => string): number {
  let cursor = loggedDates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (loggedDates.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
