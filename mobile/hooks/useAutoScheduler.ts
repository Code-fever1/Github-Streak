import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { flushQueue, runDueTicks } from '@/lib/scheduler';
import { isOnline } from '@/lib/offline';
import { useProjects } from '@/context/ProjectsContext';

export function useAutoScheduler() {
  const { refresh } = useProjects();
  const busy = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        await runDueTicks();
        await refresh();
      } finally {
        busy.current = false;
      }
    };

    tick();
    const interval = setInterval(tick, 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        isOnline()
          .then((ok) => (ok ? flushQueue() : Promise.resolve()))
          .then(() => refresh())
          .catch(() => {});
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);
}
