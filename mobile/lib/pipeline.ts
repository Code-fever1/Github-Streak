import type { Project } from './types';

/** Live per-project pipeline — memory only. Counts only move forward except rebuild. */
export interface PipelineSnapshot {
  projectId: string;
  projectName: string;
  queued: number;
  writing: number;
  waitingPush: number;
  pushing: number;
}

type Listener = () => void;

const live = new Map<string, PipelineSnapshot>();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribePipeline(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPipeline(projectId: string): PipelineSnapshot | null {
  return live.get(projectId) ?? null;
}

export function listPipelines(): PipelineSnapshot[] {
  return [...live.values()].map((row) => ({ ...row }));
}

export function clearPipeline(projectId: string): void {
  if (!live.has(projectId)) return;
  live.delete(projectId);
  notify();
}

export function initPipeline(project: Project, queued: number): void {
  live.set(project.id, {
    projectId: project.id,
    projectName: project.name,
    queued,
    writing: 0,
    waitingPush: 0,
    pushing: 0,
  });
  notify();
}

export function addQueued(projectId: string, n: number, projectName?: string): void {
  const row = live.get(projectId);
  if (!row) return;
  live.set(projectId, {
    ...row,
    projectName: projectName || row.projectName,
    queued: row.queued + n,
  });
  notify();
}

export function beginWrite(projectId: string): boolean {
  const row = live.get(projectId);
  if (!row || row.queued <= 0) return false;
  live.set(projectId, { ...row, queued: row.queued - 1, writing: row.writing + 1 });
  notify();
  return true;
}

export function finishWrite(projectId: string): void {
  const row = live.get(projectId);
  if (!row) return;
  live.set(projectId, {
    ...row,
    writing: Math.max(0, row.writing - 1),
    waitingPush: row.waitingPush + 1,
  });
  notify();
}

export function beginPush(projectId: string): boolean {
  const row = live.get(projectId);
  if (!row || row.waitingPush <= 0) return false;
  live.set(projectId, {
    ...row,
    waitingPush: row.waitingPush - 1,
    pushing: 1,
  });
  notify();
  return true;
}

export function finishPush(projectId: string): void {
  const row = live.get(projectId);
  if (!row) return;
  live.set(projectId, { ...row, pushing: 0 });
  notify();
}

/** Put unpushed work back in queued (422 rebuild). Never a small flicker — one notify. */
export function rebuildPipeline(projectId: string): void {
  const row = live.get(projectId);
  if (!row) return;
  live.set(projectId, {
    ...row,
    queued: row.queued + row.writing + row.waitingPush + row.pushing,
    writing: 0,
    waitingPush: 0,
    pushing: 0,
  });
  notify();
}

export function buildPipelineViews(
  remainingByProject: Map<string, { n: number; projectName: string }>,
): PipelineSnapshot[] {
  const out: PipelineSnapshot[] = [];
  const seen = new Set<string>();

  for (const row of live.values()) {
    seen.add(row.projectId);
    out.push({ ...row });
  }

  for (const [projectId, { n, projectName }] of remainingByProject) {
    if (seen.has(projectId)) continue;
    out.push({
      projectId,
      projectName,
      queued: n,
      writing: 0,
      waitingPush: 0,
      pushing: 0,
    });
  }

  return out;
}
