/**
 * Hisaab Typed API Client SDK
 * Complete TypeScript client matching the Hisaab backend API contract.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Role = 'user' | 'trainer';
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealSource = 'photo' | 'text' | 'barcode' | 'manual';
export type MealStatus = 'analyzing' | 'done' | 'failed';
export type PnlStatus = 'PROFIT' | 'LOSS' | 'BREAK_EVEN';
export type WorkoutSource = 'manual' | 'apple_health' | 'health_connect';

export interface Pnl {
  amount: number;
  status: PnlStatus;
  label: string;
  kgEquivalent: number;
}

export interface MacroLine {
  target: number;
  eaten: number;
  left: number;
  progress: number;
}

export interface DaySummary {
  date: string;
  goal: Goal;
  budget: number;
  eaten: number;
  burned: number;
  net: number;
  caloriesLeft: number;
  pnl: Pnl;
  macros: {
    protein: MacroLine;
    carbs: MacroLine;
    fat: MacroLine;
  };
  water: {
    targetMl: number;
    ml: number;
    progress: number;
  };
  counts: {
    meals: number;
    pendingMeals: number;
    workouts: number;
  };
}

export interface Ingredient {
  name: string;
  quantity: string;
  calories: number;
  /** AI-analysed meals: weight as served and per-item macros */
  grams?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  /** Countable items (skewers, rotis, idlis…): how many, and the singular unit */
  pieces?: number;
  pieceUnit?: string;
}

/** "How many skewers?" — shown when the AI couldn't count an item for sure */
export interface Clarify {
  ingredientIndex: number;
  question: string;
  unit: string;
  /** The AI's guess */
  current: number;
  /** Tap-to-answer choices around the guess */
  options: number[];
}

export interface Meal {
  id: string;
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
  servings: number;
  /** Non-null → show the one-line question with option chips */
  clarify: Clarify | null;
  /** Times the user used "Wrong?" on this meal (max 3) */
  corrections: number;
  edited: boolean;
  hisaab: Pnl | null;
}

export interface Workout {
  id: string;
  date: string;
  loggedAt: string;
  type: string;
  durationMin: number;
  caloriesBurned: number;
  source: WorkoutSource;
  externalId: string | null;
  notes: string | null;
}

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
  name: string;
  role: Role;
  timezone: string;
  profile: Profile | null;
  targets: Targets;
  customTargets: boolean;
  isPro: boolean;
  proUntil: string | null;
  pushEnabled: boolean;
  hasPushToken: boolean;
  notificationsPerDay: number;
  healthSync: { appleHealth: boolean; healthConnect: boolean };
  trainerInviteCode: string;
  trainerCount: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface Usage {
  /** false during the MVP: nothing is capped, hide all "x free left" counters */
  limitsEnabled?: boolean;
  scans: { used: number; limit: number };
  chats: { used: number; limit: number };
  isPro: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
}

export interface BarcodeProduct {
  code: string;
  name: string;
  brand: string | null;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  imageUrl: string | null;
}

export interface LedgerDay {
  date: string;
  budget: number;
  eaten: number;
  burned: number;
  net: number;
  pnl: Pnl;
  /** false when no meal was logged that day (excluded from totals) */
  logged: boolean;
}

export interface LedgerRange {
  from: string;
  to: string;
  days: LedgerDay[];
  totals: {
    eaten: number;
    burned: number;
    pnl: Pnl;
    loggedDays: number;
    profitDays: number;
    lossDays: number;
  };
}

export interface ScheduledNotificationItem {
  id: string;
  slot: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

export interface SubscriptionPlan {
  id: 'pro_monthly' | 'pro_yearly';
  name: string;
  priceInr: number;
  period: string;
  days: number;
  badge: string | null;
}

export interface SubscriptionDetails {
  isPro: boolean;
  proUntil: string | null;
  plans: SubscriptionPlan[];
  features: string[];
  usage: Usage;
  mockUpgradeEnabled: boolean;
}

export interface TrainerClientSummary {
  id: string;
  name: string;
  goal: Goal;
  lastActiveAt: string;
  today: {
    caloriesLeft: number;
    pnl: Pnl;
    meals: number;
  };
}

export interface DashboardResponse {
  date: string;
  summary: DaySummary;
  streak: number;
  meals: Meal[];
  workouts: Workout[];
  usage: Usage;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any;
}

export class HisaabApiError extends Error {
  status: number;
  code: string;
  details?: any;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || 'API Error');
    this.name = 'HisaabApiError';
    this.status = status;
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.details = payload.details;
  }
}

export interface HisaabApiConfig {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  getDeviceId?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => Promise<string | null>;
}

export class HisaabApiClient {
  private config: HisaabApiConfig;

  constructor(config: HisaabApiConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, '').replace(/\/api$/, ''),
    };
  }

  setBaseUrl(url: string) {
    this.config.baseUrl = url.replace(/\/+$/, '').replace(/\/api$/, '');
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  resolveImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    const base = this.config.baseUrl;
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${base}${path}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = this.config.getToken ? await this.config.getToken() : null;

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401 && !isRetry && this.config.onUnauthorized) {
      const newToken = await this.config.onUnauthorized();
      if (newToken) {
        return this.request<T>(endpoint, options, true);
      }
    }

    let json: any = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { error: { code: 'PARSE_ERROR', message: text } };
    }

    if (!res.ok) {
      const errorPayload: ApiErrorPayload = json?.error || {
        code: `HTTP_${res.status}`,
        message: res.statusText || 'Request failed',
        details: json,
      };
      throw new HisaabApiError(res.status, errorPayload);
    }

    return json as T;
  }

  // ─── Health ──────────────────────────────────────────────────
  async health(): Promise<{
    ok: boolean;
    aiMode: 'gemini' | 'mock';
    /** 'mock' = no key (sample results), 'error' = key/model rejected, 'ok' = AI answering */
    aiStatus?: 'mock' | 'ok' | 'error';
    aiError?: string | null;
    dbMode: string;
    model?: string | null;
  }> {
    return this.request('/health');
  }

  // ─── Auth ────────────────────────────────────────────────────
  auth = {
    guest: async (body: { deviceId: string; name?: string }): Promise<{ token: string; user: User; created: boolean }> => {
      return this.request('/auth/guest', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  };

  // ─── Me / Profile ────────────────────────────────────────────
  me = {
    get: async (): Promise<{ user: User }> => {
      return this.request('/me');
    },
    patch: async (patch: { name?: string; timezone?: string; notificationsPerDay?: number }): Promise<{ user: User }> => {
      return this.request('/me', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    updateProfile: async (profile: Profile): Promise<{ user: User }> => {
      return this.request('/me/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
    },
    updateTargets: async (targets: Targets | { reset: true }): Promise<{ user: User }> => {
      return this.request('/me/targets', {
        method: 'PUT',
        body: JSON.stringify(targets),
      });
    },
  };

  // ─── Dashboard ───────────────────────────────────────────────
  dashboard = {
    get: async (date?: string): Promise<DashboardResponse> => {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      return this.request(`/dashboard${q}`);
    },
  };

  // ─── Ledger ──────────────────────────────────────────────────
  ledger = {
    get: async (from?: string, to?: string): Promise<LedgerRange> => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const q = params.toString() ? `?${params.toString()}` : '';
      return this.request(`/ledger${q}`);
    },
  };

  // ─── Meals ───────────────────────────────────────────────────
  meals = {
    analyze: async (
      input: {
        image?: { uri: string; name?: string; type?: string };
        imageBase64?: string;
        mimeType?: string;
        description?: string;
        mealType?: MealType;
        date?: string;
      },
      opts?: { wait?: boolean }
    ): Promise<{ meal: Meal }> => {
      const q = opts?.wait ? '?wait=true' : '';

      if (input.image) {
        const formData = new FormData();
        const name = input.image.name || 'meal.jpg';
        const type = input.image.type || 'image/jpeg';
        const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
        if (isReactNative) {
          // Expo replaces global fetch on native; its FormData rejects React Native's
          // { uri, name, type } parts ("Unsupported FormDataPart implementation").
          throw new Error('On the phone, upload photos with imageBase64 (see capture.tsx), not image.uri');
        } else {
          // Browsers need a real Blob (uri is a blob: or data: URL there)
          const blob = await (await fetch(input.image.uri)).blob();
          formData.append('image', blob, name);
        }
        if (input.description) formData.append('description', input.description);
        if (input.mealType) formData.append('mealType', input.mealType);
        if (input.date) formData.append('date', input.date);

        return this.request(`/meals/analyze${q}`, {
          method: 'POST',
          body: formData,
        });
      }

      return this.request(`/meals/analyze${q}`, {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: input.imageBase64,
          mimeType: input.mimeType,
          description: input.description,
          mealType: input.mealType,
          date: input.date,
        }),
      });
    },

    create: async (body: {
      dishName: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG?: number;
      healthScore?: number;
      mealType?: MealType;
      date?: string;
      source?: MealSource;
      servings?: number;
    }): Promise<{ meal: Meal }> => {
      return this.request('/meals', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    get: async (id: string): Promise<{ meal: Meal }> => {
      return this.request(`/meals/${encodeURIComponent(id)}`);
    },

    patch: async (
      id: string,
      patch: Partial<{
        dishName: string;
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        fiberG: number;
        mealType: MealType;
        servings: number;
      }>
    ): Promise<{ meal: Meal }> => {
      return this.request(`/meals/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    /**
     * Edit mode: replace the meal's item list. Totals are recomputed from the items (never typed).
     * Rows: { ref? (index of the original item), name, grams? }. Same name + new grams → exact
     * rescale; new/renamed items → AI estimates them at that weight; rows left out are removed.
     */
    editItems: async (
      id: string,
      body: { items: { ref?: number; name: string; grams?: number }[]; dishName?: string; mealType?: MealType },
    ): Promise<{ meal: Meal }> => {
      return this.request(`/meals/${encodeURIComponent(id)}/ingredients`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },

    /** Answer "How many …?": instant recount, no AI call, no scan used. */
    clarify: async (id: string, body: { pieces: number; ingredientIndex?: number }): Promise<{ meal: Meal }> => {
      return this.request(`/meals/${encodeURIComponent(id)}/clarify`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /**
     * "Wrong?": AI redoes the meal with the photo + these details as the truth (~2–4 s).
     * Send only non-empty fields. Max 3 per meal. 502 AI_UNAVAILABLE leaves the meal unchanged.
     */
    correct: async (id: string, body: { name?: string; quantity?: string; notes?: string }): Promise<{ meal: Meal }> => {
      return this.request(`/meals/${encodeURIComponent(id)}/correct`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    retry: async (id: string, opts?: { wait?: boolean }): Promise<{ meal: Meal }> => {
      const q = opts?.wait ? '?wait=true' : '';
      return this.request(`/meals/${encodeURIComponent(id)}/retry${q}`, {
        method: 'POST',
      });
    },

    delete: async (id: string): Promise<{ ok: boolean }> => {
      return this.request(`/meals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  };

  // ─── Food / Barcode ──────────────────────────────────────────
  food = {
    barcode: async (code: string): Promise<{ product: BarcodeProduct }> => {
      return this.request(`/food/barcode/${encodeURIComponent(code)}`);
    },
  };

  // ─── Water ───────────────────────────────────────────────────
  water = {
    log: async (ml: number, date?: string): Promise<{ water: { targetMl: number; ml: number; progress: number } }> => {
      return this.request('/water', {
        method: 'POST',
        body: JSON.stringify({ ml, date }),
      });
    },
    deleteLast: async (date?: string): Promise<{ water: { targetMl: number; ml: number; progress: number } }> => {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      return this.request(`/water/last${q}`, {
        method: 'DELETE',
      });
    },
  };

  // ─── Workouts ────────────────────────────────────────────────
  workouts = {
    list: async (date?: string): Promise<{ workouts: Workout[] }> => {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      return this.request(`/workouts${q}`);
    },
    create: async (body: {
      type: string;
      durationMin: number;
      caloriesBurned?: number;
      date?: string;
      notes?: string;
    }): Promise<{ workout: Workout }> => {
      return this.request('/workouts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    delete: async (id: string): Promise<{ ok: boolean }> => {
      return this.request(`/workouts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  };

  // ─── Health Sync ─────────────────────────────────────────────
  healthSync = {
    updateSettings: async (settings: { appleHealth?: boolean; healthConnect?: boolean }): Promise<{ user: User }> => {
      return this.request('/health/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
    sync: async (payload: {
      source: 'apple_health' | 'health_connect';
      workouts: {
        externalId: string;
        type: string;
        durationMin: number;
        caloriesBurned: number;
        startedAt: string;
      }[];
    }): Promise<{ imported: number; skipped: number }> => {
      return this.request('/health/sync', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  };

  // ─── Chat (Coach) ─────────────────────────────────────────────
  chat = {
    send: async (message: string): Promise<{ reply: ChatMessage; usage: Usage }> => {
      return this.request('/chat/coach', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },
    history: async (limit = 50): Promise<{ messages: ChatMessage[] }> => {
      return this.request(`/chat/history?limit=${limit}`);
    },
    clear: async (): Promise<{ ok: boolean }> => {
      return this.request('/chat/history', {
        method: 'DELETE',
      });
    },
  };

  // ─── Notifications ───────────────────────────────────────────
  notifications = {
    register: async (expoPushToken: string): Promise<{ ok: boolean }> => {
      return this.request('/notifications/register', {
        method: 'POST',
        body: JSON.stringify({ expoPushToken }),
      });
    },
    unregister: async (expoPushToken: string): Promise<{ ok: boolean }> => {
      return this.request('/notifications/register', {
        method: 'DELETE',
        body: JSON.stringify({ expoPushToken }),
      });
    },
    schedule: async (count?: number): Promise<{ notifications: ScheduledNotificationItem[] }> => {
      const q = count !== undefined ? `?count=${count}` : '';
      return this.request(`/notifications/schedule${q}`);
    },
    test: async (): Promise<{ notification: { title: string; body: string }; pushed: boolean }> => {
      return this.request('/notifications/test', {
        method: 'POST',
      });
    },
  };

  // ─── Trainer ─────────────────────────────────────────────────
  trainer = {
    inviteCode: async (): Promise<{ code: string; trainerCount: number }> => {
      return this.request('/trainer/invite-code');
    },
    revoke: async (): Promise<{ code: string; trainerCount: number }> => {
      return this.request('/trainer/revoke', {
        method: 'POST',
      });
    },
    link: async (code: string): Promise<{ client: { id: string; name: string } }> => {
      return this.request('/trainer/link', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
    clients: async (): Promise<{ clients: TrainerClientSummary[] }> => {
      return this.request('/trainer/clients');
    },
    clientDashboard: async (clientId: string, date?: string): Promise<{ client: { id: string; name: string; goal: Goal; profile: Profile | null; targets: Targets }; dashboard: DashboardResponse }> => {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      return this.request(`/trainer/clients/${encodeURIComponent(clientId)}${q}`);
    },
    unlink: async (clientId: string): Promise<{ ok: boolean }> => {
      return this.request(`/trainer/clients/${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
      });
    },
  };

  // ─── Subscription ────────────────────────────────────────────
  subscription = {
    get: async (): Promise<SubscriptionDetails> => {
      return this.request('/subscription');
    },
    mockUpgrade: async (planId?: 'pro_monthly' | 'pro_yearly'): Promise<{ user: User }> => {
      return this.request('/subscription/mock-upgrade', {
        method: 'POST',
        body: JSON.stringify({ planId: planId || 'pro_monthly' }),
      });
    },
    cancel: async (): Promise<{ user: User }> => {
      return this.request('/subscription/cancel', {
        method: 'POST',
      });
    },
  };
}

