import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeMeal, estimateItems, type AnalyzeInput } from '../ai/mealAnalyzer.js';
import { quantityLabel, scaleIngredient, sumIngredients } from '../domain/mealMath.js';
import { ApiError, badRequest } from '../lib/errors.js';
import { mealTypeForHour } from '../domain/nutrition.js';
import { localTime } from '../lib/dates.js';
import { newId } from '../lib/ids.js';
import type { Meal, MealSource, MealType, Store, User } from '../store/types.js';
import { UPLOAD_DIR } from './images.js';
import { loadDay, todayFor } from './ledger.js';
import { recordUse } from './usage.js';
import { config } from '../config.js';

export function inferMealType(user: User): MealType {
  return mealTypeForHour(localTime(new Date(), user.timezone).hour);
}

export function blankMeal(user: User, fields: { date: string; mealType: MealType; source: MealSource; imageUrl?: string | null; description?: string | null }): Meal {
  return {
    id: newId(),
    userId: user.id,
    date: fields.date,
    loggedAt: new Date().toISOString(),
    mealType: fields.mealType,
    source: fields.source,
    status: 'analyzing',
    imageUrl: fields.imageUrl ?? null,
    description: fields.description ?? null,
    dishName: fields.description?.slice(0, 60) || 'Analyzing…',
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    healthScore: 0,
    ingredients: [],
    verdict: '',
    confidence: 0,
    error: null,
    servings: 1,
    clarify: null,
    corrections: 0,
    edited: false,
  };
}

/**
 * Runs the AI on a meal row and writes the result back.
 * The scan was already counted; if the AI fails we refund it so the user isn't charged for our error.
 */
export async function processMeal(store: Store, user: User, meal: Meal, image?: AnalyzeInput['image']): Promise<Meal> {
  try {
    const { summary } = await loadDay(store, user, meal.date);
    const ledgerContext =
      `Meal slot: ${meal.mealType}. Goal: ${summary.goal}. Daily budget ${summary.budget} kcal, ` +
      `balance before this meal ${summary.caloriesLeft} kcal (${summary.pnl.label}).`;
    const { analysis, usage } = await analyzeMeal({ image, description: meal.description ?? undefined, ledgerContext });
    await recordUse(store, user.id, todayFor(user), null, usage);
    return (await store.meals.update(meal.id, { ...analysis, status: 'done', error: null }))!;
  } catch (err) {
    console.error(`[meal ${meal.id}] analysis failed:`, (err as Error).message);
    await store.incUsage(user.id, todayFor(user), { scans: -1 });
    return (await store.meals.update(meal.id, {
      status: 'failed',
      error: 'Couldn’t read this meal. Retry, or describe it instead.',
    }))!;
  }
}

export const MAX_CORRECTIONS = 3;

/**
 * "Wrong?": redo the analysis using the stored photo plus what the user says it really is.
 * Doesn't use a free scan (it fixes our mistake), but the AI tokens are still billed.
 * On AI failure the meal is left exactly as it was.
 */
export async function correctMeal(
  store: Store,
  user: User,
  meal: Meal,
  input: { name?: string; quantity?: string; notes?: string },
): Promise<Meal> {
  if (config.LIMITS_ENABLED && (meal.corrections ?? 0) >= MAX_CORRECTIONS) {
    throw badRequest(`You can recalculate a meal ${MAX_CORRECTIONS} times. Use Edit numbers to change it yourself.`);
  }
  const lines = [
    'USER CORRECTION (the earlier result was wrong; trust this over the photo):',
    input.name ? `It is: ${input.name}` : '',
    input.quantity ? `Amount: ${input.quantity}` : '',
    input.notes ? `Notes: ${input.notes}` : '',
    meal.description ? `Original description: ${meal.description}` : '',
  ].filter(Boolean);

  const image = await loadStoredImage(meal.imageUrl);
  const { summary } = await loadDay(store, user, meal.date);
  const balanceBefore = summary.caloriesLeft + (meal.status === 'done' ? meal.calories : 0);
  let result;
  try {
    result = await analyzeMeal({
      image,
      description: lines.join('\n'),
      ledgerContext:
        `Meal slot: ${meal.mealType}. Goal: ${summary.goal}. Daily budget ${summary.budget} kcal, balance before this meal ${balanceBefore} kcal.` +
        (summary.goal === 'gain' ? ' Gain goal: being under budget means they still need to eat more, never call it a loss.' : ''),
    });
  } catch (err) {
    console.error(`[meal ${meal.id}] correction failed:`, (err as Error).message);
    throw new ApiError(502, 'AI_UNAVAILABLE', 'Couldn’t recalculate right now. Your meal wasn’t changed. Try again in a minute.');
  }
  await recordUse(store, user.id, todayFor(user), null, result.usage);
  const { analysis } = result;
  return (await store.meals.update(meal.id, {
    ...analysis,
    // The user just told us the amount, so don't ask them to count again.
    clarify: input.quantity ? null : analysis.clarify,
    servings: 1,
    status: 'done',
    error: null,
    edited: true,
    corrections: (meal.corrections ?? 0) + 1,
  }))!;
}

export interface ItemEdit {
  /** Index of the original ingredient this row came from; absent for a new item. */
  ref?: number;
  name: string;
  /** Weight as served. Omit to keep an existing item's amount. */
  grams?: number;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Edit mode: the user edits ITEMS, never totals. Totals are always the sum of the items.
 *  - existing item, same name, new grams → scaled exactly by its own per-gram values (no AI)
 *  - existing item, same name, no grams change → kept as is
 *  - new or renamed item → AI estimates just that item at the given weight (one batched call)
 *  - rows not sent → removed
 */
export async function editMealItems(
  store: Store,
  user: User,
  meal: Meal,
  input: { items: ItemEdit[]; dishName?: string; mealType?: MealType },
): Promise<Meal> {
  const out: (Meal['ingredients'][number] | null)[] = [];
  const unknown: { slot: number; name: string; grams?: number }[] = [];

  for (const row of input.items) {
    const orig = row.ref !== undefined ? meal.ingredients[row.ref] : undefined;
    if (orig && sameName(orig.name, row.name)) {
      if (row.grams === undefined || row.grams === orig.grams) {
        out.push(orig);
      } else if (orig.grams) {
        const scaled = { ...scaleIngredient(orig, row.grams / orig.grams), grams: row.grams };
        out.push({ ...scaled, quantity: quantityLabel(scaled) });
      } else {
        // We never knew this item's weight, so a weight can't scale it — estimate it fresh.
        unknown.push({ slot: out.length, name: row.name.trim(), grams: row.grams });
        out.push(null);
      }
    } else {
      unknown.push({ slot: out.length, name: row.name.trim(), grams: row.grams ?? orig?.grams });
      out.push(null);
    }
  }

  if (unknown.length) {
    let estimated;
    try {
      estimated = await estimateItems(unknown.map(({ name, grams }) => ({ name, grams })));
    } catch (err) {
      console.error(`[meal ${meal.id}] item estimate failed:`, (err as Error).message);
      throw new ApiError(502, 'AI_UNAVAILABLE', 'Couldn’t calculate the new items right now. Nothing was changed. Try again in a minute.');
    }
    await recordUse(store, user.id, todayFor(user), null, estimated.usage);
    unknown.forEach((u, i) => (out[u.slot] = estimated.ingredients[i]));
  }

  const ingredients = out.filter((x): x is Meal['ingredients'][number] => x !== null);
  return (await store.meals.update(meal.id, {
    ingredients,
    ...sumIngredients(ingredients),
    ...(input.dishName ? { dishName: input.dishName } : {}),
    ...(input.mealType ? { mealType: input.mealType } : {}),
    clarify: null,
    status: 'done',
    error: null,
    edited: true,
  }))!;
}

export async function loadStoredImage(imageUrl: string | null): Promise<AnalyzeInput['image']> {
  if (!imageUrl?.startsWith('/uploads/')) return undefined;
  const ext = imageUrl.split('.').pop() ?? 'jpg';
  const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  try {
    return { data: await readFile(join(UPLOAD_DIR, imageUrl.slice('/uploads/'.length))), mimeType };
  } catch {
    return undefined;
  }
}

/** On boot: anything still "analyzing" from a previous process will never finish — mark it failed. */
export async function recoverStuckMeals(store: Store) {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const stuck = await store.meals.find({ status: 'analyzing', loggedAt: { $lte: cutoff } });
  for (const m of stuck) {
    await store.meals.update(m.id, { status: 'failed', error: 'Analysis was interrupted. Tap Retry.' });
  }
  if (stuck.length) console.log(`[meals] marked ${stuck.length} stuck meal(s) as failed`);
}
