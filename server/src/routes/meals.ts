import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { isDateKey } from '../lib/dates.js';
import { parse } from '../middleware/error.js';
import { lookupBarcode } from '../services/barcode.js';
import { assertImage, deleteImage, MAX_IMAGE_BYTES, saveImage } from '../services/images.js';
import { mealView, todayFor } from '../services/ledger.js';
import { blankMeal, correctMeal, editMealItems, inferMealType, loadStoredImage, processMeal } from '../services/meals.js';
import { clarifyFor, pluralize, scaleIngredient } from '../domain/mealMath.js';
import { assertQuota, recordUse } from '../services/usage.js';
import { ZERO_USAGE } from '../ai/gemini.js';
import type { Meal, Store, User } from '../store/types.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

const dateField = z.string().refine(isDateKey, 'Expected YYYY-MM-DD').optional();
const mealTypeField = z.enum(['breakfast', 'lunch', 'snack', 'dinner']).optional();
const num = (max: number) => z.coerce.number().min(0).max(max);

const AnalyzeBody = z.object({
  description: z.string().trim().max(500).optional(),
  mealType: mealTypeField,
  date: dateField,
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

const ManualBody = z.object({
  dishName: z.string().trim().min(1).max(80),
  calories: num(5000),
  proteinG: num(400),
  carbsG: num(800),
  fatG: num(400),
  fiberG: num(150).optional(),
  healthScore: z.number().int().min(1).max(10).optional(),
  mealType: mealTypeField,
  date: dateField,
  source: z.enum(['manual', 'barcode']).default('manual'),
  servings: z.number().min(0.25).max(10).default(1),
});

const PatchBody = z
  .object({
    dishName: z.string().trim().min(1).max(80),
    calories: num(5000),
    proteinG: num(400),
    carbsG: num(800),
    fatG: num(400),
    fiberG: num(150),
    mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
    servings: z.number().min(0.25).max(10),
  })
  .partial();

const ClarifyBody = z.object({
  pieces: z.number().int().min(1).max(50),
  ingredientIndex: z.number().int().min(0).max(30).optional(),
});

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);
const ItemsBody = z.object({
  items: z
    .array(
      z.object({
        ref: z.number().int().min(0).max(50).optional(),
        name: z.string().trim().min(1).max(60),
        grams: z.number().min(1).max(3000).optional(),
      }),
    )
    .min(1, 'Keep at least one item')
    .max(25),
  dishName: z.string().trim().min(1).max(80).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']).optional(),
});

const CorrectBody = z.object({ name: optText(80), quantity: optText(80), notes: optText(300) });

async function ownMeal(store: Store, user: User, id: string): Promise<Meal> {
  const meal = await store.meals.get(id);
  if (!meal) throw notFound('Meal');
  if (meal.userId !== user.id) throw forbidden();
  return meal;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function mealRoutes(store: Store) {
  const r = Router();

  /**
   * The 2-second loop. Accepts multipart (field "image") or JSON (imageBase64), and/or a text description.
   * Default: returns 202 immediately with an "analyzing" meal; the AI finishes in the background.
   * ?wait=true blocks until the analysis is done (used for Describe → Review sheet).
   */
  r.post('/meals/analyze', upload.single('image'), async (req, res) => {
    const body = parse(AnalyzeBody, req.body ?? {});
    const user = req.user;

    let image: { data: Buffer; mimeType: string } | undefined;
    if (req.file) {
      image = { data: req.file.buffer, mimeType: req.file.mimetype };
    } else if (body.imageBase64) {
      const b64 = body.imageBase64.replace(/^data:(image\/[\w+.-]+);base64,/, (_m, mt) => {
        body.mimeType ??= mt;
        return '';
      });
      image = { data: Buffer.from(b64, 'base64'), mimeType: body.mimeType ?? 'image/jpeg' };
    }
    if (!image && !body.description) throw badRequest('Send an image or a description');
    if (image) assertImage(image.mimeType, image.data.length);

    const date = body.date ?? todayFor(user);
    await assertQuota(store, user, todayFor(user), 'scans');

    const imageUrl = image ? await saveImage(image.data, image.mimeType) : null;
    const meal = await store.meals.create(
      blankMeal(user, {
        date,
        mealType: body.mealType ?? inferMealType(user),
        source: image ? 'photo' : 'text',
        imageUrl,
        description: body.description ?? null,
      }),
    );
    await recordUse(store, user.id, todayFor(user), 'scans', ZERO_USAGE);

    if (req.query.wait === 'true') {
      const done = await processMeal(store, user, meal, image);
      res.status(200).json({ meal: mealView(done, user) });
      return;
    }
    void processMeal(store, user, meal, image);
    res.status(202).json({ meal: mealView(meal, user) });
  });

  /** Manual entry and barcode products (no AI cost, no quota). */
  r.post('/meals', async (req, res) => {
    const b = parse(ManualBody, req.body);
    const user = req.user;
    const s = b.servings;
    const meal = await store.meals.create({
      ...blankMeal(user, { date: b.date ?? todayFor(user), mealType: b.mealType ?? inferMealType(user), source: b.source }),
      status: 'done',
      dishName: b.dishName,
      calories: Math.round(b.calories * s),
      proteinG: r1(b.proteinG * s),
      carbsG: r1(b.carbsG * s),
      fatG: r1(b.fatG * s),
      fiberG: r1((b.fiberG ?? 0) * s),
      healthScore: b.healthScore ?? 5,
      confidence: 1,
      servings: s,
      // One item with the exact numbers, so the item editor works for every meal.
      ingredients: [
        {
          name: b.dishName,
          quantity: s === 1 ? '1 serving' : `${s} servings`,
          calories: Math.round(b.calories * s),
          proteinG: r1(b.proteinG * s),
          carbsG: r1(b.carbsG * s),
          fatG: r1(b.fatG * s),
          fiberG: r1((b.fiberG ?? 0) * s),
        },
      ],
      verdict: b.source === 'barcode' ? 'Numbers taken straight from the package label.' : 'Logged manually.',
    });
    res.status(201).json({ meal: mealView(meal, user) });
  });

  r.get('/meals/:id', async (req, res) => {
    res.json({ meal: mealView(await ownMeal(store, req.user, req.params.id), req.user) });
  });

  /** "Fix Results". `servings` rescales every number; explicit numbers in the same call win. */
  r.patch('/meals/:id', async (req, res) => {
    const meal = await ownMeal(store, req.user, req.params.id);
    if (meal.status === 'analyzing') throw badRequest('Meal is still being analyzed');
    const p = parse(PatchBody, req.body);

    const patch: Partial<Meal> = { edited: true };
    if (p.servings !== undefined && p.servings !== meal.servings) {
      const f = p.servings / (meal.servings || 1);
      Object.assign(patch, {
        servings: p.servings,
        calories: Math.round(meal.calories * f),
        proteinG: r1(meal.proteinG * f),
        carbsG: r1(meal.carbsG * f),
        fatG: r1(meal.fatG * f),
        fiberG: r1(meal.fiberG * f),
        ingredients: meal.ingredients.map((i) => scaleIngredient(i, f)),
      });
      if (meal.clarify) {
        const ing = (patch.ingredients as Meal['ingredients'])[meal.clarify.ingredientIndex];
        patch.clarify = ing ? clarifyFor(ing, meal.clarify.ingredientIndex) : null;
      }
    }
    const { servings: _s, ...explicit } = p;
    Object.assign(patch, explicit);
    if (patch.calories !== undefined) patch.calories = Math.round(patch.calories);
    // Typed numbers make the "How many …?" question moot.
    if (explicit.calories !== undefined) patch.clarify = null;
    if (meal.status === 'failed' && patch.calories !== undefined) Object.assign(patch, { status: 'done', error: null });

    const updated = await store.meals.update(meal.id, patch);
    res.json({ meal: mealView(updated!, req.user) });
  });

  /**
   * Answer to "How many skewers?" — instant, no AI call, no scan used.
   * Scales that one item and moves the totals by exactly its change (works even after manual edits).
   */
  r.post('/meals/:id/clarify', async (req, res) => {
    const meal = await ownMeal(store, req.user, req.params.id);
    if (meal.status !== 'done') throw badRequest('Meal isn’t ready yet');
    const b = parse(ClarifyBody, req.body);
    const index = b.ingredientIndex ?? meal.clarify?.ingredientIndex;
    const ing = index !== undefined ? meal.ingredients[index] : undefined;
    if (index === undefined || !ing?.pieces) throw badRequest('Nothing to count on this meal');

    const unit = ing.pieceUnit || 'piece';
    const scaled = { ...scaleIngredient(ing, b.pieces / ing.pieces), pieces: b.pieces };
    scaled.quantity = `${b.pieces} ${b.pieces === 1 ? unit : pluralize(unit)}`;
    const delta = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG') => (scaled[k] ?? 0) - (ing[k] ?? 0);

    const updated = await store.meals.update(meal.id, {
      ingredients: meal.ingredients.map((x, i) => (i === index ? scaled : x)),
      calories: Math.max(0, Math.round(meal.calories + delta('calories'))),
      proteinG: Math.max(0, r1(meal.proteinG + delta('proteinG'))),
      carbsG: Math.max(0, r1(meal.carbsG + delta('carbsG'))),
      fatG: Math.max(0, r1(meal.fatG + delta('fatG'))),
      fiberG: Math.max(0, r1(meal.fiberG + delta('fiberG'))),
      clarify: null,
      edited: true,
    });
    res.json({ meal: mealView(updated!, req.user) });
  });

  /**
   * Edit mode: replace the item list. Totals are recomputed from the items (never typed).
   * Body: { items: [{ ref?, name, grams? }], dishName?, mealType? }
   */
  r.put('/meals/:id/ingredients', async (req, res) => {
    const meal = await ownMeal(store, req.user, req.params.id);
    if (meal.status === 'analyzing') throw badRequest('Meal is still being analyzed');
    const b = parse(ItemsBody, req.body);
    for (const row of b.items) {
      if (row.ref !== undefined && !meal.ingredients[row.ref]) throw badRequest(`Unknown item ${row.ref}`);
    }
    const updated = await editMealItems(store, req.user, meal, b);
    res.json({ meal: mealView(updated, req.user) });
  });

  /** "Wrong?" — the AI redoes the meal using the photo + what the user says it is. */
  r.post('/meals/:id/correct', async (req, res) => {
    const meal = await ownMeal(store, req.user, req.params.id);
    if (meal.status === 'analyzing') throw badRequest('Meal is still being analyzed');
    const b = parse(CorrectBody, req.body);
    if (!b.name && !b.quantity && !b.notes) throw badRequest('Tell us what it is, how much, or what’s wrong');
    const updated = await correctMeal(store, req.user, meal, b);
    res.json({ meal: mealView(updated, req.user) });
  });

  /** Re-run AI on a failed meal (uses the stored photo / description). Counts as a scan. */
  r.post('/meals/:id/retry', async (req, res) => {
    const meal = await ownMeal(store, req.user, req.params.id);
    if (meal.status !== 'failed') throw badRequest('Only failed meals can be retried');
    const image = await loadStoredImage(meal.imageUrl);
    if (!image && !meal.description) throw badRequest('Original photo is gone — describe the meal instead');
    await assertQuota(store, req.user, todayFor(req.user), 'scans');
    await recordUse(store, req.user.id, todayFor(req.user), 'scans', ZERO_USAGE);
    const pending = (await store.meals.update(meal.id, { status: 'analyzing', error: null }))!;
    if (req.query.wait === 'true') {
      res.json({ meal: mealView(await processMeal(store, req.user, pending, image), req.user) });
      return;
    }
    void processMeal(store, req.user, pending, image);
    res.status(202).json({ meal: mealView(pending, req.user) });
  });

  r.delete('/meals/:id', async (req, res) => {
    const meal = await ownMeal(store, req.user, req.params.id);
    await store.meals.delete(meal.id);
    await deleteImage(meal.imageUrl);
    res.json({ ok: true });
  });

  r.get('/food/barcode/:code', async (req, res) => {
    const code = req.params.code;
    if (!/^\d{6,14}$/.test(code)) throw badRequest('Barcode must be 6–14 digits');
    let product;
    try {
      product = await lookupBarcode(code);
    } catch (err) {
      console.warn('[barcode]', (err as Error).message);
      throw badRequest('Barcode lookup service unavailable — try a photo instead');
    }
    if (!product) throw notFound('Product');
    res.json({ product });
  });

  return r;
}
