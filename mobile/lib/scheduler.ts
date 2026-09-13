import { AppState, type AppStateStatus } from 'react-native';
import { pushCommitsPipelined } from './committer';
import { isFastForwardError } from './github';
import { clearPipeline, initPipeline, beginWrite, finishWrite, beginPush, finishPush, rebuildPipeline, addQueued } from './pipeline';
import { isOfflineError, isOnline } from './offline';
import {
  appendLog,
  clearCheckpoint,
  decrementProjectRemaining,
  enqueue,
  getLastFixedSlot,
  getLastTickAt,
  getProjectRemaining,
  normalizeProjectQueue,
  getTodayPlan,
  loadProjects,
  loadQueue,
  mutateQueue,
  saveCheckpoint,
  savePlan,
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
  return mutateQueue((loaded) =>
    loaded.map((job) =>
      job.lastError && isRetryableJobError(job.lastError)
        ? { ...job, lastError: undefined, status: 'queued' as const }
        : job,
    ),
  );
}

async function failActiveJob(projectId: string, msg: string): Promise<void> {
  await mutateQueue((q) => {
    const active = q.find((job) => job.projectId === projectId && !job.lastError);
    if (!active) return q;
    return q.map((job) =>
      job.id === active.id
        ? { ...job, tries: job.tries + 1, lastError: msg, status: 'queued' as const }
        : job,
    );
  });
}

async function checkpointRemaining(projectId: string): Promise<void> {
  const remaining = await getProjectRemaining(projectId);
  if (remaining <= 0) {
    await clearCheckpoint(projectId);
    return;
  }
  const jobs = (await loadQueue()).filter((job) => job.projectId === projectId && !job.lastError);
  await saveCheckpoint({
    projectId,
    remaining: jobs.map((job) => ({ id: job.id, n: job.n })),
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
    }, 50);
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
  const pending = jobs.filter((job) => !job.lastError && job.n > 0);
  if (pending.length === 0) return;

  const projectIds = new Set(pending.map((job) => job.projectId));
  await Promise.all(
    [...projectIds].map(async (projectId) => {
      const project = byId[projectId];
      if (!project) {
        await mutateQueue((rows) => rows.filter((job) => job.projectId !== projectId));
        await clearCheckpoint(projectId);
        clearPipeline(projectId);
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
  await normalizeProjectQueue(project.id);
  const remaining = await getProjectRemaining(project.id);
  if (remaining <= 0) {
    clearPipeline(project.id);
    return;
  }

  initPipeline(project, remaining);
  let planDirty = 0;
  let planBase = await getTodayPlan(project);

  try {
    await pushCommitsPipelined(project, {
      shouldStop: () => isFlushPaused() && AppState.currentState !== 'active',
      beginWrite: () => beginWrite(project.id),
      onWriteDone: () => finishWrite(project.id),
      onPushStart: () => beginPush(project.id),
      onPushDone: async () => {
        finishPush(project.id);
        const dropped = await decrementProjectRemaining(project.id);
        planDirty += 1;
        if (planDirty >= 3) {
          planBase = recordCommits(planBase, planDirty, new Date());
          await savePlan(project.id, planBase);
          planDirty = 0;
        }
        void appendLog({
          id: `${project.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          projectId: project.id,
          projectName: project.name,
          message: 'Pushed commit',
          commits: 1,
          timestamp: new Date().toISOString(),
          success: true,
          manual: dropped?.manual,
        });
      },
      onRebuild: () => rebuildPipeline(project.id),
    });

    if (planDirty > 0) {
      await savePlan(project.id, recordCommits(planBase, planDirty, new Date()));
    }
  } catch (err) {
    if (planDirty > 0) {
      await savePlan(project.id, recordCommits(planBase, planDirty, new Date()));
    }
    if (isFlushPaused()) {
      await checkpointRemaining(project.id);
      return;
    }
    if (isOfflineError(err)) {
      lastOfflineAt = Date.now();
      await checkpointRemaining(project.id);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    await failActiveJob(project.id, msg);
    await checkpointRemaining(project.id);
    return;
  }

  clearPipeline(project.id);
  await clearCheckpoint(project.id);
}

export async function queueCommits(project: Project, n: number, manual: boolean): Promise<ActivityLog> {
  const job = await enqueue({ projectId: project.id, projectName: project.name, n, manual });
  addQueued(project.id, n, project.name);
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
