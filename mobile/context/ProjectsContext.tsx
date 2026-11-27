import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityLog, DailyPlan, Project, TimerConfig } from '@/lib/types';
import { DEFAULT_SCHEDULE, DEFAULT_TIMER } from '@/lib/types';
import { parseRepoInput } from '@/lib/repo-url';
import { generateEd25519KeyPair } from '@/lib/ssh-key';
import { runQuickCommit, runScheduledTick, flushQueue } from '@/lib/scheduler';
import { syncNextWakeAlarm } from '@/lib/device-notify';
import { buildPipelineViews, subscribePipeline, type PipelineSnapshot } from '@/lib/pipeline';
import {
  clearQueueJobErrors,
  deleteGithubToken,
  deleteSshKey,
  dropQueueForProject,
  dropQueueJobs,
  getTodayPlan,
  loadAllLastTicks,
  loadLogs,
  loadProjects,
  loadQueue,
  hasGithubToken,
  saveGithubToken,
  saveProjects,
  saveSshKey,
  subscribeLogs,
  subscribeQueue,
  type QueuedJob,
} from '@/lib/storage';
import { verifyGithubToken } from '@/lib/github';
import {
  fetchBranchCommitDays,
  historySinceDays,
  mergeCommitDays,
  type DayCommitStats,
} from '@/lib/github-commits';

function projectsUnchanged(a: Project[], b: Project[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].enabled !== b[i].enabled || a[i].name !== b[i].name) return false;
  }
  return true;
}

function logsUnchanged(a: ActivityLog[], b: ActivityLog[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  return a[0].id === b[0].id && a[0].success === b[0].success;
}

function queueUnchanged(a: QueuedJob[], b: QueuedJob[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].n !== b[i].n || a[i].status !== b[i].status || a[i].lastError !== b[i].lastError) {
      return false;
    }
  }
  return true;
}

function ticksUnchanged(a: Record<string, string | null>, b: Record<string, string | null>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function pipelineUnchanged(a: PipelineSnapshot[], b: PipelineSnapshot[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.projectId !== y.projectId ||
      x.queued !== y.queued ||
      x.writing !== y.writing ||
      x.waitingPush !== y.waitingPush ||
      x.pushing !== y.pushing
    ) {
      return false;
    }
  }
  return true;
}

interface ProjectsContextValue {
  projects: Project[];
  logs: ActivityLog[];
  queue: QueuedJob[];
  pipeline: PipelineSnapshot[];
  lastTicks: Record<string, string | null>;
  pending: number;
  loading: boolean;
  addProject: (repoUrl: string, githubToken: string) => Promise<{ project: Project; publicKey?: string }>;
  saveToken: (id: string, githubToken: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  toggleProject: (id: string) => Promise<void>;
  updateTimer: (id: string, timer: TimerConfig) => Promise<void>;
  getPlan: (project: Project) => Promise<DailyPlan>;
  runTick: (project: Project, force?: boolean) => Promise<ActivityLog>;
  quickCommit: (project: Project, count?: number) => Promise<ActivityLog>;
  retryQueueJobs: (jobIds: string[]) => Promise<void>;
  deleteQueueJobs: (jobIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  githubDays: DayCommitStats[];
  githubHistoryLoading: boolean;
  githubHistoryError: string | null;
  refreshGithubHistory: (force?: boolean) => Promise<void>;
}

const GITHUB_HISTORY_WEEKS = 12;

function queuedUnits(jobs: QueuedJob[]): number {
  return jobs.filter((job) => !job.lastError).reduce((sum, job) => sum + job.n, 0);
}

function remainingMap(jobs: QueuedJob[]): Map<string, { n: number; projectName: string }> {
  const map = new Map<string, { n: number; projectName: string }>();
  for (const job of jobs) {
    if (job.lastError || job.n <= 0) continue;
    const cur = map.get(job.projectId) ?? { n: 0, projectName: job.projectName || job.projectId };
    cur.n += job.n;
    map.set(job.projectId, cur);
  }
  return map;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [queue, setQueue] = useState<QueuedJob[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSnapshot[]>([]);
  const [lastTicks, setLastTicks] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [githubDays, setGithubDays] = useState<DayCommitStats[]>([]);
  const [githubHistoryLoading, setGithubHistoryLoading] = useState(false);
  const [githubHistoryError, setGithubHistoryError] = useState<string | null>(null);
  const queueRef = useRef<QueuedJob[]>([]);
  const githubFetchAt = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const p = await loadProjects();
      const [l, ticks, jobs] = await Promise.all([loadLogs(), loadAllLastTicks(p), loadQueue()]);
      const visibleLogs = l.filter((entry) => !entry.message.startsWith('Queued'));
      setProjects((prev) => (projectsUnchanged(prev, p) ? prev : p));
      setLogs((prev) => (logsUnchanged(prev, visibleLogs) ? prev : visibleLogs));
      setLastTicks((prev) => (ticksUnchanged(prev, ticks) ? prev : ticks));
      queueRef.current = jobs;
      setQueue((prev) => (queueUnchanged(prev, jobs) ? prev : jobs));
      setPending(queuedUnits(jobs));
      setPipeline((prev) => {
        const next = buildPipelineViews(remainingMap(jobs));
        return pipelineUnchanged(prev, next) ? prev : next;
      });
    } catch {
      // Still unblock UI if storage read fails on device.
      setProjects([]);
      setLogs([]);
      setQueue([]);
      setPending(0);
      setPipeline([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const failOpen = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);
    refresh()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
        clearTimeout(failOpen);
      });
    return () => {
      cancelled = true;
      clearTimeout(failOpen);
    };
  }, [refresh]);

  useEffect(() => {
    const applyJobs = (jobs: QueuedJob[]) => {
      queueRef.current = jobs;
      setQueue(jobs);
      setPending(queuedUnits(jobs));
      setPipeline(buildPipelineViews(remainingMap(jobs)));
    };
    const unsubQueue = subscribeQueue(applyJobs);
    const unsubPipeline = subscribePipeline(() => {
      setPipeline(buildPipelineViews(remainingMap(queueRef.current)));
    });
    const unsubLogs = subscribeLogs(() => {
      loadLogs()
        .then((l) => setLogs(l.filter((entry) => !entry.message.startsWith('Queued'))))
        .catch(() => {});
    });
    return () => {
      unsubQueue();
      unsubPipeline();
      unsubLogs();
    };
  }, []);

  const addProject = useCallback(async (repoUrl: string, githubToken: string) => {
    const parsed = parseRepoInput(repoUrl);
    if (!parsed) throw new Error('Use a GitHub link like github.com/user/repo');
    const token = githubToken.trim();
    if (!token) throw new Error('Paste a GitHub personal access token with repo access');
    await verifyGithubToken(parsed.owner, parsed.repo, token);

    const pair = await generateEd25519KeyPair();
    const project: Project = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${parsed.owner}/${parsed.repo}`,
      owner: parsed.owner,
      repo: parsed.repo,
      authorName: parsed.owner,
      authorEmail: `${parsed.owner}@users.noreply.github.com`,
      branch: 'main',
      enabled: true,
      authType: 'token',
      sshPublicKey: pair.publicKeyOpenSSH,
      schedule: DEFAULT_SCHEDULE,
      timer: DEFAULT_TIMER,
      createdAt: new Date().toISOString(),
    };
    await saveSshKey(project.id, pair.privateKeyPem);
    await saveGithubToken(project.id, token);
    const next = [...(await loadProjects()), project];
    await saveProjects(next);
    setProjects(next);
    syncNextWakeAlarm().catch(() => {});
    return { project, publicKey: pair.publicKeyOpenSSH };
  }, []);

  const saveToken = useCallback(async (id: string, githubToken: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    const token = githubToken.trim();
    if (!token) throw new Error('Paste a GitHub personal access token with repo access');
    await verifyGithubToken(project.owner, project.repo, token);
    await saveGithubToken(id, token);
    const next = projects.map((p) => (p.id === id ? { ...p, authType: 'token' as const } : p));
    await saveProjects(next);
    setProjects(next);
  }, [projects]);

  const removeProject = useCallback(async (id: string) => {
    const next = projects.filter((p) => p.id !== id);
    await saveProjects(next);
    await deleteSshKey(id);
    await deleteGithubToken(id);
    await dropQueueForProject(id);
    const jobs = await loadQueue();
    setProjects(next);
    setQueue(jobs);
    setPending(queuedUnits(jobs));
    syncNextWakeAlarm().catch(() => {});
  }, [projects]);

  const toggleProject = useCallback(async (id: string) => {
    const next = projects.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    await saveProjects(next);
    setProjects(next);
    syncNextWakeAlarm().catch(() => {});
  }, [projects]);

  const updateTimer = useCallback(async (id: string, timer: TimerConfig) => {
    const next = projects.map((p) => (p.id === id ? { ...p, timer } : p));
    await saveProjects(next);
    setProjects(next);
    syncNextWakeAlarm().catch(() => {});
  }, [projects]);

  const getPlan = useCallback((project: Project) => getTodayPlan(project), []);

  const runTick = useCallback(async (project: Project, force = false) => {
    const log = await runScheduledTick(project, force);
    await refresh();
    flushQueue().then(() => refresh()).catch(() => {});
    return log;
  }, [refresh]);

  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const projectKey = projects.map((p) => p.id).join('|');

  const refreshGithubHistory = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - githubFetchAt.current < 15_000) return;
    githubFetchAt.current = now;
    setGithubHistoryLoading(true);
    setGithubHistoryError(null);
    try {
      const since = historySinceDays(GITHUB_HISTORY_WEEKS * 7);
      const rows: DayCommitStats[][] = [];
      let lastErr: string | null = null;
      for (const project of projectsRef.current) {
        if (!(await hasGithubToken(project.id))) continue;
        try {
          rows.push(await fetchBranchCommitDays(project, since));
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
        }
      }
      if (rows.length === 0 && lastErr) setGithubHistoryError(lastErr);
      else setGithubHistoryError(null);
      setGithubDays(mergeCommitDays(rows));
    } catch (err) {
      setGithubHistoryError(err instanceof Error ? err.message : String(err));
      setGithubDays([]);
    } finally {
      setGithubHistoryLoading(false);
    }
  }, []);

  const quickCommit = useCallback(async (project: Project, count = 1) => {
    const log = await runQuickCommit(project, count);
    await refresh();
    flushQueue()
      .then(() => {
        refresh().catch(() => {});
        githubFetchAt.current = 0;
        refreshGithubHistory().catch(() => {});
      })
      .catch(() => {});
    return log;
  }, [refresh, refreshGithubHistory]);

  const retryQueueJobs = useCallback(async (jobIds: string[]) => {
    await clearQueueJobErrors(jobIds);
    await refresh();
    await flushQueue();
    await refresh();
  }, [refresh]);

  const deleteQueueJobs = useCallback(async (jobIds: string[]) => {
    await dropQueueJobs(jobIds);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading || projects.length === 0) return;
    const t = setTimeout(() => {
      refreshGithubHistory().catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [loading, projectKey, refreshGithubHistory]);

  const value = useMemo(
    () => ({
      projects,
      logs,
      queue,
      pipeline,
      lastTicks,
      pending,
      loading,
      addProject,
      saveToken,
      removeProject,
      toggleProject,
      updateTimer,
      getPlan,
      runTick,
      quickCommit,
      retryQueueJobs,
      deleteQueueJobs,
      refresh,
      githubDays,
      githubHistoryLoading,
      githubHistoryError,
      refreshGithubHistory,
    }),
    [
      projects,
      logs,
      queue,
      pipeline,
      lastTicks,
      pending,
      loading,
      addProject,
      saveToken,
      removeProject,
      toggleProject,
      updateTimer,
      getPlan,
      runTick,
      quickCommit,
      retryQueueJobs,
      deleteQueueJobs,
      refresh,
      githubDays,
      githubHistoryLoading,
      githubHistoryError,
      refreshGithubHistory,
    ],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
  return ctx;
}
