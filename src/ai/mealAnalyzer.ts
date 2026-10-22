import { createHash } from 'node:crypto';
import type { Part } from '@google/genai';
import { FOODS, parseFoodText, type ParsedItem } from '../domain/foodDb.js';
import { deriveClarify, quantityLabel, scaleIngredient, sumIngredients } from '../domain/mealMath.js';
import type { Clarify, Ingredient } from '../store/types.js';
import { geminiEnabled, generate, parseJson, ZERO_USAGE, type AiUsage } from './gemini.js';
import { MEAL_ANALYSIS_SCHEMA, MEAL_ANALYZER_SYSTEM } from './prompts.js';

export interface MealAnalysis {
  dishName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  healthScore: number;
  confidence: number;
  ingredients: Ingredient[];
  verdict: string;
  /** "How many skewers?" — set when a countable item couldn't be counted for sure. */
  clarify: Clarify | null;
}

export interface AnalyzeInput {
  image?: { data: Buffer; mimeType: string };
  description?: string;
  /** e.g. "Balance before this meal: 820 kcal (IN PROFIT). Goal: lose. Meal: lunch." */
  ledgerContext?: string;
}

const clamp = (n: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(n) || 0));
const r1 = (n: number) => Math.round(n * 10) / 10;

function normalize(raw: Record<string, any>, confirmMainCount: boolean): MealAnalysis {
  const rawItems: any[] = (Array.isArray(raw.ingredients) ? raw.ingredients : []).slice(0, 20);
  const items: Ingredient[] = rawItems.map((i) => {
    // The model gives values per 100 g; we do the portion maths (it multiplies by piece count otherwise).
    const grams = Math.round(clamp(i.grams, 0, 3000));
    const f = (grams || 100) / 100;
    const proteinG = r1(clamp(i.proteinPer100g, 0, 100) * f);
    const carbsG = r1(clamp(i.carbsPer100g, 0, 100) * f);
    const fatG = r1(clamp(i.fatPer100g, 0, 100) * f);
    // Trust the macros over a stray calorie figure: 4/4/9 is physics, the model's number isn't.
    const fromMacros = proteinG * 4 + carbsG * 4 + fatG * 9;
    const stated = clamp(i.kcalPer100g, 0, 900) * f;
    const calories = Math.round(fromMacros > 0 && Math.abs(stated - fromMacros) > fromMacros * 0.15 ? fromMacros : stated);
    const pieces = Math.round(clamp(i.pieces, 0, 100));
    return {
      name: String(i.name ?? '').slice(0, 60),
      quantity: String(i.quantity ?? '').slice(0, 40),
      grams,
      calories,
      proteinG,
      carbsG,
      fatG,
      fiberG: r1(clamp(i.fiberPer100g, 0, 100) * f),
      ...(pieces > 0 ? { pieces, pieceUnit: String(i.pieceUnit || 'piece').slice(0, 20).toLowerCase() } : {}),
    };
  });
  const unsure = rawItems.map((i, idx) => Boolean(items[idx].pieces) && i.piecesSure === false);

  return {
    dishName: String(raw.dishName || 'Meal').slice(0, 80),
    // Totals are always the sum of the items, so they can never contradict the ingredient list.
    ...sumIngredients(items),
    healthScore: Math.round(clamp(raw.healthScore, 1, 10)),
    confidence: Math.round(clamp(raw.confidence, 0, 1) * 100) / 100,
    ingredients: items,
    verdict: String(raw.hisaabVerdict || '').slice(0, 160),
    clarify: deriveClarify(items, unsure, confirmMainCount),
  };
}

export async function analyzeMeal(input: AnalyzeInput): Promise<{ analysis: MealAnalysis; usage: AiUsage }> {
  if (!input.image && !input.description?.trim()) throw new Error('Need an image or a description');
  if (!geminiEnabled()) return { analysis: mockAnalyze(input), usage: ZERO_USAGE };

  const parts: Part[] = [];
  if (input.image) parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.data.toString('base64') } });
  const lines = [
    input.description ? `User's description: "${input.description.trim()}"` : 'No description — infer from the photo.',
    input.ledgerContext ? `Ledger context: ${input.ledgerContext}` : '',
  ].filter(Boolean);
  parts.push({ text: lines.join('\n') });

  const { text, usage } = await generate({
    systemInstruction: MEAL_ANALYZER_SYSTEM,
    contents: [{ role: 'user', parts }],
    json: { schema: MEAL_ANALYSIS_SCHEMA },
    temperature: 0.2,
    maxOutputTokens: 2000,
  });
  // Only confirm counts for photos: if the user typed the meal, they already said how many.
  return { analysis: normalize(parseJson(text), Boolean(input.image) && !input.description?.trim()), usage };
}

/**
 * Nutrition for items the user typed in the item editor (new or renamed), at exactly the
 * weights they gave. One AI call for the whole batch; results are matched back by order and
 * rescaled so each item's grams are exactly what the user entered.
 */
export async function estimateItems(
  items: Array<{ name: string; grams?: number }>,
): Promise<{ ingredients: Ingredient[]; usage: AiUsage }> {
  if (!items.length) return { ingredients: [], usage: ZERO_USAGE };
  const raw = geminiEnabled()
    ? await (async () => {
        const list = items.map((it, i) => `${i + 1}. ${it.name}${it.grams ? `, ${it.grams} g` : ''}`).join('\n');
        const { analysis, usage } = await analyzeMeal({
          description:
            'USER CORRECTION: return exactly one ingredient per line below, in the same order, at exactly the given weight ' +
            '(estimate a typical portion if no weight is given). Do not add cooking oil or any other item.\n' + list,
        });
        return { ingredients: analysis.ingredients, usage };
      })()
    : { ingredients: items.map(mockItem), usage: ZERO_USAGE };

  const ingredients = items.map((it, i) => {
    const got = raw.ingredients[i] ?? mockItem(it);
    const base: Ingredient = { ...got, name: it.name };
    // Pin the weight to what the user typed: scale the AI's numbers to it.
    if (it.grams && got.grams && got.grams !== it.grams) {
      const f = it.grams / got.grams;
      return { ...scaleIngredient(base, f), grams: it.grams };
    }
    return it.grams ? { ...base, grams: it.grams } : base;
  });
  return { ingredients: ingredients.map((x) => ({ ...x, quantity: quantityLabel(x) })), usage: raw.usage };
}

/** Offline stand-in: food table value, treating its unit as ~100 g. */
function mockItem(it: { name: string; grams?: number }): Ingredient {
  const food = parseFoodText(it.name)[0]?.food;
  const grams = it.grams ?? 100;
  const f = grams / 100;
  const per = food ?? { kcal: 150, p: 5, c: 18, f: 6, fiber: 2 };
  return {
    name: it.name,
    quantity: `${grams} g`,
    grams,
    calories: Math.round(per.kcal * f),
    proteinG: r1(per.p * f),
    carbsG: r1(per.c * f),
    fatG: r1(per.f * f),
    fiberG: r1(per.fiber * f),
  };
}

// ─── Mock mode ────────────────────────────────────────────

const MOCK_PLATES: Array<Array<[string, number]>> = [
  [['Paneer Bhurji', 1], ['Roti', 2]],
  [['Dal Tadka', 1], ['Steamed Rice', 1], ['Curd', 1]],
  [['Chicken Biryani', 1], ['Curd', 1]],
  [['Masala Dosa', 1], ['Sambar', 1]],
  [['Idli', 3], ['Sambar', 1]],
  [['Poha', 1], ['Masala Chai', 1]],
  [['Rajma Chawal', 1]],
  [['Samosa', 2], ['Masala Chai', 1]],
  [['Tandoori Chicken', 1], ['Mixed Salad', 1]],
  [['Chocolate Cake', 1]],
];

const VERDICTS = {
  good: ['Great pick. This keeps the day in profit.', 'Solid protein, light on oil. Nicely done.', 'Clean plate, clean ledger. Keep it going.'],
  ok: ['A fair deal. Keep dinner on the lighter side.', 'Still in profit. Watch the portions for the rest of the day.', 'Works fine. Portion size is what matters here.'],
  bad: ['Tasty, but heavy on the ledger. A walk will help.', 'Lots of oil here. A short walk pays some of it back.', 'Cheat day? Fine. Aim for profit tomorrow.'],
};

/** "1 piece" / "6 pieces" / "1 egg" / "1 slice" → countable unit; bowls, plates, cups are not. */
function piecesOf(food: ParsedItem['food'], qty: number): Pick<Ingredient, 'pieces' | 'pieceUnit'> {
  const m = food.unit.match(/^(\d+)\s+(piece|pieces|egg|eggs|slice|slices)$/);
  if (!m) return {};
  const unit = /piece/.test(m[2]) ? food.name.toLowerCase() : m[2].replace(/s$/, '');
  return { pieces: Math.max(1, Math.round(Number(m[1]) * qty)), pieceUnit: unit };
}

function fromItems(items: ParsedItem[], seed: number, countsUnsure = false): MealAnalysis {
  const t = items.reduce(
    (a, { food, qty }) => ({
      kcal: a.kcal + food.kcal * qty,
      p: a.p + food.p * qty,
      c: a.c + food.c * qty,
      f: a.f + food.f * qty,
      fiber: a.fiber + food.fiber * qty,
      health: a.health + food.health * food.kcal * qty,
    }),
    { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, health: 0 },
  );
  const healthScore = Math.max(1, Math.min(10, Math.round(t.health / Math.max(1, t.kcal))));
  const pool = healthScore >= 7 ? VERDICTS.good : healthScore >= 5 ? VERDICTS.ok : VERDICTS.bad;
  const ingredients: Ingredient[] = items.map(({ food, qty }) => ({
    name: food.name,
    quantity: qty === 1 ? food.unit : `${qty} × ${food.unit}`,
    calories: Math.round(food.kcal * qty),
    proteinG: r1(food.p * qty),
    carbsG: r1(food.c * qty),
    fatG: r1(food.f * qty),
    fiberG: r1(food.fiber * qty),
    ...piecesOf(food, qty),
  }));
  const name = items
    .map(({ food, qty }) => (qty !== 1 && /piece|egg|slice/.test(food.unit) ? `${qty} ${food.name}s` : food.name))
    .join(' & ');
  return {
    dishName: name,
    calories: Math.round(t.kcal),
    proteinG: r1(t.p),
    carbsG: r1(t.c),
    fatG: r1(t.f),
    fiberG: r1(t.fiber),
    healthScore,
    confidence: 0.6,
    ingredients,
    verdict: pool[seed % pool.length],
    clarify: deriveClarify(ingredients, ingredients.map(() => countsUnsure)),
  };
}

/** Deterministic fake analysis: text is parsed against the food table; photos pick a plate by hash. */
export function mockAnalyze(input: AnalyzeInput): MealAnalysis {
  const seedSrc = input.image?.data ?? Buffer.from(input.description ?? '');
  const seed = createHash('md5').update(seedSrc).digest().readUInt32BE(0);

  if (input.description?.trim()) {
    const items = parseFoodText(input.description);
    if (items.length) return fromItems(items, seed);
    if (!input.image) {
      return {
        ...fromItems([{ food: FOODS.find((f) => f.name === 'Dal Tadka')!, qty: 1 }], seed),
        dishName: input.description.trim().slice(0, 60),
        ingredients: [
          { name: input.description.trim().slice(0, 60), quantity: '1 serving (estimated)', calories: 300, proteinG: 10, carbsG: 40, fatG: 11, fiberG: 3 },
        ],
        clarify: null,
        calories: 300,
        proteinG: 10,
        carbsG: 40,
        fatG: 11,
        confidence: 0.3,
        verdict: 'Couldn’t recognize this dish. Tap Fix Results to adjust the numbers.',
      };
    }
  }
  // A photo with AI switched off: we can't see it, so return a clearly-labelled sample
  // instead of pretending to have recognised the food.
  const plate = MOCK_PLATES[seed % MOCK_PLATES.length];
  const items = plate.map(([name, qty]) => ({ food: FOODS.find((f) => f.name === name)!, qty }));
  const sample = fromItems(items, seed, true);
  return {
    ...sample,
    dishName: `Sample: ${sample.dishName}`,
    confidence: 0,
    verdict: 'Demo mode: AI isn’t connected, so this is sample data, not your photo. Tap Fix Results to enter the real numbers.',
  };
}
