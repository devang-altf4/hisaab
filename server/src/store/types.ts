/**
 * Domain entities + the storage contract.
 *
 * Two implementations satisfy `Store`:
 *  - FileStore  (default, zero setup — JSON file in data/db.json)
 *  - MongoStore (set MONGODB_URI)
 *
 * Filters use a small, Mongo-compatible subset so the same query works on both:
 *   equality, { $gte, $lte, $in, $ne }, and "array contains" for array fields.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Role = 'user' | 'trainer';
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealSource = 'photo' | 'text' | 'barcode' | 'manual';
export type MealStatus = 'analyzing' | 'done' | 'failed';
export type WorkoutSource = 'manual' | 'apple_health' | 'health_connect';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg?: number;
}

export interface Targets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
}

export interface User {
  id: string;
  /** Guest key from the app. Once the account has an email, only email + password signs in. */
  deviceId: string;
  /** Set when the guest creates an account (lowercase). Absent for guests. */
  email?: string;
  /** scrypt hash, never sent to the client. */
  passwordHash?: string;
  name: string;
  role: Role;
  timezone: string;
  /** null until onboarding is completed — targets then fall back to defaults. */
  profile: Profile | null;
  targets: Targets;
  /** true when the user set targets by hand (don't recompute on profile change). */
  customTargets: boolean;
  isPro: boolean;
  proUntil: string | null;
  pushTokens: string[];
  pushEnabled: boolean;
  notificationsPerDay: number;
  /** slot -> date key of the last server-side nudge, prevents duplicates. */
  nudgesSent: Record<string, string>;
  healthSync: { appleHealth: boolean; healthConnect: boolean };
  /** Code this user shares with their trainer. */
  trainerInviteCode: string;
  /** Trainers who can view this user's ledger. */
  trainerIds: string[];
  createdAt: string;
  lastActiveAt: string;
}

export interface Ingredient {
  name: string;
  quantity: string;
  calories: number;
  /** Present for AI-analysed meals: weight as served + per-item macros (totals are their sums). */
  grams?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  /** Countable items (skewers, rotis, idlis…): how many, and the singular unit. */
  pieces?: number;
  pieceUnit?: string;
}

/** A one-line question the app shows when the AI couldn't count something for sure. */
export interface Clarify {
  ingredientIndex: number;
  question: string;
  unit: string;
  current: number;
  options: number[];
}

export interface Meal {
  id: string;
  userId: string;
  date: string;
  loggedAt: string;
  mealType: MealType;
  source: MealSource;
  status: MealStatus;
  imageUrl: string | null;
  description: string | null;
  dishName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  healthScore: number;
  ingredients: Ingredient[];
  verdict: string;
  confidence: number;
  error: string | null;
  /** Portion multiplier shown in the servings stepper; numbers above already include it. */
  servings: number;
  /** Set when the AI wants the user to confirm a count ("How many skewers?"). */
  clarify: Clarify | null;
  /** How many times the user asked the AI to redo this meal ("Wrong?"). */
  corrections: number;
  /** true once the user corrected AI numbers via "Fix Results". */
  edited: boolean;
}

export interface Workout {
  id: string;
  userId: string;
  date: string;
  loggedAt: string;
  type: string;
  durationMin: number;
  caloriesBurned: number;
  source: WorkoutSource;
  externalId: string | null;
  notes: string | null;
}

export interface WaterLog {
  id: string;
  userId: string;
  date: string;
  loggedAt: string;
  ml: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
}

export interface UsageDay {
  id: string;
  userId: string;
  date: string;
  scans: number;
  chats: number;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// ─── Storage contract ─────────────────────────────────────

type Operator<V> = { $gte?: V; $lte?: V; $in?: V[]; $ne?: V };
export type Filter<T> = {
  [K in keyof T]?: T[K] extends Array<infer E> ? E | T[K] : T[K] | Operator<T[K]>;
};

export interface FindOptions<T> {
  sort?: { [K in keyof T]?: 1 | -1 };
  limit?: number;
}

export interface Repo<T extends { id: string }> {
  create(doc: T): Promise<T>;
  get(id: string): Promise<T | null>;
  findOne(filter: Filter<T>): Promise<T | null>;
  find(filter: Filter<T>, opts?: FindOptions<T>): Promise<T[]>;
  count(filter: Filter<T>): Promise<number>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export type UsageDelta = Partial<Pick<UsageDay, 'scans' | 'chats' | 'aiCalls' | 'inputTokens' | 'outputTokens' | 'costUsd'>>;

export interface Store {
  kind: 'file' | 'memory' | 'mongo';
  users: Repo<User>;
  meals: Repo<Meal>;
  workouts: Repo<Workout>;
  water: Repo<WaterLog>;
  chat: Repo<ChatMessage>;
  usage: Repo<UsageDay>;
  /** Atomic upsert-increment of a user's usage for a day. */
  incUsage(userId: string, date: string, delta: UsageDelta): Promise<UsageDay>;
  close(): Promise<void>;
}
