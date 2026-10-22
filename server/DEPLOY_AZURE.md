# Deploy the Hisaab API to Azure (demo)

Uses the **existing B1 plan** `ASP-devangserver-9c83` (Linux, Central India, resource group
`devang-server`) that already runs `callingagent` and `readora`. Apps in one plan share it,
so this costs nothing extra.

The whole project (app + server) is one GitHub repo. The workflow
`.github/workflows/deploy-server.yml` builds, tests and deploys `server/` whenever a push to `main`
changes something in `server/`. App-only changes don't redeploy.

## 1. Put the project on GitHub (once)

On github.com: **New repository** → name `hisaab` → **Private** → leave README, .gitignore and
license off → Create. Then in PowerShell:

```powershell
cd D:\WORK\hisaab
git remote add origin https://github.com/<your-username>/hisaab.git
git push -u origin main
```

`.env` files, `server/deploy/` and uploaded photos are git-ignored: your keys never reach GitHub.
This first push also starts the deploy workflow; it fails until steps 2–4 are done. That's expected.

## 2. Create the web app (once)

Portal → **App Services** → **Create** → **Web App**:

| Tab | Field | Value |
|---|---|---|
| Basics | Subscription | Azure for Students |
| | Resource group | `devang-server` |
| | Name | `hisaab-api` (if you pick another, change `AZURE_WEBAPP_NAME` in the workflow file) |
| | Publish | Code |
| | Runtime stack | **Node 22 LTS** |
| | Operating system | **Linux** |
| | Region | **Central India** (the plan only shows up in its own region) |
| | Linux Plan | **ASP-devangserver-9c83 (B1)**, the existing one |
| Deployment | Continuous deployment | **Disable** (the repo's own workflow deploys) |

**Review + create** → **Create**.

## 3. Settings (once)

1. Make the settings file (it also builds a zip you can ignore):
   ```powershell
   cd D:\WORK\hisaab\server
   npx tsx scripts/pack-azure.ts
   ```
2. Web app → **Settings → Environment variables** → **App settings** → **Advanced edit** →
   select everything, paste the contents of `server\deploy\appsettings.azure.json` → **OK** →
   **Apply** → **Confirm**. That file holds your keys: don't share it.
3. Web app → **Settings → Configuration** → **General settings**:
   - **Startup Command**: `npm start`
   - **SCM Basic Auth Publishing Credentials**: On (GitHub needs it to upload)
   - **Always on**: On
   - **HTTPS Only**: On
   → **Save** → Continue.

## 4. Let GitHub deploy to it (once)

1. Web app → **Overview** → **Download publish profile**.
2. Open the downloaded file in Notepad, copy everything.
3. GitHub repo → **Settings → Secrets and variables → Actions** → **New repository secret** →
   Name `AZURE_WEBAPP_PUBLISH_PROFILE`, paste as the value → **Add secret**.
4. Delete the downloaded file: it works like a password for the web app.

## 5. Let Azure reach MongoDB Atlas (once)

Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) → Confirm.
Without this the server can't reach the database and won't start.

## 6. First deploy and check

GitHub repo → **Actions** → **Deploy server to Azure** → **Run workflow** (about 3–4 minutes:
install, build, 71 tests, deploy). Then open `https://<default domain>/api/health`
(Default domain is on the web app's Overview). Expect `"ok":true` and `"dbMode":"mongo"`;
`aiStatus` turns `"ok"` a few seconds after a start. Not working? Web app → **Log stream**.

Then point the app at it: see `mobile/BUILD_APK.md` (APK) or set
`EXPO_PUBLIC_API_URL=https://<default domain>` in `mobile/.env` and run `npx expo start -c` (Expo Go).

Stop the local server (`npm run dev`) once Azure is live: both use the same database, and two
servers would send duplicate reminder notifications. Photos logged on the local server stay on
your PC; new ones are stored on Azure (`/home/data/uploads`, kept across redeploys).

## Every change after that

```powershell
cd D:\WORK\hisaab
git add -A
git commit -m "what changed"
git push
```

If `server/` changed, GitHub tests and redeploys it. Changed `server/.env`? Redo step 3.1–3.2.

## Notes

- The B1 plan now runs three apps in 1.75 GB of memory; Hisaab uses about 100–150 MB. If things
  get slow: plan → **Metrics** → Memory percentage.
- Remove it later: delete only the `hisaab-api` web app. Don't delete the plan or the resource
  group: `callingagent` and `readora` live there too.
