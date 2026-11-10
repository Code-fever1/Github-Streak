import { NativeModules, Platform } from 'react-native';
import { listPipelines } from './pipeline';

function native() {
  return NativeModules.StreakKeeperNative as
    | {
        startService?: () => void;
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
