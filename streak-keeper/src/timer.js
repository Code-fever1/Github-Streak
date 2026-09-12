export const DEFAULT_SCHEDULE = {
  minPerHour: 1,
  maxPerHour: 5,
  dailyMin: 24,
  dailyMax: 100,
  quietDayChance: 0.18,
  quietDayMax: 16,
};

export const DEFAULT_TIMER = {
  mode: 'interval',
  intervalMinutes: 60,
};

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function timeKey(d = new Date()) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function currentFixedSlot(now = new Date()) {
  return `${todayKey(now)}-${timeKey(now)}`;
}

export function commitsForCurrentHour(plan, now = new Date()) {
  return Math.max(0, plan.hours[now.getHours()] ?? 0);
}

export function commitsForScheduledTick(project, plan, now = new Date()) {
  const hourCommits = commitsForCurrentHour(plan, now);
  if (hourCommits <= 0) return 0;

  if (project.timer?.mode === 'interval') {
    const ticksPerHour = Math.max(1, Math.floor(60 / (project.timer.intervalMinutes || 60)));
    const perTick = Math.max(1, Math.ceil(hourCommits / ticksPerHour));
    return Math.min(perTick, project.schedule?.maxPerHour ?? 5);
  }

  return hourCommits;
}

export function shouldRunTick(project, lastTickAt, now = new Date(), lastFixedSlot = null) {
  if (!project.enabled) return false;
  const timer = project.timer || DEFAULT_TIMER;

  if (timer.mode === 'fixed_times') {
    const nowKey = timeKey(now);
    const times = timer.fixedTimes ?? [];
    if (!times.includes(nowKey)) return false;
    const slot = `${todayKey(now)}-${nowKey}`;
    return lastFixedSlot !== slot;
  }

  const intervalMs = (timer.intervalMinutes || 60) * 60 * 1000;
  if (!lastTickAt) return true;
  return now.getTime() - new Date(lastTickAt).getTime() >= intervalMs;
}

export function msUntilNextTick(project, lastTickAt, now = new Date()) {
  const timer = project.timer || DEFAULT_TIMER;

  if (timer.mode === 'fixed_times') {
    const times = (timer.fixedTimes ?? [])
      .map((value) => {
        const [h, m] = value.split(':').map((x) => parseInt(x, 10));
        return h * 60 + (m || 0);
      })
      .sort((a, b) => a - b);
    if (times.length === 0) return 60 * 60 * 1000;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const next = times.find((t) => t > nowMins);
    const target = new Date(now);
    if (next !== undefined) {
      target.setHours(Math.floor(next / 60), next % 60, 0, 0);
    } else {
      const first = times[0];
      target.setDate(target.getDate() + 1);
      target.setHours(Math.floor(first / 60), first % 60, 0, 0);
    }
    return target.getTime() - now.getTime();
  }

  const intervalMs = (timer.intervalMinutes || 60) * 60 * 1000;
  if (!lastTickAt) return intervalMs;
  return Math.max(0, intervalMs - (now.getTime() - new Date(lastTickAt).getTime()));
}
