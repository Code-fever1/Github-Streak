# Veyon native Android (tracked source)

Kotlin modules and root shell assets for `StreakKeeperNative`. Copied into `android/app/src/main/` when you run `npx expo prebuild` (see `plugins/withStreakKeeperNative.js`).

After changing files here, sync a local tree with:

```bash
cp -a native-android/app/src/main/java/com/streakkeeper/mobile/*.kt android/app/src/main/java/com/streakkeeper/mobile/
cp -a native-android/app/src/main/assets/*.sh android/app/src/main/assets/
```
