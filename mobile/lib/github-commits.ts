import { getGithubToken } from './storage';
import type { Project } from './types';

export interface DayCommitStats {
  date: string;
  total: number;
  app: number;
  other: number;
}

interface GithubCommitItem {
  sha: string;
  commit: {
    author: { name?: string; email?: string; date?: string };
    committer: { date?: string };
  };
}

function dateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isAppAuthor(email: string | undefined, project: Project): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return e.length > 0 && e === project.authorEmail.trim().toLowerCase();
}

async function headers(project: Project): Promise<Record<string, string>> {
  const token = await getGithubToken(project.id);
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Walk branch history (newest first) back to `since`, grouped by author date in local TZ. */
export async function fetchBranchCommitDays(
  project: Project,
  since: Date,
): Promise<DayCommitStats[]> {
  const token = await getGithubToken(project.id);
  if (!token) {
    throw new Error('Add a GitHub token on this project to load commit history from GitHub.');
  }

  const map = new Map<string, DayCommitStats>();
  const sinceMs = since.getTime();
  let page = 1;
  const perPage = 100;
  const maxPages = 8;

  while (page <= maxPages) {
    const url =
      `https://api.github.com/repos/${project.owner}/${project.repo}/commits` +
      `?sha=${encodeURIComponent(project.branch)}&per_page=${perPage}&page=${page}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch(url, { headers: await headers(project), signal: ctrl.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      let msg = `GitHub commits API failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) msg = `${msg}: ${body.message}`;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    const batch = (await res.json()) as GithubCommitItem[];
    if (batch.length === 0) break;

    let reachedOld = false;
    for (const item of batch) {
      const iso = item.commit.author?.date ?? item.commit.committer?.date;
      if (!iso) continue;
      const t = new Date(iso).getTime();
      if (t < sinceMs) {
        reachedOld = true;
        continue;
      }
      const key = dateKeyFromIso(iso);
      const row = map.get(key) ?? { date: key, total: 0, app: 0, other: 0 };
      row.total += 1;
      if (isAppAuthor(item.commit.author?.email, project)) row.app += 1;
      else row.other += 1;
      map.set(key, row);
    }

    if (reachedOld || batch.length < perPage) break;
    page += 1;
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeCommitDays(rows: DayCommitStats[][]): DayCommitStats[] {
  const map = new Map<string, DayCommitStats>();
  for (const list of rows) {
    for (const row of list) {
      const cur = map.get(row.date) ?? { date: row.date, total: 0, app: 0, other: 0 };
      cur.total += row.total;
      cur.app += row.app;
      cur.other += row.other;
      map.set(row.date, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function todayKeyLocal(d = new Date()): string {
  return dateKeyFromIso(d.toISOString());
}

export function commitsOnDay(days: DayCommitStats[], date: string): DayCommitStats | null {
  return days.find((d) => d.date === date) ?? null;
}

export function historySinceDays(daysBack: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d;
}

export interface StreakDayCell {
  date: string;
  shortDay: string;
  total: number;
  app: number;
  other: number;
  isToday: boolean;
}

export interface StreakSummary {
  currentStreak: number;
  bestStreak: number;
  todaySecured: boolean;
  todayTotal: number;
  todayApp: number;
  todayOther: number;
  last7Days: StreakDayCell[];
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalKey(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => Number(n));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Compute current/best streaks and the trailing 7-day breakdown from GitHub branch stats. */
export function computeStreakSummary(days: DayCommitStats[], now = new Date()): StreakSummary {
  const byDate = new Map<string, DayCommitStats>(days.map((d) => [d.date, d]));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = localKey(today);
  const todayStats = byDate.get(todayKey);

  const todayTotal = todayStats?.total ?? 0;
  const todayApp = todayStats?.app ?? 0;
  const todayOther = todayStats?.other ?? 0;
  const todaySecured = todayTotal > 0;

  let currentStreak = 0;
  const cursor = new Date(today);
  if (!todaySecured) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 366; i++) {
    const entry = byDate.get(localKey(cursor));
    if (!entry || entry.total <= 0) break;
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const activeDates = days
    .filter((d) => d.total > 0)
    .map((d) => d.date)
    .sort((a, b) => a.localeCompare(b));

  let bestStreak = currentStreak;
  let run = 0;
  let expectedNextKey: string | null = null;
  for (const key of activeDates) {
    if (key === expectedNextKey) {
      run += 1;
    } else if (run === 0 || key > (expectedNextKey ?? '')) {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    const nextDate = parseLocalKey(key);
    nextDate.setDate(nextDate.getDate() + 1);
    expectedNextKey = localKey(nextDate);
  }

  const last7Days: StreakDayCell[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const key = localKey(d);
    const stats = byDate.get(key);
    last7Days.push({
      date: key,
      shortDay: SHORT_DAYS[d.getDay()],
      total: stats?.total ?? 0,
      app: stats?.app ?? 0,
      other: stats?.other ?? 0,
      isToday: offset === 0,
    });
  }

  return {
    currentStreak,
    bestStreak,
    todaySecured,
    todayTotal,
    todayApp,
    todayOther,
    last7Days,
  };
}
