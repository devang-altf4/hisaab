/** Describe-a-meal check against the real AI.  npx tsx scripts/ai-text-check.ts "2 roti and dal" ["…"] */
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const { analyzeMeal } = await import('../src/ai/mealAnalyzer.js');
for (const description of process.argv.slice(2)) {
  const { analysis: a } = await analyzeMeal({ description });
  console.log(`"${description}" → ${a.calories} kcal P${a.proteinG} C${a.carbsG} F${a.fatG}`);
  for (const i of a.ingredients) console.log(`    - ${i.name}: ${i.quantity}, ${i.grams} g → ${i.calories} kcal`);
}
