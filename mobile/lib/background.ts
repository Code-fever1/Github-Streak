import { AppRegistry, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { commitsMadeToday } from './planner';
import { subscribePipeline } from './pipeline';
import { runDueTicks } from './scheduler';
import { loadProjects, getTodayPlan } from './storage';
import { markCommittedToday, publishSendStatus, scheduleDayReminders, startKeeperService } from './device-notify';

export const BACKGROUND_TASK = 'streak-keeper-sync';
const HEADLESS_TASK = 'StreakKeeperTask';

async function runKeeperTick() {
  await runDueTicks();
  publishSendStatus();
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      await runKeeperTick();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  AppRegistry.registerHeadlessTask(HEADLESS_TASK, () => async () => {
    await runKeeperTick();
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
    // continue; the service still starts
  }
  startKeeperService();
  publishSendStatus();
  scheduleDayReminders();
  const projects = await loadProjects();
  for (const project of projects) {
    const plan = await getTodayPlan(project);
    if (commitsMadeToday(plan) > 0) {
      markCommittedToday();
      break;
    }
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
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) return;
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    if (!registered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {
    // Background fetch is a backup; the foreground service is the real path.
  }
}
