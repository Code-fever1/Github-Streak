import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { syncNextWakeAlarm } from '@/lib/device-notify';
import { isOnline } from '@/lib/offline';
import { flushQueue, runDueTicks } from '@/lib/scheduler';
import { useProjects } from '@/context/ProjectsContext';

export function useAutoScheduler() {
  const { refresh, loading } = useProjects();
  const busy = useRef(false);

  useEffect(() => {
    if (loading) return;
    let first: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (busy.current || AppState.currentState !== 'active') return;
      busy.current = true;
      try {
        const ran = await runDueTicks();
        if (ran) await refresh();
      } finally {
        busy.current = false;
      }
    };

    const startForegroundLoop = () => {
      if (first) clearTimeout(first);
      if (interval) clearInterval(interval);
      first = setTimeout(tick, 8_000);
      interval = setInterval(tick, 60_000);
    };

    const stopForegroundLoop = () => {
      if (first) {
        clearTimeout(first);
        first = null;
      }
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    if (AppState.currentState === 'active') {
      startForegroundLoop();
    }

    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        startForegroundLoop();
        isOnline()
          .then((ok) => (ok ? flushQueue() : Promise.resolve()))
          .then(() => refresh())
          .catch(() => {});
      } else {
        stopForegroundLoop();
        syncNextWakeAlarm().catch(() => {});
      }
    });

    return () => {
      stopForegroundLoop();
      sub.remove();
    };
  }, [loading, refresh]);
}
