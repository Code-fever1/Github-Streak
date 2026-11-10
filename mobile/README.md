# Veyon (mobile)

**Veyon** keeps GitHub streak repos warm from your phone: scheduled commits, a live send pipeline, GitHub-accurate history, and optional **Fiverr notification alerts** on Android.

## Highlights (v2)

- **Command-center home** — stats, system status, recent activity, repo list with **+1 | +10**
- **Pipeline tab** — queued → writing → pushing → sent; **GitHub commit calendar** (app vs manual) via API
- **Settings** — Fiverr alert mode (alarm / ringtone / chime) using Android notification listener
- **Android keeper** — foreground send status; swipe app away to stop sending; day reminders at 12pm / 6pm / 11pm if nothing was committed
- **Tuned for older phones** — Hermes, arm64-only release APK, sparse background ticks when idle

## Run locally

```bash
cd mobile
npm install
npm start          # Metro
npm run web        # browser UI
```

## Add a repo

1. Paste `https://github.com/you/your-repo`
2. Add a **GitHub PAT** with `repo` scope (or deploy key flow where supported)
3. **+1** / **+10** or let the timer run

Commits queue offline and drain when you are online and the app is running (or backgrounded with the Android keeper service).

## Build Android release (arm64)

Requires Android SDK, JDK 17, and a local `mobile/android` folder (from `npx expo prebuild` if missing).

```bash
cd mobile/android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
ANDROID_HOME=$HOME/Android/Sdk \
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

Install:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Fiverr alerts (Android)

1. Open **Settings** (gear on home)
2. Enable **Fiverr alert mode** and grant **notification access** for Veyon
3. Pick alarm / ringtone / chime and use **Test sound**

When the Fiverr app posts a notification, Veyon plays your chosen alert (no need to open Fiverr).

## Package id

`com.streakkeeper.mobile` (legacy id; display name **Veyon**)
