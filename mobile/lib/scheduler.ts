import { makeCommits } from './committer';
import { isOfflineError, isBrowserOnline } from './offline';
import {
  appendLog,
  enqueue,
  getLastFixedSlot,
  getLastTickAt,
  getTodayPlan,
  loadProjects,
  loadQueue,
  savePlan,
  saveQueue,
  setLastFixedSlot,
  setLastTickAt,
  currentFixedSlot,
  type QueuedJob,
} from './storage';
import { commitsForScheduledTick, recordCommits, shouldRunTick } from './planner';
import type { ActivityLog, Project } from './types';

function queuedMessage(err: unknown, manual: boolean): string {
  const msg = err instanceof Error ? err.message : String(err);
  if ((isOfflineError(err) || !isBrowserOnline()) && !/SSH keys cannot push|git server/i.test(msg)) {
    return manual ? 'Queued +1 — will send when you are online' : `Queued — will send when online`;
  }
  return manual ? `Queued +1 — ${msg}` : `Queued — ${msg}`;
}

async function sendCommits(project: Project, n: number) {
  const { made, messages } = await makeCommits(project, n);
  return { made, messages };
}

export async function flushQueue(): Promise<void> {
  const projects = await loadProjects();
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const jobs = await loadQueue();
  const keep: QueuedJob[] = [];

  for (const job of jobs) {
    const project = byId[job.projectId];
    if (!project) continue;
    try {
      const { made, messages } = await sendCommits(project, job.n);
      await appendLog({
        id: `${job.id}-sent`,
        projectId: project.id,
        projectName: project.name,
        message: job.manual ? `[+1] ${messages[messages.length - 1] || 'sent'}` : messages[messages.length - 1] || 'sent',
        commits: made,
        timestamp: new Date().toISOString(),
        success: true,
        manual: job.manual,
      });
    } catch (err) {
      job.tries += 1;
      job.lastError = err instanceof Error ? err.message : String(err);
      keep.push(job);
    }
  }

  await saveQueue(keep);
}

export async function queueCommits(project: Project, n: number, manual: boolean): Promise<ActivityLog> {
  const now = new Date();
  const log: ActivityLog = {
    id: `${project.id}-${Date.now()}`,
    projectId: project.id,
    projectName: project.name,
    message: '',
    commits: n,
    timestamp: now.toISOString(),
    success: true,
    manual,
  };

  try {
    const { made, messages } = await sendCommits(project, n);
    return {
      ...log,
      commits: made,
      message: manual ? `[+1] ${messages[messages.length - 1]}` : messages[messages.length - 1] || 'Done',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await enqueue({ projectId: project.id, n, manual });
    return {
      ...log,
      commits: 0,
      message: queuedMessage(err, manual),
      error: msg,
    };
  }
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
  if (result.success && result.commits > 0) {
    const updated = recordCommits(plan, result.commits, now);
    await savePlan(project.id, updated);
  }
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

export async function runDueTicks(): Promise<void> {
  const projects = await loadProjects();
  for (const project of projects.filter((p) => p.enabled)) {
    const lastTickAt = await getLastTickAt(project.id);
    const lastFixedSlot = await getLastFixedSlot(project.id);
    if (shouldRunTick(project, lastTickAt, new Date(), lastFixedSlot)) {
      const log = await runScheduledTick(project, false);
      if (log.message !== 'Not due yet') await appendLog(log);
    }
  }
  await flushQueue();
}
