import { join } from 'node:path';
import { config } from '../config.js';
import { createMemoryStore } from './memoryStore.js';
import type { Store } from './types.js';

export * from './types.js';

export async function createStore(): Promise<Store> {
  if (config.isTest) return createMemoryStore();
  if (config.MONGODB_URI) {
    const { createMongoStore } = await import('./mongo/mongoStore.js');
    return createMongoStore(config.MONGODB_URI, config.MONGODB_DATABASE);
  }
  return createMemoryStore(join(process.cwd(), 'data', 'db.json'));
}
