/**
 * Runs a real photo through the production meal-analysis prompt with a given model.
 *   npx tsx scripts/ai-photo-check.ts <photo.jpg> [model]
 */
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const [photo, model] = process.argv.slice(2);
if (!photo) throw new Error('usage: ai-photo-check.ts <photo.jpg> [model]');
if (model) process.env.GEMINI_MODEL = model;

// Import after env is set: config reads process.env at import time.
const { analyzeMeal } = await import('../src/ai/mealAnalyzer.js');
const { config } = await import('../src/config.js');

const t = Date.now();
try {
  const { analysis: a, usage } = await analyzeMeal({
    image: { data: readFileSync(photo), mimeType: 'image/jpeg' },
    ledgerContext: 'Meal slot: lunch. Goal: lose. Daily budget 1860 kcal, balance before this meal 1860 kcal (IN PROFIT (+1860 kcal)).',
  });
  console.log(`[${config.GEMINI_MODEL}] ${Date.now() - t} ms, ${usage.inputTokens} in / ${usage.outputTokens} out tokens, $${usage.costUsd}`);
  console.log(`  ${a.dishName}: ${a.calories} kcal  P${a.proteinG} C${a.carbsG} F${a.fatG}  health ${a.healthScore}/10  confidence ${a.confidence}`);
  for (const i of a.ingredients) {
    console.log(`    - ${i.name}: ${i.quantity}, ${i.grams ?? '?'} g → ${i.calories} kcal (P${i.proteinG ?? '?'} C${i.carbsG ?? '?'} F${i.fatG ?? '?'})`);
  }
  console.log(`  verdict: "${a.verdict}"`);
} catch (err) {
  console.log(`[${config.GEMINI_MODEL}] FAILED after ${Date.now() - t} ms: ${String((err as Error).message).slice(0, 300)}`);
  process.exitCode = 1;
}
