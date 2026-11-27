import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

import { isSuAvailable } from '@/lib/notification-alerts';

export interface ChargeHoldSettings {
  enabled: boolean;
  /** Stop charging at this percent. */
  cap: number;
  /** Start charging again at this percent. */
  lower: number;
  resumeDelta: number;
  pollSec: number;
  chargeSwitch: string;
}

export interface ChargeHoldNode {
  path: string;
  writable: boolean;
  value: string;
}

export interface ChargeHoldProbeResult {
  su: boolean;
  nodes: ChargeHoldNode[];
}

export interface ChargeHoldStatus {
  installed: string;
  running?: string;
  pid?: string;
  enabled: string;
  level: string;
  plugged_ac: string;
  plugged_usb: string;
  status: string;
  charge_switch: string;
  switch_value: string;
  daemon_state: string;
}

const STORAGE_KEY = '@streak/charge-hold';

const MIN_CHARGE_GAP = 8;

const DEFAULTS: ChargeHoldSettings = {
  enabled: false,
  cap: 60,
  lower: 50,
  resumeDelta: 10,
  pollSec: 30,
  chargeSwitch: 'auto',
};

function native() {
  return NativeModules.StreakKeeperNative as
    | {
        setChargeHoldConfig?: (
          enabled: boolean,
          cap: number,
          lower: number,
          pollSec: number,
          chargeSwitch: string,
        ) => void;
        probeChargeHoldNodes?: () => Promise<string>;
        getChargeHoldStatus?: () => Promise<string>;
        isChargeHoldInstalled?: () => Promise<boolean>;
        installChargeHoldDaemon?: () => Promise<boolean>;
        uninstallChargeHoldDaemon?: () => Promise<boolean>;
        applyChargeHold?: (
          enabled: boolean,
          cap: number,
          lower: number,
          pollSec: number,
        ) => Promise<boolean>;
      }
    | undefined;
}

export async function loadChargeHoldSettings(): Promise<ChargeHoldSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<ChargeHoldSettings>;
    const cap = clamp(parsed.cap ?? DEFAULTS.cap, 30, 100);
    const lower = clamp(parsed.lower ?? cap - Math.max(parsed.resumeDelta ?? 10, MIN_CHARGE_GAP), 20, cap - MIN_CHARGE_GAP);
    return {
      enabled: parsed.enabled ?? DEFAULTS.enabled,
      cap,
      lower,
      resumeDelta: cap - lower,
      pollSec: clamp(parsed.pollSec ?? DEFAULTS.pollSec, 5, 120),
      chargeSwitch: parsed.chargeSwitch ?? DEFAULTS.chargeSwitch,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function normalize(settings: ChargeHoldSettings): ChargeHoldSettings {
  const cap = clamp(settings.cap, 30, 100);
  const lower = clamp(settings.lower, 20, cap - MIN_CHARGE_GAP);
  return {
    ...settings,
    cap,
    lower,
    resumeDelta: cap - lower,
    pollSec: clamp(settings.pollSec, 5, 120),
  };
}

export async function saveChargeHoldSettings(settings: ChargeHoldSettings): Promise<void> {
  const normalized = normalize(settings);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (Platform.OS === 'android') {
    native()?.setChargeHoldConfig?.(
      normalized.enabled,
      normalized.cap,
      normalized.lower,
      normalized.pollSec,
      normalized.chargeSwitch,
    );
  }
}

export async function probeChargeHoldNodes(): Promise<ChargeHoldProbeResult> {
  if (Platform.OS !== 'android') return { su: false, nodes: [] };
  try {
    const raw = (await native()?.probeChargeHoldNodes?.()) ?? '{"su":false,"nodes":[]}';
    return JSON.parse(raw) as ChargeHoldProbeResult;
  } catch {
    return { su: false, nodes: [] };
  }
}

export async function getChargeHoldStatus(): Promise<ChargeHoldStatus | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const raw = await native()?.getChargeHoldStatus?.();
    if (!raw) return null;
    return JSON.parse(raw) as ChargeHoldStatus;
  } catch {
    return null;
  }
}

export async function isChargeHoldInstalled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await native()?.isChargeHoldInstalled?.()) ?? false;
  } catch {
    return false;
  }
}

async function chargeHoldLooksApplied(settings: ChargeHoldSettings): Promise<boolean> {
  const status = await getChargeHoldStatus();
  if (!status) return false;
  const want = settings.enabled ? '1' : '0';
  if (status.enabled === want) return true;
  if (!settings.enabled && status.daemon_state.startsWith('off')) return true;
  if (settings.enabled && status.daemon_state.length > 0 && status.daemon_state !== 'no_config') return true;
  return false;
}

export async function applyChargeHold(settings: ChargeHoldSettings): Promise<boolean> {
  const normalized = normalize(settings);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (Platform.OS !== 'android') return false;
  if (!(await isSuAvailable())) return false;
  try {
    const direct =
      (await native()?.applyChargeHold?.(
        normalized.enabled,
        normalized.cap,
        normalized.lower,
        normalized.pollSec,
      )) ?? false;
    if (direct) return true;
    await new Promise((r) => setTimeout(r, 1200));
    return chargeHoldLooksApplied(normalized);
  } catch {
    return chargeHoldLooksApplied(normalized);
  }
}

export async function installChargeHoldDaemon(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const settings = await loadChargeHoldSettings();
  await saveChargeHoldSettings(settings);
  try {
    return (await native()?.installChargeHoldDaemon?.()) ?? false;
  } catch {
    return false;
  }
}

export async function uninstallChargeHoldDaemon(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await native()?.uninstallChargeHoldDaemon?.()) ?? false;
  } catch {
    return false;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const CAP_PRESETS = [50, 60, 70, 80, 85, 90] as const;
export const LOWER_PRESETS = [40, 45, 50, 55, 60, 70] as const;
export { MIN_CHARGE_GAP };
