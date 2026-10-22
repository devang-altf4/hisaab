# Hisaab

An AI calorie tracker for India, framed as a daily **profit & loss ledger**. Snap your food, the AI
works out the calories, and your day ends in profit (under budget) or not.

```
hisaab/
  mobile/   Expo app (React Native, expo-router)
  server/   API: Node + Express 5 + TypeScript, MongoDB, Gemini + Groq
  sdk/      hisaabApi.ts, the typed API client (same file as mobile/src/api/hisaabApi.ts)
  docs/     design prompts used for the app's screens
```

## Run it locally

Server:

```bash
cd server
npm install
cp .env.example .env      # works with zero config (mock AI + local JSON file)
npm run dev
```

On start it prints the address the phone should use, e.g. `EXPO_PUBLIC_API_URL=http://192.168.29.159:4000`.

App (in Expo Go, phone on the same Wi-Fi):

```bash
cd mobile
npm install
# put the address above in mobile/.env as EXPO_PUBLIC_API_URL=...
npx expo start -c
```

## Real AI and data (`server/.env`)

- `GEMINI_API_KEY`: meal photos (and backup for text). Optional `GEMINI_API_KEY_2` from another Google account doubles the free quota.
- `GROQ_API_KEY`: text-only AI (coach chat, typed meals, reminders, item edits) answers here first: fast, separate free quota.
- `MONGODB_URI` + `MONGODB_DATABASE`: MongoDB Atlas (free tier is fine). Without it, a JSON file in `server/data/`.
- Models that run out of quota or are overloaded are skipped automatically for a while; see `server/src/ai/gemini.ts`.

## Tests

```bash
cd server
npm test           # 71 offline tests (memory database + mock AI)
npm run smoke      # end-to-end check against a running server
```

## Deploy

- Server → Azure App Service: [server/DEPLOY_AZURE.md](server/DEPLOY_AZURE.md) (GitHub Actions deploys `server/` on push).
- App → shareable Android APK: [mobile/BUILD_APK.md](mobile/BUILD_APK.md).

## How the ledger works

| Nutrition | Hisaab |
|---|---|
| Daily target (Mifflin-St Jeor TDEE −500 / ±0 / +300 by goal) | **Budget** |
| Calories eaten | Spent |
| Workout burn (MET estimate, or Apple Health / Health Connect) | **Bonus** |
| Budget − eaten + bonus | **Balance** ("calories left") |
| Under budget | **Profit**. Over budget is a **loss**. For a *gain* goal it flips, and being under budget reads "Need X kcal more" |

Each meal also gets its own tag against that slot's share of the budget (breakfast 25%, lunch 35%,
snack 10%, dinner 30%). 7,700 kcal counts as about 1 kg.

## Before a real launch

- Real payments (RevenueCat / Razorpay) setting `isPro` / `proUntil`. Today "mock upgrade" turns Pro on for demos.
- Forgot-password flow (needs an email service).
- Photos on object storage (R2/S3) and a job queue before running more than one server.
- Reading HealthKit / Health Connect needs an Expo dev build; the `/health/sync` endpoint is ready.
- Server push notifications need Firebase in the app build; on-phone reminders already work.
