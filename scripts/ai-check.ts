/** Direct Gemini check, independent of the server. Never prints the key.  npx tsx scripts/ai-check.ts [model] */
import { existsSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';

if (existsSync('.env')) process.loadEnvFile('.env');
const key = process.env.GEMINI_API_KEY ?? '';
const model = process.argv[2] ?? process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
if (!key) throw new Error('GEMINI_API_KEY missing in server/.env');

const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 30_000 } });
const t = Date.now();
try {
  const res = await ai.models.generateContent({ model, contents: 'Reply with the single word OK.' });
  console.log(`model ${model}: OK in ${Date.now() - t} ms → "${(res.text ?? '').trim().slice(0, 40)}"`);
} catch (err) {
  console.log(`model ${model}: FAILED after ${Date.now() - t} ms → ${String((err as Error).message).slice(0, 400)}`);
  process.exitCode = 1;
}
