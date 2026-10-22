# Deploy the Hisaab API to Azure (demo)

Uses the **existing B1 plan** `ASP-devangserver-9c83` (Linux, Central India, resource group
`devang-server`) that already runs `callingagent` and `readora`. Apps in one plan share it,
so this costs nothing extra. Deploys from GitHub: every `git push` redeploys automatically.

## 1. Put the server on GitHub (once)

On github.com: **New repository** → name `hisaab-api` → **Private** → leave README, .gitignore and
license off → Create. Then in PowerShell:

```powershell
cd D:\WORK\hisaab\server
git remote add origin https://github.com/<your-username>/hisaab-api.git
git push -u origin main
```

`.env`, `deploy/` and uploaded photos are git-ignored: your keys never reach GitHub.

## 2. Create the web app (once)

Portal → **App Services** → **Create** → **Web App**:

| Tab | Field | Value |
|---|---|---|
| Basics | Subscription | Azure for Students |
| | Resource group | `devang-server` |
| | Name | `hisaab-api` (Azure adds a unique suffix to the domain) |
| | Publish | Code |
| | Runtime stack | **Node 22 LTS** |
| | Operating system | **Linux** |
| | Region | **Central India** (the plan only shows up in its own region) |
| | Linux Plan | **ASP-devangserver-9c83 (B1)**, the existing one |
| Deployment | Continuous deployment | **Enable** → GitHub → sign in → your account, repo `hisaab-api`, branch `main` |

**Review + create** → **Create**. Azure adds a workflow file to the repo
(`.github/workflows/main_hisaab-api.yml`) and starts it: install → build → run the 71 tests → deploy.
Watch it on GitHub → **Actions** (about 3–5 minutes). Afterwards run `git pull` once, so your
copy has that file too.

## 3. Settings (once, while the first deploy runs)

1. Make the settings file (it also builds a zip you can ignore):
   ```powershell
   npx tsx scripts/pack-azure.ts
   ```
2. Web app → **Settings → Environment variables** → **App settings** → **Advanced edit** →
   select everything, paste the contents of `server\deploy\appsettings.azure.json` → **OK** →
   **Apply** → **Confirm**. That file holds your keys: don't share it.
3. Web app → **Settings → Configuration** → **General settings**:
   - **Startup Command**: `npm start`
   - **Always on**: On
   - **HTTPS Only**: On
   → **Save** → Continue.
4. Optional: **Monitoring → Health check** → path `/api/health` → Save.

## 4. Let Azure reach MongoDB Atlas (once)

Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) → Confirm.
Without this the server can't reach the database and won't start.

## 5. Check it

Copy **Default domain** from the web app's Overview and open `https://<default domain>/api/health`.
Expect `"ok":true` and `"dbMode":"mongo"`. `aiStatus` turns `"ok"` a few seconds after a start.
Not working? Web app → **Log stream**.

Then point the app at it: see `mobile/BUILD_APK.md` (APK) or set
`EXPO_PUBLIC_API_URL=https://<default domain>` in `mobile/.env` and run `npx expo start -c` (Expo Go).

Stop the local server (`npm run dev`) once Azure is live: both use the same database, and two
servers would send duplicate reminder notifications. Photos logged on the local server stay on
your PC; new ones are stored on Azure (`/home/data/uploads`, kept across redeploys).

## Every change after that

```powershell
git add -A
git commit -m "what changed"
git push
```

GitHub Actions tests and redeploys it. Changed `.env`? Rerun step 3.1–3.2 (Advanced edit again).

## Notes

- The B1 plan now runs three apps in 1.75 GB of memory; Hisaab uses about 100–150 MB. If things
  get slow: plan → **Metrics** → Memory percentage.
- Remove it later: delete only the `hisaab-api` web app. Don't delete the plan or the resource
  group: `callingagent` and `readora` live there too.
