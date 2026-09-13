import { AppState, type AppStateStatus } from 'react-native';
import { pushCommitsPipelined } from './committer';
import { isFastForwardError } from './github';
import { isOfflineError, isOnline } from './offline';
import {
  appendLog,
  clearCheckpoint,
  enqueue,
  getLastFixedSlot,
  getLastTickAt,
  getTodayPlan,
  loadProjects,
  loadQueue,
  saveCheckpoint,
  savePlan,
  saveQueue,
  setJobStatus,
  setLastFixedSlot,
  setLastTickAt,
  currentFixedSlot,
  type QueuedJob,
} from './storage';
import { commitsForScheduledTick, recordCommits, shouldRunTick } from './planner';
import type { ActivityLog, Project } from './types';

const projectDrains = new Map<string, Promise<void>>();
let drainAll: Promise<void> | null = null;
let redrain = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastOfflineAt = 0;
let appPaused = AppState.currentState !== 'active';
const OFFLINE_BACKOFF_MS = 8000;
const flushWaiters: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

export function isFlushPaused(): boolean {
  return appPaused || AppState.currentState !== 'active';
}

export function pauseFlush(): void {
  appPaused = true;
}

export function resumeFlush(): void {
  appPaused = false;
}

function applyAppState(state: AppStateStatus) {
  appPaused = state !== 'active';
}

function isRetryableJobError(msg?: string): boolean {
  if (!msg) return false;
  return isOfflineError(msg) || isFastForwardError(msg);
}

async function clearRetryableErrors(): Promise<QueuedJob[]> {
  const loaded = await loadQueue();
  const jobs = loaded.map((job) =>
    job.lastError && isRetryableJobError(job.lastError)
      ? { ...job, lastError: undefined, status: 'queued' as const }
      : job,
  );
  if (jobs.some((job, i) => job.lastError !== loaded[i]?.lastError)) {
    await saveQueue(jobs);
  }
  return jobs;
}

async function pendingFor(projectId: string): Promise<QueuedJob[]> {
  return (await loadQueue()).filter((job) => job.projectId === projectId && !job.lastError);
}

async function consumeOneCommit(jobId: string): Promise<void> {
  const q = await loadQueue();
  await saveQueue(
    q
      .map((job) => {
        if (job.id !== jobId) return job;
        if (job.n <= 1) return null;
        return { ...job, n: job.n - 1, lastError: undefined, status: 'queued' as const };
      })
      .filter((job): job is QueuedJob => job != null),
  );
}

async function markProjectQueued(projectId: string): Promise<void> {
  const q = await loadQueue();
  await saveQueue(
    q.map((job) =>
      job.projectId === projectId && !job.lastError ? { ...job, status: 'queued' as const } : job,
    ),
  );
}

async function failCurrentJob(projectId: string, msg: string): Promise<void> {
  const jobs = await pendingFor(projectId);
  const current = jobs[0];
  if (!current) return;
  const q = await loadQueue();
  await saveQueue(
    q.map((job) =>
      job.id === current.id ? { ...job, tries: job.tries + 1, lastError: msg, status: 'queued' as const } : job,
    ),
  );
}

async function checkpointRemaining(projectId: string): Promise<void> {
  const remaining = await pendingFor(projectId);
  if (remaining.length === 0) {
    await clearCheckpoint(projectId);
    return;
  }
  await saveCheckpoint({
    projectId,
    remaining: remaining.map((job) => ({ id: job.id, n: job.n })),
  });
}

/** Coalesce rapid +1 taps, then drain every project in parallel. */
export function flushQueue(): Promise<void> {
  return new Promise((resolve, reject) => {
    flushWaiters.push({ resolve, reject });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const waiters = flushWaiters.splice(0);
      startDrainAll().then(
        () => waiters.forEach((w) => w.resolve()),
        (err) => waiters.forEach((w) => w.reject(err)),
      );
    }, 250);
  });
}

function startDrainAll(): Promise<void> {
  if (drainAll) {
    redrain = true;
    return drainAll;
  }
  drainAll = (async () => {
    try {
      do {
        redrain = false;
        await drainQueue();
      } while (redrain);
    } finally {
      drainAll = null;
    }
  })();
  return drainAll;
}

async function drainQueue(): Promise<void> {
  const jobs = await clearRetryableErrors();

  if (Date.now() - lastOfflineAt < OFFLINE_BACKOFF_MS) return;
  if (!(await isOnline())) {
    lastOfflineAt = Date.now();
    return;
  }

  const projects = await loadProjects();
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const pending = jobs.filter((job) => !job.lastError);
  if (pending.length === 0) return;

  const grouped = new Map<string, QueuedJob[]>();
  for (const job of pending) {
    const list = grouped.get(job.projectId) ?? [];
    list.push(job);
    grouped.set(job.projectId, list);
  }

  await Promise.all(
    [...grouped.entries()].map(async ([projectId]) => {
      const project = byId[projectId];
      if (!project) {
        await saveQueue((await loadQueue()).filter((job) => job.projectId !== projectId));
        await clearCheckpoint(projectId);
        return;
      }
      await ensureProjectDrain(project);
    }),
  );
}

function ensureProjectDrain(project: Project): Promise<void> {
  const existing = projectDrains.get(project.id);
  if (existing) return existing;
  const run = drainProject(project).finally(() => {
    if (projectDrains.get(project.id) === run) projectDrains.delete(project.id);
  });
  projectDrains.set(project.id, run);
  return run;
}

async function drainProject(project: Project): Promise<void> {
  while (true) {
    if (isFlushPaused() && AppState.currentState !== 'active') {
      await markProjectQueued(project.id);
      await checkpointRemaining(project.id);
      return;
    }

    const jobs = await pendingFor(project.id);
    if (jobs.length === 0) {
      await clearCheckpoint(project.id);
      return;
    }

    const total = jobs.reduce((sum, job) => sum + job.n, 0);
    if (total <= 0) {
      await clearCheckpoint(project.id);
      return;
    }

    try {
      await pushCommitsPipelined(project, total, {
        shouldStop: () => isFlushPaused() && AppState.currentState !== 'active',
        onCommitting: async () => {
          const current = (await pendingFor(project.id))[0];
          if (current) await setJobStatus(current.id, 'committing');
        },
        onPushing: async () => {
          const current = (await pendingFor(project.id))[0];
          if (current) await setJobStatus(current.id, 'committed');
        },
        onPushed: async () => {
          const current = (await pendingFor(project.id))[0];
          if (!current) return;
          await consumeOneCommit(current.id);
          await appendLog({
            id: `${project.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            projectId: project.id,
            projectName: project.name,
            message: 'Pushed commit',
            commits: 1,
            timestamp: new Date().toISOString(),
            success: true,
            manual: current.manual,
          });
          const plan = await getTodayPlan(project);
          await savePlan(project.id, recordCommits(plan, 1, new Date()));
          await checkpointRemaining(project.id);
        },
      });
    } catch (err) {
      if (isFlushPaused()) {
        await markProjectQueued(project.id);
        await checkpointRemaining(project.id);
        return;
      }
      if (isOfflineError(err)) {
        lastOfflineAt = Date.now();
        await markProjectQueued(project.id);
        await checkpointRemaining(project.id);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await failCurrentJob(project.id, msg);
      await checkpointRemaining(project.id);
    }
  }
}

export async function queueCommits(project: Project, n: number, manual: boolean): Promise<ActivityLog> {
  const job = await enqueue({ projectId: project.id, projectName: project.name, n, manual });
  const now = new Date();
  return {
    id: job.id,
    projectId: project.id,
    projectName: project.name,
    message: manual ? 'Queued +1' : `Queued ${n} commit(s)`,
    commits: n,
    timestamp: now.toISOString(),
    success: true,
    manual,
  };
}

export async function runScheduledTick(project: Project, force = false): Promise<ActivityLog> {
  const now = new Date();
  const base: ActivityLog = {
    id: `${project.id}-${Date.now()}`,
    projectId: project.id,
    projectName: project.name,
    message: '',
    commits: 0,
    timestamp: now.toISOString(),
    success: true,
  };

  if (!project.enabled && !force) {
    return { ...base, message: 'Project paused' };
  }

  const lastTickAt = await getLastTickAt(project.id);
  const lastFixedSlot = await getLastFixedSlot(project.id);
  if (!force && !shouldRunTick(project, lastTickAt, now, lastFixedSlot)) {
    return { ...base, message: 'Not due yet' };
  }

  const plan = await getTodayPlan(project);
  const n = commitsForScheduledTick(project, plan, now);
  if (n <= 0) {
    await setLastTickAt(project.id, now.toISOString());
    if (project.timer.mode === 'fixed_times') await setLastFixedSlot(project.id, currentFixedSlot(now));
    return { ...base, message: 'Nothing scheduled for this slot' };
  }

  const result = await queueCommits(project, n, false);
  await setLastTickAt(project.id, now.toISOString());
  if (project.timer.mode === 'fixed_times') await setLastFixedSlot(project.id, currentFixedSlot(now));
  return result;
}

export async function runQuickCommit(project: Project): Promise<ActivityLog> {
  if (!project.enabled) {
    return {
      id: `${project.id}-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      message: 'Project paused',
      commits: 0,
      timestamp: new Date().toISOString(),
      success: false,
      manual: true,
      error: 'Enable the project first',
    };
  }
  return queueCommits(project, 1, true);
}

AppState.addEventListener('change', (state) => {
  const becameActive = state === 'active' && appPaused;
  applyAppState(state);
  if (becameActive) {
    lastOfflineAt = 0;
    flushQueue().catch(() => {});
  }
});

export async function runDueTicks(): Promise<void> {
  const projects = await loadProjects();
  for (const project of projects.filter((p) => p.enabled)) {
    const lastTickAt = await getLastTickAt(project.id);
    const lastFixedSlot = await getLastFixedSlot(project.id);
    if (shouldRunTick(project, lastTickAt, new Date(), lastFixedSlot)) {
      await runScheduledTick(project, false);
    }
  }
  await flushQueue();
}
