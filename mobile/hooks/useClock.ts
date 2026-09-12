import { useEffect, useState } from 'react';
import { formatCountdown, msUntilNextGlobalTick, msUntilNextTick } from '@/lib/planner';
import type { Project } from '@/lib/types';

export function useClock(projects: Project[] = [], lastTicks: Record<string, string | null> = {}) {
  const [now, setNow] = useState(new Date());
  const [countdown, setCountdown] = useState('00:00');

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setNow(d);
      const ms = projects.length > 0 ? msUntilNextGlobalTick(projects, lastTicks, d) : 60_000;
      setCountdown(formatCountdown(ms));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [projects, lastTicks]);

  const nextTickFor = (project: Project) =>
    formatCountdown(msUntilNextTick(project, lastTicks[project.id] ?? null, now));

  return { now, countdown, hour: now.getHours(), lastTicks, nextTickFor };
}
