# Deploy the Hisaab API to Azure (demo)

Azure App Service, Linux, **Basic B1** (1 core, 1.75 GB, "Always on"). That's plenty for a demo:
the heavy work happens at Google and Groq. B2 doubles the price for nothing you'd notice.
Free (F1) can't stay on: it sleeps when idle and has a daily CPU cap.

Already have a **Linux** Basic plan (check with `az appservice plan list -o table`)? Put this app
in it with `-p <that plan>` and skip step 2: apps sharing a plan cost nothing extra.

Run everything in PowerShell from `server/`. Replace `hisaab-api-devang` with any unused name.

## 0. One-time setup

```powershell
winget install -e --id Microsoft.AzureCLI   # then open a new terminal
az login
```

## 1. Build the upload (rerun after every server change)

```powershell
npx tsx scripts/pack-azure.ts
```

Creates `deploy/hisaab-api.zip` and `deploy/appsettings.azure.json` (your `.env` as Azure settings,
plus `NODE_ENV=production`, `UPLOAD_DIR=/home/data/uploads`, `ALLOW_MOCK_UPGRADE=true`).
`deploy/` holds your keys: it's git-ignored, never share it.

## 2. Create the server (once)

```powershell
az group create -n hisaab-demo -l centralindia
az appservice plan create -g hisaab-demo -n hisaab-plan --is-linux --sku B1
az webapp create -g hisaab-demo -p hisaab-plan -n hisaab-api-devang --runtime "NODE:22-lts"
az webapp config set -g hisaab-demo -n hisaab-api-devang --always-on true --startup-file "node dist/index.js"
az webapp update -g hisaab-demo -n hisaab-api-devang --https-only true
az webapp config appsettings set -g hisaab-demo -n hisaab-api-devang --settings "@deploy/appsettings.azure.json" --output none
```

`--output none` matters: without it Azure prints every setting, keys included.

## 3. Let Azure reach MongoDB Atlas (once)

Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) for the demo.
Tighter: add each address from
`az webapp show -g hisaab-demo -n hisaab-api-devang --query possibleOutboundIpAddresses -o tsv`.

## 4. Upload

```powershell
az webapp deploy -g hisaab-demo -n hisaab-api-devang --src-path deploy/hisaab-api.zip --type zip
```

## 5. Check it

```powershell
$hostName = az webapp show -g hisaab-demo -n hisaab-api-devang --query defaultHostName -o tsv
curl.exe "https://$hostName/api/health"
```

Expect `"ok":true,"aiStatus":"ok","dbMode":"mongo"`. If not:
`az webapp log tail -g hisaab-demo -n hisaab-api-devang`.

## 6. Point the app at it

In `mobile/.env`: `EXPO_PUBLIC_API_URL=https://<hostName>` then `npx expo start -c`.
For a phone on another network (the CEO's), start Metro with `npx expo start --tunnel`.

Stop the local server (`npm run dev`) once Azure is live: both use the same database, and two
servers would send duplicate reminder notifications. Photos logged on the local server stay on
your PC; new ones are stored on Azure.

## Redeploy after changes

```powershell
npx tsx scripts/pack-azure.ts
az webapp deploy -g hisaab-demo -n hisaab-api-devang --src-path deploy/hisaab-api.zip --type zip
```

Changed `.env`? Also rerun the `appsettings set` line from step 2.

## Remove everything (when the CEO's own server is ready)

```powershell
az group delete -n hisaab-demo --yes
```
