import cors from 'cors';
import express, { Router } from 'express';
import { config } from './config.js';
import { getAiStatus } from './ai/gemini.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { accountRoutes, authRoutes } from './routes/account.js';
import { chatRoutes } from './routes/chat.js';
import { mealRoutes } from './routes/meals.js';
import { notificationRoutes } from './routes/notifications.js';
import { adminRoutes, subscriptionRoutes } from './routes/subscription.js';
import { trackingRoutes } from './routes/tracking.js';
import { trainerRoutes } from './routes/trainer.js';
import { UPLOAD_DIR } from './services/images.js';
import type { Store } from './store/types.js';

export function createApp(store: Store) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '12mb' })); // base64 photos
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

  if (!config.isTest) {
    app.use((req, res, next) => {
      const t = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - t}ms`));
      next();
    });
  }

  const api = Router();

  // Public
  api.get('/health', (_req, res) => {
    const ai = getAiStatus();
    res.json({
      ok: true,
      aiMode: config.aiMode,
      aiStatus: ai.state,
      aiError: 'error' in ai ? ai.error : null,
      dbMode: store.kind,
      model: config.aiMode === 'gemini' ? config.GEMINI_MODEL : null,
      // Who answers coach / typed meals / reminders first
      textModel: config.aiMode !== 'gemini' ? null : config.GROQ_API_KEY ? config.GROQ_MODELS.split(',')[0].trim() : config.GEMINI_MODEL,
    });
  });
  api.use(authRoutes(store));
  api.use(adminRoutes(store)); // guarded by x-admin-key, not user JWT

  // Everything below needs a user token
  api.use(requireAuth(store));
  api.use(accountRoutes(store));
  api.use(trackingRoutes(store));
  api.use(mealRoutes(store));
  api.use(chatRoutes(store));
  api.use(notificationRoutes(store));
  api.use(trainerRoutes(store));
  api.use(subscriptionRoutes(store));

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
