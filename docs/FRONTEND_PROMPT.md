# Hisaab — Frontend Build Prompt (for Gemini / Antigravity)

> Copy everything below the line into Antigravity. The backend already exists in `/server`
> (Node + Express + TypeScript). Your job is ONLY the mobile app in `/mobile`.
> A typed API client is provided at `/sdk/hisaabApi.ts` — copy it into the app, don't hand-write fetch calls.

---

You are a Senior React Native (Expo) engineer and product designer. Build the complete mobile frontend for **Hisaab** — an AI calorie tracker for the Indian market, inspired by **Cal AI (calai.app)**, that disguises calorie tracking as a daily **Profit & Loss ledger ("hisaab")**.

The backend is already built and running. **Do not build or modify any backend code.** Build only `/mobile`, and wire every screen to the real API described in section 5.

## 1. The core idea (drives all copy and UI)

Indian users don't think in "calorie deficit/surplus" — they understand **hisaab** (accounts).

| Nutrition term | Hisaab term (use in UI) |
|---|---|
| Daily calorie target | **Capital / Budget** |
| Calories eaten | **Kharcha** (spent) |
| Calories burned in workouts | **Bonus credit** |
| Calories left | **Balance** |
| Under budget (goal: lose/maintain) | **MUNAFA — In Profit** (green) |
| Over budget | **GHATA — In Loss** (red) |

For users with goal `gain` the backend flips the sign for you — always just trust `pnl.status` from the API. Never compute P&L on the client.

Tone of all copy: warm, witty Hinglish "big brother" (Bada Bhai). e.g. empty state: *"Aaj ka hisaab khaali hai boss. Pehli photo khicho 📸"*.

## 2. Tech stack (use exactly this)

- **Expo (latest SDK), managed workflow, TypeScript**, **expo-router** with a bottom-tab layout
- `react-native-svg` for macro progress rings, `lucide-react-native` for icons
- `expo-camera` (live camera) + `expo-image-picker` (gallery fallback) + **`expo-image-manipulator`** (resize before upload — see 4B)
- `expo-secure-store` (JWT + deviceId), `expo-crypto` (`randomUUID` for deviceId)
- `expo-notifications` (local scheduled notifications + Expo push token)
- `expo-haptics` for the capture tap
- `@tanstack/react-query` for server state (caching, polling, invalidation)
- Config: `EXPO_PUBLIC_API_URL` env var, e.g. `http://192.168.1.10:4000` (the laptop's LAN IP — the server prints it on boot). No trailing slash, no `/api`.
- Must run in **Expo Go** on a real phone. Anything that needs a dev build (Apple Health / Health Connect) is a **mocked toggle** for now.

## 3. Design system — sleek dark mode (Cal AI style)

```
bg        #0A0A0C     card      #16161A     cardAlt   #1E1E24     border  #26262E
text      #F5F5F7     textDim   #9A9AA5     textMute  #5E5E68
profit    #10B981 (emerald)   loss  #EF4444 (coral red)   accent  #F59E0B (amber)
protein   #F87171   carbs  #FBBF24   fat  #60A5FA   water  #38BDF8
radius: cards 20, pills 999, buttons 16      spacing scale: 4/8/12/16/24/32
font: system; numbers tabular, big balance number 48–56 bold
```

Rules: generous whitespace, one strong number per card, rounded cards, subtle borders, no gradients except a faint glow behind the P&L badge, 60fps animations (ring fill on mount, number count-up). Light mode not needed.

## 4. Screens & flows

### Tab bar (5 slots)
`Home` · `Hisaab` (ledger/analytics) · **center floating `+`** · `Bada Bhai` (AI chat) · `Profile`

### 0. Onboarding (first launch only)
1. Splash → silently call `auth.guest({ deviceId })` (deviceId = UUID generated once and stored in SecureStore). Store the JWT.
2. If `user.profile === null`: 5 quick steps, one question per screen, big tap targets — name → goal (lose / maintain / gain) → sex + age → height + weight → activity level. Then `PUT /api/me/profile`.
3. Show a "Your daily capital" reveal screen with `user.targets` (calories, P/C/F, water): *"Roz ka capital: 1,850 kcal. Isse kam kharcha = munafa."*
4. Ask notification permission with a fun pre-prompt card before the OS dialog.

### A. Home (Dashboard) — `GET /api/dashboard?date=`
- Header: "Hisaab" wordmark, 🔥 streak badge (`streak`), `Today | Yesterday` segmented toggle (changes `date`).
- **Main Hisaab card**: big `summary.caloriesLeft` with label "Calories left (Balance)"; P&L badge from `summary.pnl.label`, green for `PROFIT`, red for `LOSS`, amber for `BREAK_EVEN`; small line: "Capital 1,850 · Kharcha 1,230 · Bonus +300".
- **3 macro rings**: Protein / Carbs / Fat from `summary.macros.*` — ring = `progress` (clamp at 1, turn red if > 1), center text = `left` g + "left".
- Quick trackers row: **Water** card (`summary.water.ml / targetMl`, tap `+250ml` → `POST /api/water`, long-press undo → `DELETE /api/water/last`), **Exercise** card (burned kcal, tap → workout logger sheet).
- **Recently uploaded** list (`meals`, newest first). Each card: thumbnail (`resolveImageUrl(meal.imageUrl)`), `dishName`, time, kcal, P/C/F pills, health score `8/10`, and P&L tag from `meal.hisaab.label` (green/red).
  - `status === 'analyzing'` → skeleton card with shimmering thumbnail and text "Bada Bhai hisaab laga raha hai…". **Poll** the dashboard every 2s while any meal is analyzing (react-query `refetchInterval`), stop when none.
  - `status === 'failed'` → card showing `meal.error` with **Retry** (`api.meals.retry(id)`) and **Describe instead**.
  - Tap a meal → Meal Detail sheet (same as review sheet below, editable).
- Pull to refresh.

### B. `+` Capture — the 2–3 second loop (most important screen)
- Tapping `+` opens a **full-screen camera immediately** (no intermediate menu). Bottom mode switcher: **Snap** (default) · **Barcode** · **Describe** · gallery icon.
- **Snap**: shutter → haptic → resize with expo-image-manipulator to **max 1024px long edge, JPEG quality 0.7** (keeps AI cost low) → `meals.analyze({ image })` **without wait** (returns `202` with an `analyzing` meal) → close camera instantly → user lands on Home and sees the skeleton card. That's the whole interaction. Total < 3s.
- **Describe**: text box with Hinglish placeholder *"2 plate idli sambar aur ek filter coffee"* → `meals.analyze({ description }, { wait: true })` → open Review sheet.
- **Barcode**: use `expo-camera` barcode scanning → `food.barcode(code)` → show product + serving stepper → `meals.create({...})`. On 404: "Ye product nahi mila — photo khich lo".
- **Review / "Fix Results" sheet** (Cal AI style; also used as Meal Detail): photo, `dishName` (editable), big calories, P/C/F tiles (editable numbers), health score bar, ingredients list, servings stepper (0.5×–5×), meal type chips, `verdict` in an amber quote bubble. Buttons: **Fix Results** (enables editing → `PATCH /api/meals/:id`) and **Done**. Delete in overflow menu.
- On **402 `PAYWALL_LIMIT`** from analyze → open the Paywall modal (section E) instead of an error.

### C. Hisaab tab (ledger / analytics) — `GET /api/ledger?from=&to=`
- Range chips: 7 days (default) · 30 days.
- Top card: total P&L for the range (`totals.pnl.label`) + "≈ `totals.pnl.kgEquivalent` kg" translated to progress: *"Is hafte ka munafa ≈ 0.31 kg fat 💸"*.
- Bar chart (react-native-svg): one bar per day, height = `|pnl.amount|`, green above the zero line for profit, red below for loss, grey stub for days with `logged: false`.
- Khata list: each day row → date, kharcha, bonus, P&L tag. Tap → Home with that date.
- Stats: profit days / loss days / logged days.

### D. Bada Bhai (AI coach chat) — `POST /api/chat/bada-bhai`, `GET /api/chat/history`
- Chat UI with a "Bada Bhai" avatar, user bubbles right, bhai bubbles left, typing indicator while waiting.
- Suggestion chips when empty: *"Agar main ek slice cake khaun toh kitna loss?"*, *"400 kcal bachi hain, dinner mein kya khaun?"*, *"Aaj ka hisaab kaisa hai?"*, *"Protein kaise badhaun veg mein?"*.
- Small counter in header: free chats left (`usage.chats.limit - usage.chats.used`, hide for Pro).
- 402 → Paywall modal. Clear chat in overflow menu (`DELETE /api/chat/history`).

### E. Profile / Settings / Trainer
- Profile card (name, goal, weight) → edit profile (`PUT /api/me/profile`) and optionally manual targets (`PUT /api/me/targets`).
- **Plan card**: Free / Pro badge, today's usage ("Scans 2/3 · Chats 1/5"), "Go Pro" button → Paywall.
- **Paywall modal** (reused everywhere): headline *"Free ka hisaab khatam, boss"*, benefits list (unlimited-ish scans, Bada Bhai unlimited, trainer sharing, smart nudges), plans from `GET /api/subscription` (`plans[]`, prices in ₹), CTA → `POST /api/subscription/mock-upgrade` (real payments come later — label it "Start Pro (test mode)").
- **Notifications**: toggle; "notifications per day" stepper (1–10, `PATCH /api/me`); **"Test Zomato-style notification"** button → `POST /api/notifications/test` and also show it immediately as a local notification with the returned `title/body`.
- **Health sync (side feature)**: Apple Health / Health Connect toggles (`PUT /api/health/settings`). Since Expo Go can't read HealthKit, when toggled on show "Coming in the next build" and offer a **"Sync demo workout"** button that calls `POST /api/health/sync` with one fake workout (`externalId` = random UUID) so the bonus-credit flow is demoable.
- **Workout logger** (sheet, also opened from Home's Exercise card): type chips (Walking, Running, Gym/Strength, Yoga, Cricket, Badminton, Cycling, HIIT, Dance), duration stepper, optional kcal override → `POST /api/workouts`. List today's workouts with swipe-to-delete.
- **Trainer section**:
  - "Share with my trainer" → shows `GET /api/trainer/invite-code` as a big copyable code + share sheet, plus "Remove trainer access" (`POST /api/trainer/revoke`) when `trainerCount > 0`.
  - "I'm a trainer" → enter a client's code → `POST /api/trainer/link`. Then a **Clients** list (`GET /api/trainer/clients`) with each client's today P&L badge; tap → read-only client dashboard (`GET /api/trainer/clients/:id?date=`) reusing the Home components in read-only mode.

### F. Notifications (Zomato-style)
- On launch (after permission) and once per day: `GET /api/notifications/schedule?count=<user.notificationsPerDay>` → cancel all previously scheduled Hisaab notifications → schedule each with `expo-notifications` as a **daily-at-time local notification** for today using `hour`/`minute` (skip times already passed). Re-fetch next app open (copy refreshes daily and is personalized).
- Also try to get an Expo push token and `POST /api/notifications/register` — wrap in try/catch (remote push doesn't work in Expo Go on Android; that's fine, local notifications cover the MVP).
- Tapping a notification deep-links to the `+` camera.

## 5. API contract (the backend is the source of truth)

- Base: `${EXPO_PUBLIC_API_URL}/api`. All bodies JSON unless noted. Auth header: `Authorization: Bearer <token>` on everything except `/health` and `/auth/guest`.
- Errors are always `{ "error": { "code": string, "message": string, "details"?: any } }`. Codes you must handle: `UNAUTHORIZED` (401 → re-run `auth.guest` with the same deviceId, retry once), `PAYWALL_LIMIT` (402 → Paywall; `details = { feature: 'scans'|'chats', used, limit }`), `VALIDATION_ERROR` (400), `NOT_FOUND` (404).
- Dates are `YYYY-MM-DD` strings in the user's timezone (IST default). Omit `date` to mean today.
- `imageUrl` is a server-relative path like `/uploads/abc.jpg` → use `resolveImageUrl()` from the SDK.

| Method & path | Body / query | Response |
|---|---|---|
| `GET /health` | – | `{ ok, aiMode: 'gemini'\|'mock', dbMode, model }` |
| `POST /auth/guest` | `{ deviceId, name? }` | `{ token, user, created }` (same deviceId → same user) |
| `GET /me` | – | `{ user }` |
| `PATCH /me` | `{ name?, timezone?, notificationsPerDay? }` | `{ user }` |
| `PUT /me/profile` | `{ sex, age, heightCm, weightKg, activityLevel, goal, targetWeightKg? }` | `{ user }` (targets recomputed) |
| `PUT /me/targets` | `{ calories, proteinG, carbsG, fatG, waterMl }` or `{ reset: true }` | `{ user }` |
| `GET /dashboard` | `?date=` | `{ date, summary, streak, meals[], workouts[], usage }` |
| `GET /ledger` | `?from=&to=` (default last 7 days) | `{ from, to, days[], totals }` |
| `POST /meals/analyze` | multipart: `image` (file), `description?`, `mealType?`, `date?` — or JSON `{ imageBase64?, mimeType?, description?, mealType?, date? }`; `?wait=true` to block until done | `202 { meal }` (analyzing) or `200 { meal }` with `wait` |
| `POST /meals` | `{ dishName, calories, proteinG, carbsG, fatG, fiberG?, mealType?, date?, source?: 'manual'\|'barcode', servings? }` | `201 { meal }` |
| `GET /meals/:id` | – | `{ meal }` |
| `PATCH /meals/:id` | any of `{ dishName, calories, proteinG, carbsG, fatG, fiberG, mealType, servings }` | `{ meal }` (`servings` scales all numbers) |
| `POST /meals/:id/retry` | `?wait=true` optional — failed meals only, counts as a scan | `202 { meal }` / `200 { meal }` |
| `DELETE /meals/:id` | – | `{ ok: true }` |
| `GET /food/barcode/:code` | – | `{ product: { code, name, brand, servingLabel, calories, proteinG, carbsG, fatG, fiberG, imageUrl } }` per serving, or 404 |
| `POST /water` | `{ ml, date? }` (1–2000) | `{ water: { ml, targetMl, progress } }` |
| `DELETE /water/last` | `?date=` | `{ water }` |
| `GET /workouts` | `?date=` | `{ workouts[] }` |
| `POST /workouts` | `{ type, durationMin, caloriesBurned?, date?, notes? }` | `201 { workout }` (kcal estimated if omitted) |
| `DELETE /workouts/:id` | – | `{ ok: true }` |
| `PUT /health/settings` | `{ appleHealth?, healthConnect? }` | `{ user }` |
| `POST /health/sync` | `{ source: 'apple_health'\|'health_connect', workouts: [{ externalId, type, durationMin, caloriesBurned, startedAt }] }` | `{ imported, skipped }` |
| `POST /chat/bada-bhai` | `{ message }` | `{ reply: ChatMessage, usage }` |
| `GET /chat/history` | `?limit=50` | `{ messages: ChatMessage[] }` (oldest first) |
| `DELETE /chat/history` | – | `{ ok: true }` |
| `POST /notifications/register` | `{ expoPushToken }` | `{ ok: true }` |
| `DELETE /notifications/register` | `{ expoPushToken }` | `{ ok: true }` |
| `GET /notifications/schedule` | `?count=10` | `{ notifications: [{ id, slot, hour, minute, title, body }] }` |
| `POST /notifications/test` | – | `{ notification: { title, body }, pushed: boolean }` |
| `GET /trainer/invite-code` | – | `{ code, trainerCount }` |
| `POST /trainer/revoke` | – (client side: remove all trainers, new code) | `{ code, trainerCount }` |
| `POST /trainer/link` | `{ code }` | `{ client: { id, name } }` |
| `GET /trainer/clients` | – | `{ clients: [{ id, name, goal, lastActiveAt, today: { caloriesLeft, pnl, meals } }] }` |
| `GET /trainer/clients/:clientId` | `?date=` | `{ client: { id, name, goal, profile, targets }, dashboard }` (same shape as `/dashboard`) |
| `DELETE /trainer/clients/:clientId` | – | `{ ok: true }` |
| `GET /subscription` | – | `{ isPro, proUntil, plans[], features[], usage, mockUpgradeEnabled }` |
| `POST /subscription/mock-upgrade` | `{ planId }` | `{ user }` |
| `POST /subscription/cancel` | – | `{ user }` |

### Core types (identical to `/sdk/hisaabApi.ts`)

```ts
type PnlStatus = 'PROFIT' | 'LOSS' | 'BREAK_EVEN';
interface Pnl { amount: number; status: PnlStatus; label: string; kgEquivalent: number }
interface MacroLine { target: number; eaten: number; left: number; progress: number }
interface DaySummary {
  date: string; goal: 'lose' | 'maintain' | 'gain';
  budget: number; eaten: number; burned: number; net: number; caloriesLeft: number;
  pnl: Pnl;
  macros: { protein: MacroLine; carbs: MacroLine; fat: MacroLine };
  water: { targetMl: number; ml: number; progress: number };
  counts: { meals: number; pendingMeals: number; workouts: number };
}
interface Meal {
  id: string; date: string; loggedAt: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  source: 'photo' | 'text' | 'barcode' | 'manual';
  status: 'analyzing' | 'done' | 'failed';
  imageUrl: string | null; description: string | null;
  dishName: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
  healthScore: number; ingredients: { name: string; quantity: string; calories: number }[];
  verdict: string; confidence: number; error: string | null; servings: number; edited: boolean;
  hisaab: Pnl | null;   // per-meal profit/loss tag (null while analyzing)
}
interface Usage { scans: { used: number; limit: number }; chats: { used: number; limit: number }; isPro: boolean }
interface ChatMessage { id: string; role: 'user' | 'model'; text: string; createdAt: string }
```

### Using the SDK (do this, don't hand-roll fetch)

```ts
// src/api/client.ts
import * as SecureStore from 'expo-secure-store';
import { createHisaabApi } from './hisaabApi';
import { getDeviceId } from '../auth/device';

export const api = createHisaabApi({
  baseUrl: process.env.EXPO_PUBLIC_API_URL!,
  getToken: () => SecureStore.getItemAsync('hisaab_token'),
  onUnauthorized: async () => {
    const { token } = await api.auth.guest(await getDeviceId());
    await SecureStore.setItemAsync('hisaab_token', token);
    return true; // SDK retries the failed request once
  },
});

// Snap flow: resize, fire, close camera — don't await the AI
const small = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG });
api.meals.analyze({ image: { uri: small.uri } }).then(() => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
router.back();

// Errors
try { await api.chat.send(text) } catch (e) { if (e instanceof HisaabApiError && e.isPaywall) router.push('/paywall') }
```

SDK method map: `status()`, `auth.guest`, `me.{get,update,setProfile,setTargets,resetTargets}`, `dashboard.get`, `ledger.get`, `meals.{analyze,analyzeBase64,create,get,update,retry,remove}`, `food.barcode`, `water.{add,undoLast}`, `workouts.{list,create,remove}`, `health.{settings,sync}`, `chat.{send,history,clear}`, `notifications.{register,unregister,schedule,test}`, `trainer.{inviteCode,revokeAll,link,clients,client,unlink}`, `subscription.{get,mockUpgrade,cancel}`, `resolveImageUrl(path)`.

## 6. Code structure

```
mobile/
  app/                      expo-router routes
    _layout.tsx             providers: QueryClient, auth bootstrap, fonts, theme
    onboarding/…            onboarding steps
    (tabs)/_layout.tsx      custom tab bar with the floating + button
    (tabs)/index.tsx        Home
    (tabs)/hisaab.tsx       Ledger
    (tabs)/bada-bhai.tsx    Chat
    (tabs)/profile.tsx      Profile / Settings / Trainer
    capture.tsx             full-screen camera modal (presentation: 'fullScreenModal')
    meal/[id].tsx           Review / Fix Results sheet
    paywall.tsx             modal
    trainer/[clientId].tsx  read-only client dashboard
  src/api/hisaabApi.ts      ← copied from /sdk/hisaabApi.ts (do not edit types)
  src/api/queries.ts        react-query hooks wrapping the SDK
  src/auth/                 SecureStore token + deviceId, bootstrap
  src/components/           HisaabCard, MacroRing, MealCard, PnlBadge, WaterCard, PaywallSheet…
  src/theme/                tokens from section 3
  src/notifications/        schedule + register logic
```

## 7. Definition of done

- `npx expo start` → scan QR in Expo Go → onboarding → snap a photo → back on Home in < 3 s with an analyzing card → card fills in with dish, kcal, macros, P&L tag; balance and rings update.
- Describe-a-meal and barcode paths work; Fix Results edits persist.
- Bada Bhai answers with the user's real balance; 4th scan of the day on a free account opens the Paywall; mock upgrade removes the limit.
- Test notification fires; daily schedule is set.
- Trainer flow works end-to-end with two phones (or two simulators).
- No hardcoded data anywhere — everything comes from the API. Works when the backend is in mock AI mode (no Gemini key) too.
- Clean TypeScript (no `any` in screens), components small and reusable, consistent design tokens.
