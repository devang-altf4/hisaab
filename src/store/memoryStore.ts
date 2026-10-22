import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { newId } from '../lib/ids.js';
import type { Filter, FindOptions, Repo, Store, UsageDay, UsageDelta } from './types.js';

/**
 * In-memory store, optionally persisted to a JSON file (debounced writes).
 * Good for local dev and demos up to a few thousand rows — use Mongo beyond that.
 */

function matches<T>(doc: T, filter: Filter<T>): boolean {
  for (const [key, cond] of Object.entries(filter as Record<string, unknown>)) {
    if (cond === undefined) continue;
    const value = (doc as Record<string, unknown>)[key];
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
      const op = cond as { $gte?: unknown; $lte?: unknown; $in?: unknown[]; $ne?: unknown };
      if (op.$gte !== undefined && !((value as never) >= (op.$gte as never))) return false;
      if (op.$lte !== undefined && !((value as never) <= (op.$lte as never))) return false;
      if (op.$in !== undefined && !op.$in.includes(value)) return false;
      if (op.$ne !== undefined && value === op.$ne) return false;
      continue;
    }
    if (Array.isArray(value)) {
      if (!value.includes(cond)) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

class MemoryRepo<T extends { id: string }> implements Repo<T> {
  constructor(
    private rows: Map<string, T>,
    private onChange: () => void,
  ) {}

  async create(doc: T) {
    this.rows.set(doc.id, structuredClone(doc));
    this.onChange();
    return structuredClone(doc);
  }
  async get(id: string) {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }
  async findOne(filter: Filter<T>) {
    for (const row of this.rows.values()) if (matches(row, filter)) return structuredClone(row);
    return null;
  }
  async find(filter: Filter<T>, opts: FindOptions<T> = {}) {
    let out = [...this.rows.values()].filter((r) => matches(r, filter));
    if (opts.sort) {
      const [[key, dir]] = Object.entries(opts.sort) as [keyof T, 1 | -1][];
      out.sort((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : 0));
    }
    if (opts.limit) out = out.slice(0, opts.limit);
    return out.map((r) => structuredClone(r));
  }
  async count(filter: Filter<T>) {
    let n = 0;
    for (const row of this.rows.values()) if (matches(row, filter)) n++;
    return n;
  }
  async update(id: string, patch: Partial<T>) {
    const row = this.rows.get(id);
    if (!row) return null;
    const next = { ...row, ...structuredClone(patch), id };
    this.rows.set(id, next);
    this.onChange();
    return structuredClone(next);
  }
  async delete(id: string) {
    const ok = this.rows.delete(id);
    if (ok) this.onChange();
    return ok;
  }
}

const COLLECTIONS = ['users', 'meals', 'workouts', 'water', 'chat', 'usage'] as const;
type Collection = (typeof COLLECTIONS)[number];

export function createMemoryStore(filePath?: string): Store {
  const data = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()])) as Record<Collection, Map<string, any>>;

  if (filePath && existsSync(filePath)) {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, any[]>;
    for (const c of COLLECTIONS) for (const row of raw[c] ?? []) data[c].set(row.id, row);
  }

  let timer: NodeJS.Timeout | null = null;
  const flush = () => {
    if (!filePath) return;
    timer = null;
    mkdirSync(dirname(filePath), { recursive: true });
    const snapshot = Object.fromEntries(COLLECTIONS.map((c) => [c, [...data[c].values()]]));
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot));
    renameSync(tmp, filePath); // atomic replace so a crash never leaves half a file
  };
  const onChange = () => {
    if (filePath && !timer) timer = setTimeout(flush, 250);
  };

  const repo = <T extends { id: string }>(c: Collection) => new MemoryRepo<T>(data[c], onChange);
  const usage = repo<UsageDay>('usage');

  return {
    kind: filePath ? 'file' : 'memory',
    users: repo('users'),
    meals: repo('meals'),
    workouts: repo('workouts'),
    water: repo('water'),
    chat: repo('chat'),
    usage,
    async incUsage(userId: string, date: string, delta: UsageDelta) {
      const existing = await usage.findOne({ userId, date });
      const base: UsageDay = existing ?? {
        id: newId(), userId, date, scans: 0, chats: 0, aiCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
      };
      const next = { ...base };
      for (const [k, v] of Object.entries(delta) as [keyof UsageDelta, number][]) next[k] = (next[k] ?? 0) + v;
      return existing ? (await usage.update(base.id, next))! : usage.create(next);
    },
    async close() {
      if (timer) {
        clearTimeout(timer);
        flush();
      }
    },
  };
}
