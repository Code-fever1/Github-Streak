import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ActivityLog, DailyPlan, Project } from './types';
import { normalizeProject } from './types';
import { buildDailyPlan, todayKey, timeKey } from './planner';

const PROJECTS_KEY = '@streak/projects';
const PLANS_PREFIX = '@streak/plan/';
const LOGS_KEY = '@streak/logs';
const LAST_TICK_PREFIX = '@streak/last-tick/';
const FIXED_SLOT_PREFIX = '@streak/fixed-slot/';
const QUEUE_KEY = '@streak/queue';
const CHECKPOINT_KEY = '@streak/drain-checkpoint';
const SSH_PREFIX = 'streak_ssh_';
const SSH_FALLBACK = '@streak/ssh/';
const TOKEN_PREFIX = 'tok_';

export type QueueStatus = 'queued' | 'committing' | 'committed';

export interface QueuedJob {
  id: string;
  projectId: string;
  projectName?: string;
  n: number;
  manual: boolean;
  createdAt: string;
  tries: number;
  lastError?: string;
  status?: QueueStatus;
}

async function saveSecure(id: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(`${SSH_FALLBACK}${id}`, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(`${SSH_PREFIX}${id}`, value);
  } catch {
    await AsyncStorage.setItem(`${SSH_FALLBACK}${id}`, value);
  }
}

async function getSecure(id: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(`${SSH_FALLBACK}${id}`);
  try {
    const v = await SecureStore.getItemAsync(`${SSH_PREFIX}${id}`);
    if (v) return v;
  } catch {
    // fall through
  }
  return AsyncStorage.getItem(`${SSH_FALLBACK}${id}`);
}

async function deleteSecure(id: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(`${SSH_PREFIX}${id}`);
    } catch {
      // ignore
    }
  }
  await AsyncStorage.removeItem(`${SSH_FALLBACK}${id}`);
}

export async function loadProjects(): Promise<Project[]> {
  const raw = await AsyncStorage.getItem(PROJECTS_KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as Partial<Project>[]).map((p) => normalizeProject(p as Project));
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export async function saveSshKey(projectId: string, privateKeyPem: string): Promise<void> {
  await saveSecure(projectId, privateKeyPem);
}

export async function getSshKey(projectId: string): Promise<string | null> {
  return getSecure(projectId);
}

export async function deleteSshKey(projectId: string): Promise<void> {
  await deleteSecure(projectId);
}

export async function saveGithubToken(projectId: string, token: string): Promise<void> {
  await saveSecure(`${TOKEN_PREFIX}${projectId}`, token.trim());
}

export async function getGithubToken(projectId: string): Promise<string | null> {
  const v = await getSecure(`${TOKEN_PREFIX}${projectId}`);
  return v?.trim() || null;
}

export async function deleteGithubToken(projectId: string): Promise<void> {
  await deleteSecure(`${TOKEN_PREFIX}${projectId}`);
}

export async function hasGithubToken(projectId: string): Promise<boolean> {
  return Boolean(await getGithubToken(projectId));
}

export async function getTodayPlan(project: Project): Promise<DailyPlan> {
  const key = `${PLANS_PREFIX}${project.id}/${todayKey()}`;
  const raw = await AsyncStorage.getItem(key);
  if (raw) {
    const plan = JSON.parse(raw) as DailyPlan;
    if (plan.date === todayKey()) return plan;
  }
  const plan = buildDailyPlan(project.schedule);
  await AsyncStorage.setItem(key, JSON.stringify(plan));
  return plan;
}

export async function savePlan(projectId: string, plan: DailyPlan): Promise<void> {
  await AsyncStorage.setItem(`${PLANS_PREFIX}${projectId}/${plan.date}`, JSON.stringify(plan));
}

export async function getLastTickAt(projectId: string): Promise<string | null> {
  return AsyncStorage.getItem(`${LAST_TICK_PREFIX}${projectId}`);
}

export async function setLastTickAt(projectId: string, iso: string): Promise<void> {
  await AsyncStorage.setItem(`${LAST_TICK_PREFIX}${projectId}`, iso);
}

export async function getLastFixedSlot(projectId: string): Promise<string | null> {
  return AsyncStorage.getItem(`${FIXED_SLOT_PREFIX}${projectId}`);
}

export async function setLastFixedSlot(projectId: string, slot: string): Promise<void> {
  await AsyncStorage.setItem(`${FIXED_SLOT_PREFIX}${projectId}`, slot);
}

export async function loadAllLastTicks(projects: Project[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(projects.map(async (p) => [p.id, await getLastTickAt(p.id)] as const));
  return Object.fromEntries(entries);
}

export async function loadLogs(): Promise<ActivityLog[]> {
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as ActivityLog[];
}

export async function appendLog(entry: ActivityLog): Promise<void> {
  const logs = await loadLogs();
  logs.unshift(entry);
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, 200)));
}

const queueListeners = new Set<() => void>();

export function subscribeQueue(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

function notifyQueue() {
  queueListeners.forEach((fn) => fn());
}

export async function loadQueue(): Promise<QueuedJob[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as QueuedJob[];
}

export async function saveQueue(jobs: QueuedJob[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(jobs));
  notifyQueue();
}

export async function setJobStatus(jobId: string, status: QueueStatus): Promise<void> {
  const q = await loadQueue();
  await saveQueue(q.map((job) => (job.id === jobId ? { ...job, status, lastError: undefined } : job)));
}

export async function enqueue(job: Omit<QueuedJob, 'id' | 'createdAt' | 'tries'>): Promise<QueuedJob> {
  const full: QueuedJob = {
    ...job,
    id: `${job.projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    tries: 0,
    status: 'queued',
  };
  const q = await loadQueue();
  q.push(full);
  await saveQueue(q);
  return full;
}

export function currentFixedSlot(now = new Date()): string {
  return `${todayKey(now)}-${timeKey(now)}`;
}

export async function queuedCount(): Promise<number> {
  return (await loadQueue()).length;
}

export async function dropQueueJob(jobId: string): Promise<void> {
  await dropQueueJobs([jobId]);
}

export async function dropQueueJobs(jobIds: string[]): Promise<void> {
  const drop = new Set(jobIds);
  const q = await loadQueue();
  await saveQueue(q.filter((job) => !drop.has(job.id)));
}

export async function dropQueueForProject(projectId: string): Promise<void> {
  const q = await loadQueue();
  await saveQueue(q.filter((job) => job.projectId !== projectId));
}

export async function clearQueueJobError(jobId: string): Promise<void> {
  await clearQueueJobErrors([jobId]);
}

export async function clearQueueJobErrors(jobIds: string[]): Promise<void> {
  const ids = new Set(jobIds);
  const q = await loadQueue();
  await saveQueue(
    q.map((job) =>
      ids.has(job.id) ? { ...job, lastError: undefined, status: 'queued' as const } : job,
    ),
  );
}

export interface DrainCheckpoint {
  projectId: string;
  remaining: Array<{ id: string; n: number }>;
  baseSha?: string;
  headSha?: string;
  treeSha?: string;
  counter?: string;
  notes?: string;
  changelog?: string;
  chunkMade?: number;
}

async function loadCheckpointMap(): Promise<Record<string, DrainCheckpoint>> {
  const raw = await AsyncStorage.getItem(CHECKPOINT_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DrainCheckpoint>;
  } catch {
    return {};
  }
}

export async function loadCheckpoint(projectId: string): Promise<DrainCheckpoint | null> {
  const map = await loadCheckpointMap();
  return map[projectId] ?? null;
}

export async function saveCheckpoint(cp: DrainCheckpoint): Promise<void> {
  const map = await loadCheckpointMap();
  map[cp.projectId] = cp;
  await AsyncStorage.setItem(CHECKPOINT_KEY, JSON.stringify(map));
}

export async function clearCheckpoint(projectId: string): Promise<void> {
  const map = await loadCheckpointMap();
  if (!(projectId in map)) return;
  delete map[projectId];
  await AsyncStorage.setItem(CHECKPOINT_KEY, JSON.stringify(map));
}
