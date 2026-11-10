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
  const maxPages = 30;

  while (page <= maxPages) {
    const url =
      `https://api.github.com/repos/${project.owner}/${project.repo}/commits` +
      `?sha=${encodeURIComponent(project.branch)}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers: await headers(project) });
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
