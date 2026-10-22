import { networkInterfaces } from 'node:os';
import { config } from './config.js';
import { createApp } from './app.js';
import { checkGemini } from './ai/gemini.js';
import { recoverStuckMeals } from './services/meals.js';
import { startNudgeJob } from './services/nudges.js';
import { createStore } from './store/index.js';

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
}

const store = await createStore();
await recoverStuckMeals(store);
const app = createApp(store);
const stopNudges = config.NUDGES_ENABLED ? startNudgeJob(store) : () => {};

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log('\n  Hisaab API ready');
  console.log(`  AI: ${config.aiMode === 'gemini' ? `Gemini (${config.GEMINI_MODEL}), checking key…` : 'DEMO MODE: no GEMINI_API_KEY, photo results are samples'}`);
  if (config.aiMode === 'gemini') {
    const keys = [config.GEMINI_API_KEY, config.GEMINI_API_KEY_2].filter(Boolean).length;
    console.log(`  Photos: Gemini on ${keys} key${keys > 1 ? 's' : ''}. Text: ${config.GROQ_API_KEY ? `Groq first (${config.GROQ_MODELS.split(',')[0]}), then Gemini` : 'Gemini'}`);
  }
  console.log(`  DB: ${store.kind === 'mongo' ? 'MongoDB' : 'JSON file (data/db.json)'}`);
  console.log(`  Local:   http://localhost:${config.PORT}/api/health`);
  for (const ip of lanAddresses()) console.log(`  Phone:   EXPO_PUBLIC_API_URL=http://${ip}:${config.PORT}`);
  console.log('');
  if (config.aiMode === 'gemini') {
    void checkGemini().then((s) =>
      console.log(
        s.state === 'ok'
          ? `  AI check: OK. ${s.model} is answering.
`
          : s.state === 'limited'
            ? `  AI check: Gemini is out of quota or busy right now (${s.error.slice(0, 120)}).
` +
              `  Photos may fail until it's back; text still works through Groq.
`
            : s.state === 'error'
              ? `  AI check FAILED (${s.model}): ${s.error}
` +
                `  Meal photos will fail until this is fixed. Check GEMINI_API_KEY / GEMINI_MODEL in server/.env
`
              : '',
      ),
    );
  }
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} — shutting down`);
  stopNudges();
  server.close();
  await store.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
