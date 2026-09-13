import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ActivityLog, DailyPlan, Project, TimerConfig } from '@/lib/types';
import { DEFAULT_SCHEDULE, DEFAULT_TIMER } from '@/lib/types';
import { parseRepoInput } from '@/lib/repo-url';
import { generateEd25519KeyPair } from '@/lib/ssh-key';
import { runQuickCommit, runScheduledTick, flushQueue } from '@/lib/scheduler';
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
  saveGithubToken,
  saveProjects,
  saveSshKey,
  subscribeQueue,
  type QueuedJob,
} from '@/lib/storage';
import { verifyGithubToken } from '@/lib/github';

interface ProjectsContextValue {
  projects: Project[];
  logs: ActivityLog[];
  queue: QueuedJob[];
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
  quickCommit: (project: Project) => Promise<ActivityLog>;
  retryQueueJobs: (jobIds: string[]) => Promise<void>;
  deleteQueueJobs: (jobIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [queue, setQueue] = useState<QueuedJob[]>([]);
  const [lastTicks, setLastTicks] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await loadProjects();
    const [l, ticks, jobs] = await Promise.all([loadLogs(), loadAllLastTicks(p), loadQueue()]);
    setProjects(p);
    setLogs(l.filter((entry) => !entry.message.startsWith('Queued')));
    setLastTicks(ticks);
    setQueue(jobs);
    setPending(jobs.length);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(
    () =>
      subscribeQueue(() => {
        refresh().catch(() => {});
      }),
    [refresh],
  );

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
    setPending(jobs.length);
  }, [projects]);

  const toggleProject = useCallback(async (id: string) => {
    const next = projects.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    await saveProjects(next);
    setProjects(next);
  }, [projects]);

  const updateTimer = useCallback(async (id: string, timer: TimerConfig) => {
    const next = projects.map((p) => (p.id === id ? { ...p, timer } : p));
    await saveProjects(next);
    setProjects(next);
  }, [projects]);

  const getPlan = useCallback((project: Project) => getTodayPlan(project), []);

  const runTick = useCallback(async (project: Project, force = false) => {
    const log = await runScheduledTick(project, force);
    await refresh();
    flushQueue().then(() => refresh()).catch(() => {});
    return log;
  }, [refresh]);

  const quickCommit = useCallback(async (project: Project) => {
    const log = await runQuickCommit(project);
    await refresh();
    flushQueue().then(() => refresh()).catch(() => {});
    return log;
  }, [refresh]);

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

  const value = useMemo(
    () => ({
      projects,
      logs,
      queue,
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
    }),
    [
      projects,
      logs,
      queue,
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
    ],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
  return ctx;
}
