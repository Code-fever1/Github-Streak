import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ActivityLog, DailyPlan, Project, TimerConfig } from '@/lib/types';
import { DEFAULT_SCHEDULE, DEFAULT_TIMER } from '@/lib/types';
import { parseRepoInput } from '@/lib/repo-url';
import { generateEd25519KeyPair } from '@/lib/ssh-key';
import { runQuickCommit, runScheduledTick, flushQueue } from '@/lib/scheduler';
import {
  appendLog,
  deleteSshKey,
  dropQueueForProject,
  getTodayPlan,
  loadAllLastTicks,
  loadLogs,
  loadProjects,
  queuedCount,
  saveProjects,
  saveSshKey,
} from '@/lib/storage';

interface ProjectsContextValue {
  projects: Project[];
  logs: ActivityLog[];
  lastTicks: Record<string, string | null>;
  pending: number;
  loading: boolean;
  addProject: (repoUrl: string) => Promise<{ project: Project; publicKey: string }>;
  removeProject: (id: string) => Promise<void>;
  toggleProject: (id: string) => Promise<void>;
  updateTimer: (id: string, timer: TimerConfig) => Promise<void>;
  getPlan: (project: Project) => Promise<DailyPlan>;
  runTick: (project: Project, force?: boolean) => Promise<ActivityLog>;
  quickCommit: (project: Project) => Promise<ActivityLog>;
  refresh: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [lastTicks, setLastTicks] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await loadProjects();
    const [l, ticks, q] = await Promise.all([loadLogs(), loadAllLastTicks(p), queuedCount()]);
    setProjects(p);
    setLogs(l);
    setLastTicks(ticks);
    setPending(q);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addProject = useCallback(async (repoUrl: string) => {
    const parsed = parseRepoInput(repoUrl);
    if (!parsed) throw new Error('Use a GitHub link like github.com/user/repo');
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
      authType: 'ssh',
      sshPublicKey: pair.publicKeyOpenSSH,
      schedule: DEFAULT_SCHEDULE,
      timer: DEFAULT_TIMER,
      createdAt: new Date().toISOString(),
    };
    await saveSshKey(project.id, pair.privateKeyPem);
    const next = [...(await loadProjects()), project];
    await saveProjects(next);
    setProjects(next);
    return { project, publicKey: pair.publicKeyOpenSSH };
  }, []);

  const removeProject = useCallback(async (id: string) => {
    const next = projects.filter((p) => p.id !== id);
    await saveProjects(next);
    await deleteSshKey(id);
    await dropQueueForProject(id);
    setProjects(next);
    setPending(await queuedCount());
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
    if (log.message !== 'Not due yet') await appendLog(log);
    await flushQueue();
    await refresh();
    return log;
  }, [refresh]);

  const quickCommit = useCallback(async (project: Project) => {
    const log = await runQuickCommit(project);
    await appendLog(log);
    await flushQueue();
    await refresh();
    return log;
  }, [refresh]);

  const value = useMemo(
    () => ({
      projects,
      logs,
      lastTicks,
      pending,
      loading,
      addProject,
      removeProject,
      toggleProject,
      updateTimer,
      getPlan,
      runTick,
      quickCommit,
      refresh,
    }),
    [
      projects,
      logs,
      lastTicks,
      pending,
      loading,
      addProject,
      removeProject,
      toggleProject,
      updateTimer,
      getPlan,
      runTick,
      quickCommit,
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
