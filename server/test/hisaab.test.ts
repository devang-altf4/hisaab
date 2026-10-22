import { describe, expect, it } from 'vitest';
import { mealImpact, pnlFrom, statusInWords, streak, summarizeDay } from '../src/domain/hisaab.js';
import { computeTargets, estimateBurn } from '../src/domain/nutrition.js';
import { parseFoodText } from '../src/domain/foodDb.js';
import { addDays, dateKey } from '../src/lib/dates.js';
import type { Meal, Targets } from '../src/store/types.js';

const targets: Targets = { calories: 2000, proteinG: 120, carbsG: 220, fatG: 60, waterMl: 2500 };
const meal = (kcal: number, extra: Partial<Meal> = {}) =>
  ({ calories: kcal, proteinG: 20, carbsG: 50, fatG: 10, status: 'done', mealType: 'lunch', ...extra }) as Meal;

describe('hisaab ledger', () => {
  it('under budget is profit, workouts add bonus credit', () => {
    const d = summarizeDay({
      date: '2026-10-17', goal: 'lose', targets,
      meals: [meal(600), meal(500)],
      workouts: [{ caloriesBurned: 300 } as any],
      water: [{ ml: 500 } as any],
    });
    expect(d.eaten).toBe(1100);
    expect(d.burned).toBe(300);
    expect(d.caloriesLeft).toBe(1200);
    expect(d.pnl).toMatchObject({ status: 'PROFIT', amount: 1200, label: 'IN PROFIT (+1200 kcal)' });
    expect(d.macros.protein).toMatchObject({ eaten: 40, left: 80 });
    expect(d.water.ml).toBe(500);
  });

  it('over budget is loss; analyzing meals do not count yet', () => {
    const d = summarizeDay({
      date: '2026-10-17', goal: 'lose', targets,
      meals: [meal(2450), meal(900, { status: 'analyzing' })],
      workouts: [], water: [],
    });
    expect(d.pnl).toMatchObject({ status: 'LOSS', amount: -450, label: 'IN LOSS (-450 kcal)' });
    expect(d.counts).toMatchObject({ meals: 1, pendingMeals: 1 });
  });

  it('gain goal flips the scoreboard', () => {
    const d = summarizeDay({ date: 'x', goal: 'gain', targets, meals: [meal(2300)], workouts: [], water: [] });
    expect(d.pnl.status).toBe('PROFIT');
    expect(d.pnl.amount).toBe(300);
  });

  it('break-even band and kg equivalent', () => {
    expect(pnlFrom(10).status).toBe('BREAK_EVEN');
    expect(pnlFrom(-7700).kgEquivalent).toBe(-1);
  });

  it('per-meal impact compares to the meal slot share', () => {
    // lunch share = 35% of 2000 = 700
    expect(mealImpact(meal(500), 2000, 'lose')).toMatchObject({ status: 'PROFIT', amount: 200 });
    expect(mealImpact(meal(1000), 2000, 'lose')).toMatchObject({ status: 'LOSS', amount: -300 });
    expect(mealImpact(meal(1000, { status: 'analyzing' }), 2000, 'lose')).toBeNull();
  });

  it('streak counts back from today, or yesterday if today is empty', () => {
    const today = '2026-10-17';
    expect(streak(new Set(['2026-10-17', '2026-10-16', '2026-10-15', '2026-10-13']), today, addDays)).toBe(3);
    expect(streak(new Set(['2026-10-16', '2026-10-15']), today, addDays)).toBe(2);
    expect(streak(new Set(['2026-10-14']), today, addDays)).toBe(0);
  });
});

describe('nutrition', () => {
  it('computes sensible targets', () => {
    const t = computeTargets({ sex: 'male', age: 28, heightCm: 175, weightKg: 80, activityLevel: 'light', goal: 'lose' });
    expect(t.calories).toBe(1920); // BMR 1759 × 1.375 − 500
    expect(t.proteinG).toBe(144);
    expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.calories)).toBeLessThan(15);
  });

  it('never goes below the safety floor', () => {
    const t = computeTargets({ sex: 'female', age: 60, heightCm: 145, weightKg: 42, activityLevel: 'sedentary', goal: 'lose' });
    expect(t.calories).toBe(1200);
  });

  it('estimates workout burn from MET', () => {
    expect(estimateBurn('Running', 30, 70)).toBe(343);
    expect(estimateBurn('Strength Training', 60, 80)).toBe(400);
  });
});

describe('food text parser (mock AI)', () => {
  it('parses Hinglish quantities and multiple items', () => {
    const items = parseFoodText('2 plate idli sambar aur ek filter coffee');
    expect(items.map((i) => [i.food.name, i.qty])).toEqual([
      ['Idli', 2], ['Sambar', 2], ['Filter Coffee', 1],
    ]);
  });
  it('prefers the longest alias', () => {
    expect(parseFoodText('masala dosa')[0].food.name).toBe('Masala Dosa');
    expect(parseFoodText('dal makhani with 3 roti').map((i) => i.food.name)).toEqual(['Dal Makhani', 'Roti']);
  });
});

describe('dates', () => {
  it('uses IST for the day key', () => {
    // 20:00 UTC on the 16th is 01:30 IST on the 17th
    expect(dateKey(new Date('2026-10-16T20:00:00Z'))).toBe('2026-10-17');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('meal math (P1 clarify)', async () => {
  const { clarifyFor, deriveClarify, pluralize, scaleIngredient, sumIngredients } = await import('../src/domain/mealMath.js');
  const tikka = { name: 'Chicken tikka', quantity: '2 skewers', grams: 200, calories: 330, proteinG: 62, carbsG: 0, fatG: 8, fiberG: 0, pieces: 2, pieceUnit: 'skewer' };
  const oil = { name: 'Oil', quantity: '1 tbsp', grams: 14, calories: 124, proteinG: 0, carbsG: 0, fatG: 14, fiberG: 0 };

  it('pluralizes units', () => {
    expect(['skewer', 'idli', 'roti', 'sandwich', 'patty', 'box'].map(pluralize)).toEqual(['skewers', 'idlis', 'rotis', 'sandwiches', 'patties', 'boxes']);
  });
  it('builds the question with options around the guess', () => {
    expect(clarifyFor(tikka, 0)).toEqual({ ingredientIndex: 0, question: 'How many skewers?', unit: 'skewer', current: 2, options: [1, 2, 3, 4] });
    expect(clarifyFor({ ...tikka, pieces: 1 }, 0)?.options).toEqual([1, 2, 3]);
    expect(clarifyFor(oil, 1)).toBeNull();
  });
  it('asks only about unsure counts, heaviest first', () => {
    const roti = { name: 'Roti', quantity: '2', calories: 240, pieces: 2, pieceUnit: 'roti' };
    expect(deriveClarify([roti, tikka, oil], [true, true, false])?.question).toBe('How many skewers?');
    expect(deriveClarify([roti, tikka, oil], [false, false, false])).toBeNull();
  });
  it('scales an item and sums totals', () => {
    const four = scaleIngredient(tikka, 2);
    expect(four).toMatchObject({ grams: 400, calories: 660, proteinG: 124, fatG: 16, pieces: 4 });
    expect(sumIngredients([four, oil])).toEqual({ calories: 784, proteinG: 124, carbsG: 0, fatG: 30, fiberG: 0 });
  });
});

describe('meal math: confirm the main count on photos', async () => {
  const { deriveClarify } = await import('../src/domain/mealMath.js');
  const tikka = { name: 'Chicken tikka', quantity: '3 skewers', calories: 412, pieces: 3, pieceUnit: 'skewer' };
  const veg = { name: 'Peppers', quantity: '60 g', calories: 18 };
  const roti = { name: 'Roti', quantity: '1', calories: 120, pieces: 1, pieceUnit: 'roti' };
  const curry = { name: 'Paneer butter masala', quantity: '1 katori', calories: 450 };
  it('asks about a sure count when it is the main item of a photo', () => {
    expect(deriveClarify([tikka, veg], [false, false], true)?.current).toBe(3);
    expect(deriveClarify([tikka, veg], [false, false], false)).toBeNull();
  });
  it('does not ask about a small countable side', () => {
    expect(deriveClarify([curry, roti], [false, false], true)).toBeNull(); // roti is 21%
  });
});

describe('status in words (what the AI is told)', () => {
  it('a gain goal under budget is food still to eat, never a loss', () => {
    expect(statusInWords(pnlFrom(-2190), 'gain')).toBe('Needs 2190 kcal more to reach the budget (not a loss: food still to eat)');
    expect(statusInWords(pnlFrom(-300), 'lose')).toBe('In loss: 300 kcal over budget');
    expect(statusInWords(pnlFrom(550), 'lose')).toBe('In profit: 550 kcal under budget');
    expect(statusInWords(pnlFrom(0), 'gain')).toBe('Right on budget');
  });
});
