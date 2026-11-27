import { AppRegistry, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { commitsMadeToday } from './planner';
import { subscribePipeline } from './pipeline';
import { runDueTicks } from './scheduler';
import { loadProjects, getTodayPlan } from './storage';
import { applyChargeHold, getChargeHoldStatus, loadChargeHoldSettings } from './charge-hold';
import {
  getRootMonitorStatus,
  isSuAvailable,
  loadNotificationAlertSettings,
  saveNotificationAlertSettings,
} from './notification-alerts';
import {
  markCommittedToday,
  publishSendStatus,
  scheduleDayReminders,
  stopKeeperService,
  syncNextWakeAlarm,
} from './device-notify';

export const BACKGROUND_TASK = 'streak-keeper-sync';
const HEADLESS_TASK = 'StreakKeeperTask';

export { syncNextWakeAlarm };

async function runKeeperTick() {
  await runDueTicks();
  publishSendStatus();
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      await runKeeperTick();
      await syncNextWakeAlarm();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    } finally {
      stopKeeperService(true);
    }
  });

  AppRegistry.registerHeadlessTask(HEADLESS_TASK, () => async () => {
    console.log('[Veyon] StreakKeeperTask start');
    try {
      await runKeeperTick();
    } finally {
      await syncNextWakeAlarm().catch(() => {});
      console.log('[Veyon] StreakKeeperTask done; scheduling next wake and exiting');
      stopKeeperService(true);
    }
  });
}

if (Platform.OS === 'android') {
  subscribePipeline(() => {
    publishSendStatus();
  });
}

async function startAndroidKeeper(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if (Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
  } catch {
    // continue; reminders & alarms still register
  }
  scheduleDayReminders();
  const projects = await loadProjects();
  for (const project of projects) {
    const plan = await getTodayPlan(project);
    if (commitsMadeToday(plan) > 0) {
      markCommittedToday();
      break;
    }
  }
  await syncNextWakeAlarm();
  try {
    if (await isSuAvailable()) {
      const [charge, cStat, alerts, rStat] = await Promise.all([
        loadChargeHoldSettings(),
        getChargeHoldStatus(),
        loadNotificationAlertSettings(),
        getRootMonitorStatus(),
      ]);
      if (charge.enabled) {
        await applyChargeHold(charge);
      } else if (cStat?.running === '1') {
        await applyChargeHold(charge);
      }
      if (alerts.enabled && !rStat?.confirmed) {
        await saveNotificationAlertSettings(alerts);
      }
    }
  } catch {
    // Non-fatal: root daemon sync is best-effort on launch.
  }
}

export async function ensureUnrestrictedBattery(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const native = NativeModules.StreakKeeperNative;
  if (!native?.isIgnoringBatteryOptimizations) return;
  try {
    const ignoring = await native.isIgnoringBatteryOptimizations();
    if (!ignoring) native.requestIgnoreBatteryOptimizations();
  } catch {
    // ignore
  }
}

export async function registerBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  await startAndroidKeeper();
  try {
    // Replace any legacy polling BackgroundFetch task with exact wake alarms.
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    if (registered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK).catch(() => {});
    }
  } catch {
    // Ignore if TaskManager is unavailable.
  }
}
