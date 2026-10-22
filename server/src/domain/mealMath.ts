import type { Clarify, Ingredient } from '../store/types.js';

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Totals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export function sumIngredients(items: Ingredient[]): Totals {
  const sum = (k: keyof Totals) => items.reduce((t, i) => t + ((i[k] as number | undefined) ?? 0), 0);
  return {
    calories: Math.round(sum('calories')),
    proteinG: r1(sum('proteinG')),
    carbsG: r1(sum('carbsG')),
    fatG: r1(sum('fatG')),
    fiberG: r1(sum('fiberG')),
  };
}

/** Scale one item (weight, calories, macros, piece count) by factor f. */
export function scaleIngredient(i: Ingredient, f: number): Ingredient {
  const out: Ingredient = { ...i, calories: Math.round(i.calories * f) };
  for (const k of ['proteinG', 'carbsG', 'fatG', 'fiberG'] as const) {
    if (i[k] !== undefined) out[k] = r1(i[k]! * f);
  }
  if (i.grams !== undefined) out.grams = Math.round(i.grams * f);
  if (i.pieces) out.pieces = Math.max(1, Math.round(i.pieces * f));
  return out;
}

export function pluralize(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (!u) return 'pieces';
  if (/(s|sh|ch|x)$/.test(u)) return `${u}es`;
  if (/[^aeiou]y$/.test(u)) return `${u.slice(0, -1)}ies`;
  return `${u}s`;
}

/** "3 skewers" for countable items, otherwise "150 g". */
export function quantityLabel(i: Ingredient): string {
  if (i.pieces && i.pieceUnit) return `${i.pieces} ${i.pieces === 1 ? i.pieceUnit : pluralize(i.pieceUnit)}`;
  return i.grams ? `${i.grams} g` : i.quantity;
}

/** The one-line question for a countable item, with tap-to-answer options around the guess. */
export function clarifyFor(i: Ingredient, ingredientIndex: number): Clarify | null {
  if (!i.pieces || i.pieces < 1) return null;
  const unit = (i.pieceUnit || 'piece').trim().toLowerCase();
  const cur = i.pieces;
  const options = [...new Set([cur - 1, cur, cur + 1, cur + 2].filter((n) => n >= 1 && n <= 50))];
  return { ingredientIndex, question: `How many ${pluralize(unit)}?`, unit, current: cur, options };
}

/** A countable item at or above this share of the meal's calories is worth confirming. */
export const MAIN_ITEM_SHARE = 0.35;

/**
 * Pick the count to ask about:
 *  1. the most calorie-heavy item the AI couldn't count reliably (`unsure[i]`), else
 *  2. when `confirmMainCount` (photo with no typed quantities): the heaviest countable item that
 *     is ≥ 35% of the meal — photo counts are guesses, and confirming costs the user one tap.
 */
export function deriveClarify(items: Ingredient[], unsure: boolean[], confirmMainCount = false): Clarify | null {
  const heaviest = (ok: (it: Ingredient, idx: number) => boolean) => {
    let best = -1;
    items.forEach((it, idx) => {
      if (it.pieces && ok(it, idx) && (best < 0 || it.calories > items[best].calories)) best = idx;
    });
    return best;
  };
  let idx = heaviest((_, i) => unsure[i]);
  if (idx < 0 && confirmMainCount) {
    const total = items.reduce((t, i) => t + i.calories, 0);
    idx = heaviest((it) => total > 0 && it.calories / total >= MAIN_ITEM_SHARE);
  }
  return idx < 0 ? null : clarifyFor(items[idx], idx);
}
