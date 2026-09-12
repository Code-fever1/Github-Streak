import type { DailyPlan, Project, ScheduleConfig, TimerConfig } from './types';

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeKey(d = new Date()): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function buildDailyPlan(schedule: ScheduleConfig, date = new Date()): DailyPlan {
  const {
    minPerHour = 1,
    maxPerHour = 5,
    dailyMin = 24,
    dailyMax = 100,
    quietDayChance = 0.18,
    quietDayMax = 16,
  } = schedule;

  const isQuiet = Math.random() < quietDayChance;
  const target = isQuiet ? randInt(1, quietDayMax) : randInt(dailyMin, dailyMax);

  const hours = Array.from({ length: 24 }, () => 0);
  const awakeStart = randInt(7, 9);
  const awakeEnd = randInt(22, 25);
  const lunchBreak = Math.random() < 0.5;
  const eveningPeak = Math.random() < 0.7;

  const weights = hours.map((_, h) => {
    if (h < awakeStart || h >= awakeEnd) return 0.05;
    if (lunchBreak && h === 12) return 0.2;
    if (eveningPeak && h >= 18 && h <= 22) return 1.6;
    return 1.0;
  });

  let remaining = target;
  const activeHours = hours.map((_, h) => h).filter((h) => weights[h] > 0.1);
  activeHours.sort((a, b) => weights[b] - weights[a]);

  for (const h of activeHours) {
    if (remaining <= 0) break;
    const give = Math.min(minPerHour, remaining);
    hours[h] = give;
    remaining -= give;
  }

  let guard = 0;
  while (remaining > 0 && guard < 1000) {
    guard++;
    const candidates = hours
      .map((count, h) => ({ h, room: maxPerHour - count, w: weights[h] }))
      .filter((c) => c.room > 0 && c.w > 0);
    if (candidates.length === 0) break;

    const totalW = candidates.reduce((s, c) => s + c.w, 0);
    let r = Math.random() * totalW;
    let chosen = candidates[0];
    for (const c of candidates) {
      r -= c.w;
      if (r <= 0) {
        chosen = c;
        break;
      }
    }
    const add = Math.min(chosen.room, remaining, randInt(1, maxPerHour));
    hours[chosen.h] += add;
    remaining -= add;
  }

  const total = hours.reduce((s, n) => s + n, 0);
  return {
    date: todayKey(date),
    isQuiet,
    target,
    total,
    hours,
    createdAt: new Date().toISOString(),
  };
}

export function commitsForCurrentHour(plan: DailyPlan, now = new Date()): number {
  const hour = now.getHours();
  return Math.max(0, plan.hours[hour]);
}

/** Commits to make on this scheduled tick (scaled for interval mode). */
export function commitsForScheduledTick(project: Project, plan: DailyPlan, now = new Date()): number {
  const hourCommits = commitsForCurrentHour(plan, now);
  if (hourCommits <= 0) return 0;

  if (project.timer.mode === 'interval') {
    const ticksPerHour = Math.max(1, Math.floor(60 / project.timer.intervalMinutes));
    const perTick = Math.max(1, Math.ceil(hourCommits / ticksPerHour));
    return Math.min(perTick, project.schedule.maxPerHour);
  }

  return hourCommits;
}

export function recordCommits(plan: DailyPlan, n: number, now = new Date()): DailyPlan {
  const hour = now.getHours();
  const hours = [...plan.hours];
  hours[hour] = Math.max(0, hours[hour] - n);
  const total = hours.reduce((s, x) => s + x, 0);
  return { ...plan, hours, total };
}

export function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(':').map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

export function shouldRunTick(
  project: Project,
  lastTickAt: string | null,
  now = new Date(),
  lastFixedSlot?: string | null,
): boolean {
  if (!project.enabled) return false;

  const timer = project.timer;

  if (timer.mode === 'fixed_times') {
    const nowKey = timeKey(now);
    const times = timer.fixedTimes ?? [];
    if (!times.includes(nowKey)) return false;
    const slot = `${todayKey(now)}-${nowKey}`;
    return lastFixedSlot !== slot;
  }

  const intervalMs = timer.intervalMinutes * 60 * 1000;
  if (!lastTickAt) return true;
  return now.getTime() - new Date(lastTickAt).getTime() >= intervalMs;
}

export function msUntilNextTick(
  project: Project,
  lastTickAt: string | null,
  now = new Date(),
): number {
  const timer = project.timer;

  if (timer.mode === 'fixed_times') {
    const times = (timer.fixedTimes ?? []).map(parseTimeToMinutes).sort((a, b) => a - b);
    if (times.length === 0) return msUntilNextHour(now);

    const nowMins = now.getHours() * 60 + now.getMinutes();
    const next = times.find((t) => t > nowMins);
    if (next !== undefined) {
      const target = new Date(now);
      target.setHours(Math.floor(next / 60), next % 60, 0, 0);
      return target.getTime() - now.getTime();
    }
    const first = times[0];
    const target = new Date(now);
    target.setDate(target.getDate() + 1);
    target.setHours(Math.floor(first / 60), first % 60, 0, 0);
    return target.getTime() - now.getTime();
  }

  const intervalMs = timer.intervalMinutes * 60 * 1000;
  if (!lastTickAt) return intervalMs;
  const elapsed = now.getTime() - new Date(lastTickAt).getTime();
  return Math.max(0, intervalMs - elapsed);
}

export function msUntilNextHour(now = new Date()): number {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() + 1);
  return next.getTime() - now.getTime();
}

/** Shortest next tick across enabled projects. */
export function msUntilNextGlobalTick(projects: Project[], lastTicks: Record<string, string | null>, now = new Date()): number {
  const enabled = projects.filter((p) => p.enabled);
  if (enabled.length === 0) return msUntilNextHour(now);
  return Math.min(...enabled.map((p) => msUntilNextTick(p, lastTicks[p.id] ?? null, now)));
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function timerLabel(project: Project): string {
  if (project.timer.mode === 'fixed_times') {
    return (project.timer.fixedTimes ?? []).join(', ') || 'No times set';
  }
  const m = project.timer.intervalMinutes;
  if (m < 60) return `Every ${m} min`;
  if (m === 60) return 'Every hour';
  return `Every ${m / 60}h`;
}

export { todayKey, timeKey };
