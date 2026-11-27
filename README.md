<p align="center">
  <img src="./streak-keeper/assets/banner.svg" alt="streak-keeper & Veyon" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Code-fever1/Github-Streak/releases/tag/v3">
    <img src="https://img.shields.io/badge/release-v3-22c55e?logo=android&style=for-the-badge" alt="release v3" />
  </a>
  <img src="https://img.shields.io/badge/Android-arm64--v8a-0ea5e9?logo=android&style=for-the-badge" alt="Android arm64" />
  <img src="https://img.shields.io/badge/S8%2B_Exynos-LineageOS_23.2-8b5cf6?style=for-the-badge" alt="S8+ Exynos LineageOS 23.2" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-3b82f6?style=for-the-badge&logo=nodedotjs" alt="node" />
  <img src="https://img.shields.io/badge/license-MIT-0ea5e9?style=for-the-badge" alt="license" />
</p>

<h2 align="center">Veyon &amp; Streak-Keeper</h2>

<p align="center">
  A complete GitHub streak automation suite: <strong>Veyon</strong> (Expo / React Native Android companion with Swiss-minimalist OLED UI, standalone Magisk root daemons, and zero persistent background drain) alongside <strong>streak-keeper</strong> (Node.js server-side systemd engine).
</p>

---

## :iphone: Veyon Mobile (v3)

**Veyon** is built around a Swiss-minimalist OLED dark interface with **5 bottom navigation tabs**:

| Tab | What it does |
|-----|--------------|
| **Dashboard** | Live GitHub streak hero, 7-day cadence strip, daily plan target bar, isolated next-tick countdown, side-by-side **Battery Limit** & **Fiverr / Unread Alerts** status cards, live **RAM Usage Bar**, operational KPI strip (`Active`, `Queued`, `Failed`, `Success`), repo quick actions (`+1 Commit` / `+10 Batch`), and recent activity. |
| **GitHub** | 12-week GitHub API commit calendar (app vs. other commits), 14-day breakdown, full repository controls (`+1` / `+10`, `Pause` / `Resume`, `Delete`), live commit pipeline (`Queued` → `Writing` → `Pushing` → `Failed` retry/delete), and sent history. |
| **Charge** | Battery telemetry hero with `0–100%` hysteresis window gauge, master charge-limit toggle, `Stop charging at` (`50–90%`) and `Start charging at` (`40–70%`) presets, and live background script PID + daemon state confirmation. |
| **Notification** | Daily GitHub streak nudges (`12:00 · 18:00 · 23:00`), unread app alerts toggle, one-tap `+ Add Fiverr` + installed app picker, `1 / 10 / 30 min` unread delay, `Alarm / Ringtone / Chime` sound modes, vibration toggle, sound test/stop, and live Magisk root monitor confirmation (`Confirmed · Running`, PID, heartbeat age, watched apps, active tray matches). |
| **Settings** | Repository count & GitHub history sync, quick section shortcuts, app version/package info, and Android superuser (`su`) status. |

### Zero Persistent Background App & Standalone Daemons

- **Exact-alarm wake → sync → auto-close (GitHub Streak)**: Veyon does **not** keep a permanent background service or notification running. When idle, Android schedules a single exact `AlarmManager` wake (`KeeperWakeReceiver` / `StreakWakeScheduler`). At the scheduled time, `KeeperService` wakes `KeeperHeadlessService` (`StreakKeeperTask`), sends due or pending commits, schedules the next wake alarm, and terminates its process cleanly.
- **Standalone Charge Limit (`veyon-charge-hold.sh`)**: Every change in the **Charge** tab writes directly to `/data/local/tmp/veyon-charge.conf` and keeps `/data/adb/service.d/veyon-charge-hold.sh` running independently as `root` with a live heartbeat (`/data/local/tmp/veyon-charge.hb`), even when Veyon is completely closed.
- **Standalone Fiverr & Unread Alerts (`veyon-unread-alerts.sh`)**: Every change in the **Notification** tab writes `/data/local/tmp/veyon-alerts.conf` and syncs `/data/adb/service.d/veyon-unread-alerts.sh`. The script polls active `Notification List:` tray records every 15s, launches `.AlertTriggerActivity` (which plays the chosen sound and exits the process), writes live confirmation telemetry to `/data/local/tmp/veyon-alerts.state`, and automatically unbinds `FiverrNotificationListener` so Android does not pin Veyon in RAM.

---

## :gear: Target Hardware & Required OS

Veyon's root power and closed-app notification features are engineered and verified on:

| Component | Tested / Required Specification |
|-----------|---------------------------------|
| **Target Device** | **Samsung Galaxy S8+ (Exynos)** — Model `SM-G955F`, codename `dream2lte`, SoC `samsungexynos8895` (`arm64-v8a`), MAX77865 PMIC |
| **Required OS (full root features)** | **LineageOS 23.2** (**Android 16 / API 36**, verified on `23.2-20261013-UNOFFICIAL-dream2lte`, Linux kernel `4.4.302`) or compatible Exynos 8895 AOSP/LineageOS ROM exposing `/sys/class/power_supply/battery/batt_slate_mode` |
| **Required Root** | **Magisk** (verified on **Magisk 30.7 / `MAGISKSU`**) with `/data/adb/service.d/` boot script execution and Superuser (`su`) granted to `com.streakkeeper.mobile` |
| **Non-Rooted Android** | **Android 7.0+** (`minSdk 24`, `arm64-v8a`) — supports GitHub Streak, Pipeline, Commit Calendar, RAM Bar, Daily Streak Reminders, and `NotificationListenerService`-based unread alerts (Charge Limit & closed-app Magisk daemons require root + S8+ Exynos sysfs nodes) |

> **S8+ Exynos Charging Note**: The MAX77865 charger IC on `dream2lte` drops the charger path when `batt_slate_mode=1` (there is no hardware cord-bypass mode that freezes battery percentage). Veyon uses a hysteresis window (`lower%` to `cap%`, minimum `8%` gap) latched across two polls to eliminate start/stop chatter.

---

## :arrow_down: Download & Install (Android APK)

Download the pre-built `arm64-v8a` release APK from [**GitHub Releases (v3)**](https://github.com/Code-fever1/Github-Streak/releases/tag/v3):

```bash
adb install -r veyon-android-v3-arm64.apk
```

After installing:
1. Open **Veyon**, grant **Notifications** permission when prompted, and allow **Superuser (`su`)** in **Magisk** if using **Charge Limit** or **Root Monitor**.
2. In **GitHub → Add repo**, paste your repository URL and a GitHub Personal Access Token (`repo` scope).
3. In **Notification**, add **Fiverr** (or any app), pick `1 / 10 / 30 min` delay + sound mode, and verify **Root monitor (Magisk)** shows **Confirmed · Running**.
4. In **Charge**, choose your `Stop charging at` / `Start charging at` window and toggle **Charge limit** on.

---

## :hammer_and_wrench: Build from Source (Mobile)

```bash
cd mobile
npm install
npm run web        # Expo web preview at http://localhost:8081
npm run build      # Static web export + route generation
npx tsc --noEmit   # TypeScript verification
```

To build the `arm64-v8a` Android release APK locally (requires JDK 17, Android SDK 36, NDK 27, and `mobile/android` from `npx expo prebuild` if missing):

```bash
cd mobile/android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
ANDROID_HOME=$HOME/Android/Sdk \
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Output APK: `mobile/android/app/build/outputs/apk/release/app-release.apk`.

---

## :rocket: Server-Side Streak Engine (`streak-keeper/`)

For headless 24/7 Linux servers using `systemd` timers instead of a phone:

```bash
cd streak-keeper
cp config.example.json config.json
# edit config.json and set repoUrl

./install.sh
journalctl --user -u streak-keeper.service -f
```

See [`streak-keeper/README.md`](./streak-keeper/README.md) and [`streak-keeper/DEPLOY-AZURE.md`](./streak-keeper/DEPLOY-AZURE.md) for full server setup.

---

## :package: Project Structure

```
Github-Streak/
├── mobile/                         # Veyon mobile & web app (Expo SDK 57 / RN 0.86)
│   ├── app/
│   │   ├── (tabs)/                 # 5-tab UI: index (Dashboard), github, charge, notification, settings
│   │   ├── project/[id].tsx        # Per-repo hourly plan, timer, token & deploy key details
│   │   └── add-project.tsx         # GitHub repo + PAT onboarding
│   ├── components/                 # StreakHeroCard, DashboardModulesGrid, RamUsageBar, CommitCalendar, AppIcon
│   ├── constants/                  # Swiss-minimalist OLED dark THEME & LAYOUT tokens
│   ├── lib/                        # Planner, GitHub API, pipelined committer, scheduler, root bridges, memory-stats
│   ├── native-android/             # Tracked Kotlin modules & Magisk shell scripts (synced via config plugin)
│   ├── plugins/                    # Expo config plugin copying native-android/ into android/
│   └── README.md                   # Mobile-specific build & S8+ guide
├── streak-keeper/                  # Server-side Node.js streak engine + systemd timers
├── PRIVATE.md.example
└── README.md                       # You are here
```

---

<p align="center">
  Built for green squares, quiet batteries, and zero wasted RAM.
</p>
