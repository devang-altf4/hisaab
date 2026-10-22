# Hisaab

An AI calorie tracker for India, framed as a daily **profit & loss ledger**. Snap your food, and Bada Bhai keeps the hisaab.

```
hisaab/
  server/   Node + Express 5 + TypeScript API (this is done)
  sdk/      hisaabApi.ts — typed client; copy into the Expo app
  docs/     FRONTEND_PROMPT.md — paste into Gemini / Antigravity to build /mobile
  mobile/   Expo app (Antigravity builds this)
```

## Run the backend

```bash
cd server
npm install
cp .env.example .env      # optional: works with zero config
npm run dev
```

On boot it prints the URL your phone should use, e.g. `EXPO_PUBLIC_API_URL=http://192.168.29.159:4000`. The phone and laptop must be on the same Wi-Fi. Windows Firewall may ask you to allow Node; say yes for private networks.

**Zero-config defaults:** with no `.env`:
- **Mock AI.** Realistic fake results built from an Indian food table (idli, biryani, samosa…). Costs nothing.
- **JSON file DB** at `server/data/db.json`.

To go real:
- `GEMINI_API_KEY=...` (from https://aistudio.google.com/apikey). `GEMINI_MODEL` defaults to `gemini-2.5-flash`.
- `MONGODB_URI=mongodb+srv://...` (MongoDB Atlas free tier is fine).

| Command | What it does |
|---|---|
| `npm run dev` | API with hot reload on :4000 |
| `npm test` | 29 unit + API tests, offline (memory DB + mock AI) |
| `npm run smoke` | End-to-end check of a running server through the SDK |
| `npm run build && npm start` | Production build |

## How the hisaab works

| Nutrition | Hisaab |
|---|---|
| Daily target (Mifflin-St Jeor TDEE −500 / ±0 / +300 by goal) | **Capital** |
| Calories eaten | **Kharcha** |
| Workout burn (MET-based estimate, or Apple Health / Health Connect) | **Bonus credit** |
| Capital − kharcha + bonus | **Balance** ("calories left") |
| Positive balance | **MUNAFA** (profit) · negative is **GHATA** (loss) · flipped for `gain` goal |

Each meal also gets its own P&L tag, comparing it with that slot's share of the budget (breakfast 25%, lunch 35%, snack 10%, dinner 30%). For the weekly view, 7700 kcal counts as about 1 kg.

## The 2-second loop

`POST /api/meals/analyze` saves the photo and returns **202** right away with an `analyzing` meal. The app closes the camera at once. Gemini finishes in the background, and the dashboard polls until the card fills in. If the AI fails, the scan is refunded and the meal is marked `failed` with a retry option.

## Unit economics (the "per user cost" question)

Every AI call records its tokens and USD cost on the user's daily usage row. You can see the real numbers here:

```bash
curl -H "x-admin-key: $ADMIN_KEY" http://localhost:4000/api/admin/economics?days=30
```

That returns cost per active user, cost per user-day, a projected monthly cost per daily user, and average scans and chats per day.

**Rough estimate on Gemini 2.5 Flash** ($0.30 / M input tokens, $2.50 / M output tokens). These need confirming with the endpoint above once real traffic comes in:
- One photo scan (about 1,024 px image + prompt, roughly 1.5k tokens in and 0.4k out) costs about **$0.0015**.
- One Bada Bhai reply (roughly 1.5k in, 0.2k out) costs about **$0.001**.
- A daily notification schedule is generated once per user per day and costs about **$0.001**.
- A heavy user doing 5 scans and 5 chats a day costs about **$0.35/month (about ₹30)**. A free user capped at 3 scans and 5 chats costs about ₹20/month at most.
- Server costs are separate and small. One ₹1–2k/month VPS plus Atlas free or shared tier handles thousands of users. Images need object storage (R2/S3) before you scale out.

You can change the free limits and Pro fair-use caps in `.env`. Plans are placeholders (₹149/month, ₹999/year) in `server/src/routes/subscription.ts`.

## API

The full contract is in [docs/FRONTEND_PROMPT.md §5](docs/FRONTEND_PROMPT.md). Every error is returned as `{ error: { code, message, details? } }`. When you hit a quota you get `402 PAYWALL_LIMIT`.

## Code map (`server/src`)

```
config.ts              env (zod), mock/real switches
domain/                pure logic: nutrition.ts (targets, MET), hisaab.ts (ledger/P&L), foodDb.ts
ai/                    gemini.ts (SDK + cost), prompts.ts (all system prompts),
                       mealAnalyzer.ts, badaBhai.ts, notifications.ts — each with a mock path
store/                 Store interface → memoryStore.ts (file) | mongo/ (Mongoose models)
services/              ledger, meals pipeline, usage/quota, push (Expo), nudges job, barcode (Open Food Facts), images
routes/                account, meals, tracking (dashboard/ledger/water/workouts/health), chat,
                       notifications, trainer, subscription + admin
```

## Not done yet (before launch)

- Real payments (RevenueCat / Razorpay webhook that sets `isPro` / `proUntil`). Today `mock-upgrade` turns Pro on in test mode, and it is disabled when `NODE_ENV=production`.
- Real accounts (phone OTP / Google). Guest login is keyed to a device id.
- Image storage on R2/S3, and a job queue for analysis if you run more than one server instance.
- Reading HealthKit / Health Connect on the phone needs an Expo dev build. The backend `/health/sync` endpoint is ready.
- Rate limiting at the edge (Cloudflare or nginx).
