import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules, Platform } from 'react-native';

export type NotificationAlertMode = 'alarm' | 'ringtone' | 'notification';
export type UnreadDelayMinutes = 1 | 10 | 30;

export interface WatchedApp {
  package: string;
  label: string;
}

export interface NotificationAlertSettings {
  enabled: boolean;
  mode: NotificationAlertMode;
  vibrate: boolean;
  delayMinutes: UnreadDelayMinutes;
  watchedApps: WatchedApp[];
}

export interface RootMonitorStatus {
  installed: boolean;
  running: boolean;
  confirmed: boolean;
  pid: string;
  status: string;
  enabled: boolean;
  heartbeat: number;
  heartbeatAgeSec: number;
  watched: string[];
  activeMatches: number;
  lastFiredPkg: string;
  lastFiredAt: number;
}

const STORAGE_KEY = '@streak/notification-alerts';
const LEGACY_KEY = '@streak/fiverr-alerts';

const DEFAULTS: NotificationAlertSettings = {
  enabled: false,
  mode: 'alarm',
  vibrate: true,
  delayMinutes: 1,
  watchedApps: [],
};

function native() {
  return NativeModules.StreakKeeperNative as
    | {
        setNotificationAlertConfig?: (
          enabled: boolean,
          mode: string,
          vibrate: boolean,
          delayMinutes: number,
          packagesJson: string,
        ) => void;
        applyNotificationAlerts?: (
          enabled: boolean,
          mode: string,
          vibrate: boolean,
          delayMinutes: number,
          packagesJson: string,
        ) => Promise<boolean>;
        getRootMonitorStatus?: () => Promise<string>;
        setFiverrAlertConfig?: (enabled: boolean, mode: string, vibrate: boolean) => void;
        testFiverrAlert?: (mode: string, vibrate: boolean) => void;
        stopFiverrAlert?: () => void;
        isNotificationListenerEnabled?: () => Promise<boolean>;
        openNotificationListenerSettings?: () => void;
        getLaunchableApps?: () => Promise<WatchedApp[]>;
        isSuAvailable?: () => Promise<boolean>;
        isRootMonitorInstalled?: () => Promise<boolean>;
        installRootNotificationMonitor?: () => Promise<boolean>;
        uninstallRootNotificationMonitor?: () => Promise<boolean>;
      }
    | undefined;
}

export async function isSuAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await native()?.isSuAvailable?.()) ?? false;
  } catch {
    return false;
  }
}

export async function isRootMonitorInstalled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await native()?.isRootMonitorInstalled?.()) ?? false;
  } catch {
    return false;
  }
}

export async function installRootNotificationMonitor(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  await saveNotificationAlertSettings(await loadNotificationAlertSettings());
  try {
    return (await native()?.installRootNotificationMonitor?.()) ?? false;
  } catch {
    return false;
  }
}

export async function uninstallRootNotificationMonitor(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await native()?.uninstallRootNotificationMonitor?.()) ?? false;
  } catch {
    return false;
  }
}

function packagesJson(apps: WatchedApp[]): string {
  return JSON.stringify(apps.map((a) => a.package));
}

async function migrateLegacy(): Promise<NotificationAlertSettings | null> {
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacy) return null;
  try {
    const parsed = JSON.parse(legacy) as Partial<NotificationAlertSettings>;
    return {
      ...DEFAULTS,
      enabled: parsed.enabled ?? false,
      mode: (parsed.mode as NotificationAlertMode) ?? 'alarm',
      vibrate: parsed.vibrate ?? true,
      delayMinutes: 1,
      watchedApps: [{ package: 'com.fiverr.fiverr', label: 'Fiverr' }],
    };
  } catch {
    return null;
  }
}

export async function loadNotificationAlertSettings(): Promise<NotificationAlertSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const migrated = await migrateLegacy();
    if (migrated) {
      await saveNotificationAlertSettings(migrated);
      return migrated;
    }
    return { ...DEFAULTS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationAlertSettings>;
    const delay = parsed.delayMinutes === 10 || parsed.delayMinutes === 30 ? parsed.delayMinutes : 1;
    return {
      enabled: parsed.enabled ?? DEFAULTS.enabled,
      mode: parsed.mode ?? DEFAULTS.mode,
      vibrate: parsed.vibrate ?? DEFAULTS.vibrate,
      delayMinutes: delay,
      watchedApps: Array.isArray(parsed.watchedApps) ? parsed.watchedApps : [],
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotificationAlertSettings(settings: NotificationAlertSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (Platform.OS === 'android') {
    const mod = native();
    const pkgs = packagesJson(settings.watchedApps);
    if (mod?.applyNotificationAlerts) {
      await mod
        .applyNotificationAlerts(
          settings.enabled,
          settings.mode,
          settings.vibrate,
          settings.delayMinutes,
          pkgs,
        )
        .catch(() => {});
    } else {
      mod?.setNotificationAlertConfig?.(
        settings.enabled,
        settings.mode,
        settings.vibrate,
        settings.delayMinutes,
        pkgs,
      );
    }
  }
}

export async function getRootMonitorStatus(): Promise<RootMonitorStatus | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const raw = await native()?.getRootMonitorStatus?.();
    if (!raw) return null;
    return JSON.parse(raw) as RootMonitorStatus;
  } catch {
    return null;
  }
}

export async function fetchLaunchableApps(): Promise<WatchedApp[]> {
  if (Platform.OS !== 'android') return [];
  try {
    const rows = await native()?.getLaunchableApps?.();
    return rows ?? [];
  } catch {
    return [];
  }
}

export async function isNotificationListenerEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await native()?.isNotificationListenerEnabled?.()) ?? false;
  } catch {
    return false;
  }
}

export function openNotificationListenerSettings(): void {
  if (Platform.OS !== 'android') return;
  native()?.openNotificationListenerSettings?.();
}

export function testNotificationAlert(settings: Pick<NotificationAlertSettings, 'mode' | 'vibrate'>): void {
  if (Platform.OS !== 'android') return;
  native()?.testFiverrAlert?.(settings.mode, settings.vibrate);
}

export function stopNotificationAlert(): void {
  if (Platform.OS !== 'android') return;
  native()?.stopFiverrAlert?.();
}

export function onAppForeground(handler: () => void): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') handler();
  });
  return () => sub.remove();
}
