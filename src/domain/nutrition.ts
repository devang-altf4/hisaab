import type { ActivityLevel, MealType, Profile, Targets } from '../store/types.js';

export const DEFAULT_TARGETS: Targets = { calories: 2000, proteinG: 110, carbsG: 230, fatG: 65, waterMl: 2500 };

const ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Mifflin–St Jeor BMR. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY[p.activityLevel];
}

const round = (n: number, step = 1) => Math.round(n / step) * step;

/**
 * Daily "capital" for the Hisaab ledger.
 *  lose     → TDEE − 500 (≈0.45 kg/week), floored at a safe minimum
 *  maintain → TDEE
 *  gain     → TDEE + 300 (lean bulk)
 * Protein 1.6 g/kg (1.8 when cutting), fat 25% of kcal, carbs fill the rest.
 */
export function computeTargets(p: Profile): Targets {
  const maintenance = tdee(p);
  const floor = p.sex === 'male' ? 1500 : 1200;
  const calories =
    p.goal === 'lose' ? Math.max(floor, maintenance - 500) : p.goal === 'gain' ? maintenance + 300 : maintenance;

  const proteinG = p.weightKg * (p.goal === 'lose' ? 1.8 : 1.6);
  const fatG = (calories * 0.25) / 9;
  const carbsG = Math.max(50, (calories - proteinG * 4 - fatG * 9) / 4);

  return {
    calories: round(calories, 10),
    proteinG: round(proteinG),
    carbsG: round(carbsG),
    fatG: round(fatG),
    waterMl: Math.min(4500, Math.max(2000, round(p.weightKg * 35, 250))),
  };
}

// ─── Workouts ─────────────────────────────────────────────

/** MET values (Compendium of Physical Activities, rounded). */
const MET: Record<string, number> = {
  walking: 3.5,
  brisk_walking: 4.5,
  running: 9.8,
  cycling: 7.5,
  strength: 5,
  gym: 5,
  weights: 5,
  yoga: 2.5,
  hiit: 8,
  swimming: 7,
  cricket: 5,
  football: 7,
  badminton: 5.5,
  dance: 5,
  zumba: 6.5,
  skipping: 11,
  sports: 6,
};

export function estimateBurn(type: string, durationMin: number, weightKg = 70): number {
  const key = type.toLowerCase().trim().replace(/[\s-]+/g, '_');
  const met = MET[key] ?? Object.entries(MET).find(([k]) => key.includes(k))?.[1] ?? 4;
  return Math.round(met * weightKg * (durationMin / 60));
}

// ─── Meals ────────────────────────────────────────────────

/** Share of the daily budget each meal "should" take — used for per-meal P&L tags. */
export const MEAL_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

export function mealTypeForHour(hour: number): MealType {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 19) return 'snack';
  return 'dinner';
}

/** 1 kg of body fat ≈ 7700 kcal. */
export const KCAL_PER_KG = 7700;
