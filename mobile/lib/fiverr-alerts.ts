import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules, Platform } from 'react-native';

export type FiverrAlertMode = 'alarm' | 'ringtone' | 'notification';

export interface FiverrAlertSettings {
  enabled: boolean;
  mode: FiverrAlertMode;
  vibrate: boolean;
}

const STORAGE_KEY = '@streak/fiverr-alerts';

const DEFAULTS: FiverrAlertSettings = {
  enabled: false,
  mode: 'alarm',
  vibrate: true,
};

function native() {
  return NativeModules.StreakKeeperNative as
    | {
        setFiverrAlertConfig?: (enabled: boolean, mode: string, vibrate: boolean) => void;
        testFiverrAlert?: (mode: string, vibrate: boolean) => void;
        stopFiverrAlert?: () => void;
        isNotificationListenerEnabled?: () => Promise<boolean>;
        openNotificationListenerSettings?: () => void;
      }
    | undefined;
}

export async function loadFiverrAlertSettings(): Promise<FiverrAlertSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<FiverrAlertSettings>;
    return {
      enabled: parsed.enabled ?? DEFAULTS.enabled,
      mode: parsed.mode ?? DEFAULTS.mode,
      vibrate: parsed.vibrate ?? DEFAULTS.vibrate,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveFiverrAlertSettings(settings: FiverrAlertSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (Platform.OS === 'android') {
    native()?.setFiverrAlertConfig?.(settings.enabled, settings.mode, settings.vibrate);
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

export function testFiverrAlert(settings: Pick<FiverrAlertSettings, 'mode' | 'vibrate'>): void {
  if (Platform.OS !== 'android') return;
  native()?.testFiverrAlert?.(settings.mode, settings.vibrate);
}

export function stopFiverrAlert(): void {
  if (Platform.OS !== 'android') return;
  native()?.stopFiverrAlert?.();
}

/** Re-check listener access when returning from system settings. */
export function onAppForeground(handler: () => void): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') handler();
  });
  return () => sub.remove();
}
