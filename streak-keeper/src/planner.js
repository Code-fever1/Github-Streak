import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { log, dbg } from './logger.js';

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Build a realistic 24-hour commit plan for one day.
// Each entry is the number of commits to make during that hour (0..maxPerHour).
// The day has an overall "intensity" so totals vary realistically between
// dailyMin and dailyMax, with occasional quiet days (low totals) so the
// contribution graph does not look mechanical.
export function buildDailyPlan(schedule, date = new Date()) {
  const {
    minPerHour = 1,
    maxPerHour = 5,
    dailyMin = 24,
    dailyMax = 100,
    quietDayChance = 0.18,
    quietDayMax = 16,
  } = schedule;

  const isQuiet = Math.random() < quietDayChance;

  // Pick a daily target.
  let target;
  if (isQuiet) {
    target = randInt(1, quietDayMax);
  } else {
    target = randInt(dailyMin, dailyMax);
  }

  // Activity windows: realistic humans are not active 24h.
  // Build a set of "active hours" weighted toward daytime/evening.
  const hours = Array.from({ length: 24 }, () => 0);
  const awakeStart = randInt(7, 9); // wake up
  const awakeEnd = randInt(22, 25); // sleep (25 == 1am)
  const lunchBreak = Math.random() < 0.5;
  const eveningPeak = Math.random() < 0.7;

  // Weights per hour.
  const weights = hours.map((_, h) => {
    if (h < awakeStart || h >= awakeEnd) return 0.05; // late night, rare
    if (lunchBreak && h === 12) return 0.2;
    if (eveningPeak && h >= 18 && h <= 22) return 1.6;
    return 1.0;
  });

  // Distribute `target` commits across active hours, capped at maxPerHour each.
  let remaining = target;
  // First pass: give every active hour at least minPerHour (if budget allows).
  const activeHours = hours.map((_, h) => h).filter((h) => weights[h] > 0.1);
  // Shuffle active hours by weight (descending) for fairness.
  activeHours.sort((a, b) => weights[b] - weights[a]);

  for (const h of activeHours) {
    if (remaining <= 0) break;
    const give = Math.min(minPerHour, remaining);
    hours[h] = give;
    remaining -= give;
  }

  // Second pass: spread the rest weighted by activity, capped at maxPerHour.
  let guard = 0;
  while (remaining > 0 && guard < 1000) {
    guard++;
    // Weighted random pick of an hour that still has room.
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
  const plan = {
    date: todayKey(date),
    isQuiet,
    target,
    total,
    hours,
    createdAt: new Date().toISOString(),
  };
  dbg(`Built plan for ${plan.date}: target=${target} total=${total} quiet=${isQuiet} hours=${hours.join(',')}`);
  return plan;
}

export class Planner {
  constructor(config) {
    this.config = config;
    this.stateDir = resolve(config.stateDir);
    this.schedule = config.schedule;
    mkdirSync(this.stateDir, { recursive: true });
  }

  statePath() {
    return resolve(this.stateDir, `plan-${todayKey()}.json`);
  }

  // Get today's plan, creating it on first run of the day.
  getTodayPlan() {
    const path = this.statePath();
    if (existsSync(path)) {
      try {
        const plan = JSON.parse(readFileSync(path, 'utf8'));
        if (plan.date === todayKey()) return plan;
      } catch {
        // corrupt file, regenerate
      }
    }
    const plan = buildDailyPlan(this.schedule);
    writeFileSync(path, JSON.stringify(plan, null, 2));
    log(`Generated new daily plan for ${plan.date}: ${plan.total} commits (quiet=${plan.isQuiet}).`);
    return plan;
  }

  // How many commits should happen during the current hour?
  commitsForCurrentHour(plan) {
    const now = new Date();
    const hour = now.getHours();
    const remaining = plan.hours[hour];
    return Math.max(0, remaining);
  }

  // Record that we made N commits this hour so we don't exceed the plan.
  recordCommits(plan, n) {
    const now = new Date();
    const hour = now.getHours();
    plan.hours[hour] = Math.max(0, plan.hours[hour] - n);
    plan.total = plan.hours.reduce((s, x) => s + x, 0);
    writeFileSync(this.statePath(), JSON.stringify(plan, null, 2));
  }
}
