import { NativeModules, Platform } from 'react-native';
import { listPipelines } from './pipeline';
import { msUntilNextGlobalTick } from './planner';
import { loadAllLastTicks, loadProjects, loadQueue } from './storage';

function native() {
  return NativeModules.StreakKeeperNative as
    | {
        startService?: () => void;
        stopService?: (exitIfBackground: boolean) => void;
        scheduleNextWake?: (triggerAtMs: number) => void;
        updateStatus?: (status: string) => void;
        markCommittedToday?: () => void;
        scheduleReminders?: () => void;
        isIgnoringBatteryOptimizations?: () => Promise<boolean>;
        requestIgnoreBatteryOptimizations?: () => void;
      }
    | undefined;
}

export function formatSendStatus(): string {
  const rows = listPipelines();
  const queued = rows.reduce((sum, row) => sum + row.queued, 0);
  const writing = rows.reduce((sum, row) => sum + row.writing, 0);
  const pushing = rows.reduce((sum, row) => sum + row.waitingPush + row.pushing, 0);
  if (queued + writing + pushing === 0) return 'Idle · nothing waiting to send';
  const parts: string[] = [];
  if (queued > 0) parts.push(`Queued ${queued}`);
  if (writing > 0) parts.push(`Writing ${writing}`);
  if (pushing > 0) parts.push(`Pushing ${pushing}`);
  return parts.join(' · ');
}

export function publishSendStatus(status = formatSendStatus()): void {
  if (Platform.OS !== 'android') return;
  native()?.updateStatus?.(status);
}

export function markCommittedToday(): void {
  if (Platform.OS !== 'android') return;
  native()?.markCommittedToday?.();
}

export function scheduleDayReminders(): void {
  if (Platform.OS !== 'android') return;
  native()?.scheduleReminders?.();
}

export function startKeeperService(): void {
  if (Platform.OS !== 'android') return;
  native()?.startService?.();
}

export function stopKeeperService(exitIfBackground = false): void {
  if (Platform.OS !== 'android') return;
  native()?.stopService?.(exitIfBackground);
}

export function scheduleNextWake(triggerAtMs: number): void {
  if (Platform.OS !== 'android') return;
  native()?.scheduleNextWake?.(triggerAtMs);
}

/** Schedule an exact Android wake-up alarm for the next pending queue retry or scheduled commit slot. */
export async function syncNextWakeAlarm(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const [projects, queue] = await Promise.all([loadProjects(), loadQueue()]);
    const hasPending = queue.some((j) => !j.lastError && j.n > 0);
    if (hasPending) {
      scheduleNextWake(Date.now() + 5 * 60_000);
      return;
    }
    const enabled = projects.filter((p) => p.enabled);
    if (enabled.length === 0) {
      scheduleNextWake(0);
      return;
    }
    const lastTicks = await loadAllLastTicks(enabled);
    const ms = msUntilNextGlobalTick(enabled, lastTicks, new Date());
    scheduleNextWake(Date.now() + Math.max(30_000, ms));
  } catch {
    // Ignore wake-sync errors so foreground actions stay non-blocking.
  }
}
