export interface ScheduleConfig {
  minPerHour: number;
  maxPerHour: number;
  dailyMin: number;
  dailyMax: number;
  quietDayChance: number;
  quietDayMax: number;
}

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  minPerHour: 1,
  maxPerHour: 5,
  dailyMin: 24,
  dailyMax: 100,
  quietDayChance: 0.18,
  quietDayMax: 16,
};

export type TimerMode = 'interval' | 'fixed_times';

export interface TimerConfig {
  mode: TimerMode;
  /** 15, 30, 60, 120, etc. Used when mode is interval. */
  intervalMinutes: number;
  /** e.g. ["09:00", "14:00", "20:00"] when mode is fixed_times. */
  fixedTimes?: string[];
}

export const DEFAULT_TIMER: TimerConfig = {
  mode: 'interval',
  intervalMinutes: 60,
};

export const TIMER_INTERVAL_OPTIONS = [15, 30, 60, 120, 240] as const;

export type AuthType = 'token' | 'ssh';

export interface DailyPlan {
  date: string;
  isQuiet: boolean;
  target: number;
  total: number;
  hours: number[];
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  owner: string;
  repo: string;
  authorName: string;
  authorEmail: string;
  branch: string;
  enabled: boolean;
  authType: AuthType;
  /** OpenSSH public key fingerprint (ssh mode). */
  sshPublicKey?: string;
  schedule: ScheduleConfig;
  timer: TimerConfig;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  projectName: string;
  message: string;
  commits: number;
  timestamp: string;
  success: boolean;
  manual?: boolean;
  error?: string;
}

export interface CounterState {
  total: number;
  daily: Record<string, number>;
  lastUpdated: string | null;
}

/** Migrate projects saved before auth/timer fields existed. */
export function normalizeProject(raw: Partial<Project> & Pick<Project, 'id' | 'owner' | 'repo'>): Project {
  return {
    id: raw.id,
    name: raw.name ?? `${raw.owner}/${raw.repo}`,
    owner: raw.owner,
    repo: raw.repo,
    authorName: raw.authorName ?? 'streak-keeper',
    authorEmail: raw.authorEmail ?? 'streak-keeper@users.noreply.github.com',
    branch: raw.branch ?? 'main',
    enabled: raw.enabled ?? true,
    authType: raw.authType ?? 'ssh',
    sshPublicKey: raw.sshPublicKey,
    schedule: raw.schedule ?? DEFAULT_SCHEDULE,
    timer: raw.timer ?? DEFAULT_TIMER,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}
