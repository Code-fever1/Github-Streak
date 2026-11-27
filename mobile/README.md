# Veyon Mobile (v3)

**Veyon** is the Android & Web companion for GitHub streak automation, built in a Swiss-minimalist OLED dark theme (`Expo 57` / `React Native 0.86` / `Hermes`) with standalone **Magisk** root daemons for **Galaxy S8+ Exynos**.

## Navigation & Features (v3)

1. **Dashboard** (`app/(tabs)/index.tsx`)
   - **GitHub Streak Hero**: current streak, 12-week best, today's commit total (`app` vs `other`), daily plan target bar, 7-day cadence strip, and isolated `NextTick` countdown.
   - **Modules Bento**: side-by-side **Battery Limit** (`lower–cap%` window + live Android level) and **Fiverr / Unread Alerts** (`delay`, `mode`, daily nudges, `Root OK` confirmation).
   - **RAM Usage Bar**: polls `ActivityManager.getMemoryInfo` on Android (`used / total`, available RAM, `Optimal / Elevated / Low memory` threshold) and browser JS heap / device memory on Web.
   - **Operational KPIs & Quick Actions**: `Active`, `Queued`, `Failed`, `Success %`, `+1 Commit` / `+10 Batch`, and recent activity log.
2. **GitHub** (`app/(tabs)/github.tsx`)
   - 12-week GitHub commit calendar, 14-day breakdown, full repository cards (`Pause`/`Resume`, `Delete`), live send pipeline (`Queued` → `Writing` → `Pushing` → `Failed` retry/delete), and sent history.
3. **Charge** (`app/(tabs)/charge.tsx`)
   - `0–100%` hysteresis window gauge, master **Charge limit** toggle, `Stop charging at` (`50–90%`) and `Start charging at` (`40–70%`) presets, Magisk superuser status, and live background script PID + daemon state.
4. **Notification** (`app/(tabs)/notification.tsx`)
   - Daily streak reminders (`12:00 · 18:00 · 23:00`), unread app alerts toggle, `+ Add Fiverr` quick-add + Android installed-app picker, `1 / 10 / 30 min` delay, `Alarm / Ringtone / Chime` sound mode, vibration, test/stop buttons, and **Root Monitor (Magisk)** live confirmation (`Confirmed · Running`, PID, status, heartbeat age, watched packages, active tray matches).
5. **Settings** (`app/(tabs)/settings.tsx`)
   - Repository management & GitHub sync shortcuts, quick section navigation, version/package details, and Android `su` status.

## Target Device & OS Requirements

| Item | Requirement / Tested Baseline |
|------|-------------------------------|
| **Device** | **Samsung Galaxy S8+ Exynos** (`SM-G955F`, `dream2lte`, `samsungexynos8895`, `arm64-v8a`) |
| **OS (root features)** | **LineageOS 23.2** (**Android 16 / SDK 36**, tested on `23.2-20261013-UNOFFICIAL-dream2lte`, kernel `4.4.302`) or Exynos 8895 ROM with `/sys/class/power_supply/battery/batt_slate_mode` |
| **Root** | **Magisk 30.7 (`MAGISKSU`)** with `/data/adb/service.d/` support and superuser granted to `com.streakkeeper.mobile` |
| **Non-root Android** | Android 7.0+ (`minSdk 24`, `arm64-v8a`) — GitHub Streak, Pipeline, Calendar, RAM Bar, Daily Nudges, and Notification Listener alerts work without root |

## How Background Execution Works

- **No persistent background app**: `KeeperService` only runs briefly during active commits or an exact `AlarmManager` wake (`KeeperWakeReceiver`), runs `StreakKeeperTask`, schedules the next wake via `StreakWakeScheduler`, and closes the process cleanly.
- **Root scripts run independently when closed**:
  - `/data/adb/service.d/veyon-charge-hold.sh` reads `/data/local/tmp/veyon-charge.conf` and writes `/data/local/tmp/veyon-charge.state` + `/data/local/tmp/veyon-charge.hb`.
  - `/data/adb/service.d/veyon-unread-alerts.sh` reads `/data/local/tmp/veyon-alerts.conf`, scans active `Notification List:` entries every 15s, triggers `.AlertTriggerActivity` when an unread notification exceeds the configured delay, writes `/data/local/tmp/veyon-alerts.state`, and unbinds `FiverrNotificationListener` so `system_server` does not keep the app pinned in RAM.

## Run Locally

```bash
cd mobile
npm install
npm start          # Expo Metro
npm run web        # Web preview at http://localhost:8081
npm run build      # Static web export (dist/)
npx tsc --noEmit   # TypeScript check
```

## Build & Install Android Release (arm64)

```bash
cd mobile/android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
ANDROID_HOME=$HOME/Android/Sdk \
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

adb install -r app/build/outputs/apk/release/app-release.apk
```

Tracked native Kotlin & shell sources live in `mobile/native-android/` and are synced into `mobile/android/` by `plugins/withStreakKeeperNative.js` during `npx expo prebuild`.

## Package ID

`com.streakkeeper.mobile` (display name: **Veyon**)
