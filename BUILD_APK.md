# Build an Android APK to share (demo)

The APK has the app built in and talks to the Azure server, so the CEO installs it like any
app: no Expo Go, no laptop running. Builds run in Expo's cloud (free plan); no Android Studio.

## 1. Point it at Azure

In `eas.json`, replace both `https://REPLACE-WITH-YOUR-AZURE-DEFAULT-DOMAIN` with your web app's
**Default domain** from the Azure Overview, e.g.
`https://hisaab-api-abcd1234.centralindia-01.azurewebsites.net` (no `/` at the end).

Check that `https://<that domain>/api/health` opens first (see `server/DEPLOY_AZURE.md`).

## 2. Link to Expo (once)

Make a free account at https://expo.dev/signup, then:

```powershell
cd D:\WORK\hisaab\mobile
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` adds the project ID to `app.json`. Commit that change.

## 3. Build

```powershell
npx eas-cli@latest build -p android --profile preview
```

- First time it asks to create an Android keystore: answer **Yes** (Expo keeps it safe for you).
- Takes about 10–25 minutes; the free plan sometimes queues first. You can close the terminal:
  progress is also on https://expo.dev → your project → Builds.

## 4. Share

When it finishes you get a link (and a QR code). Send the link. On the Android phone:
open it → **Install** / download the `.apk` → open it → allow **Install unknown apps** for the
browser when asked → Install.

iPhone can't install an APK. For an iPhone: Expo Go with `npx expo start --tunnel` while your PC
runs, or TestFlight (needs a paid Apple developer account).

## Updating

- Server changes (AI, prompts, data): just `git push` the server. No new APK needed.
- App changes (screens, wording): raise `android.versionCode` in `app.json` (1 → 2 → 3…), build
  again, install the new APK over the old one. Accounts and logs stay: they live on the server.

## Notes

- Meal reminders work (scheduled on the phone). Server push notifications need Firebase set up,
  which a demo doesn't need.
- Package name is `com.hisaab.app`. Change it in `app.json` before any Play Store release; it
  can't change afterwards.
