import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Fully offline: memory store + mock AI, regardless of the developer's .env
    env: { NODE_ENV: 'test', GEMINI_API_KEY: '', GEMINI_API_KEY_2: '', GROQ_API_KEY: '', MONGODB_URI: '', ALLOW_MOCK_UPGRADE: 'true', LIMITS_ENABLED: 'true' },
  },
});
