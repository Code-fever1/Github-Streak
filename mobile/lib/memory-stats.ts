import { NativeModules, Platform } from 'react-native';

export interface RamSnapshot {
  usedBytes: number;
  totalBytes: number;
  availBytes: number;
  percent: number;
  lowMemory: boolean;
  source: 'android' | 'web-heap' | 'web-estimate';
}

interface NativeMemoryInfo {
  totalBytes: number;
  usedBytes: number;
  availBytes: number;
  lowMemory: boolean;
}

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)} GB`;
  return `${Math.round(bytes / MIB)} MB`;
}

/** Read system RAM on Android via ActivityManager, or live browser heap/device memory on Web. */
export async function getRamSnapshot(): Promise<RamSnapshot | null> {
  if (Platform.OS === 'android') {
    try {
      const native = NativeModules.StreakKeeperNative as
        | { getMemoryInfo?: () => Promise<NativeMemoryInfo | null> }
        | undefined;
      const info = await native?.getMemoryInfo?.();
      if (!info || !Number.isFinite(info.totalBytes) || info.totalBytes <= 0) return null;
      const totalBytes = info.totalBytes;
      const usedBytes = Math.max(0, Math.min(totalBytes, info.usedBytes));
      const availBytes = Math.max(0, info.availBytes);
      const percent = Math.min(100, Math.max(0, Math.round((usedBytes / totalBytes) * 100)));
      return {
        usedBytes,
        totalBytes,
        availBytes,
        percent,
        lowMemory: Boolean(info.lowMemory),
        source: 'android',
      };
    } catch {
      return null;
    }
  }

  if (Platform.OS === 'web') {
    const perfMemory = (globalThis as { performance?: { memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number } } })
      .performance?.memory;
    const used = perfMemory?.usedJSHeapSize ?? 0;
    const total = perfMemory?.totalJSHeapSize ?? 0;
    if (used > 0 && total > 0) {
      const totalBytes = Math.max(total, used);
      const availBytes = Math.max(0, totalBytes - used);
      const percent = Math.min(100, Math.max(0, Math.round((used / totalBytes) * 100)));
      return {
        usedBytes: used,
        totalBytes,
        availBytes,
        percent,
        lowMemory: percent >= 85,
        source: 'web-heap',
      };
    }

    const deviceMemoryGb = (globalThis as { navigator?: { deviceMemory?: number } }).navigator?.deviceMemory;
    if (typeof deviceMemoryGb === 'number' && Number.isFinite(deviceMemoryGb) && deviceMemoryGb > 0) {
      const totalBytes = deviceMemoryGb * GIB;
      return {
        usedBytes: 0,
        totalBytes,
        availBytes: totalBytes,
        percent: 0,
        lowMemory: false,
        source: 'web-estimate',
      };
    }
  }

  return null;
}
