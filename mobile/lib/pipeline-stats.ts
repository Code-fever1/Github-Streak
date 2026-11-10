import type { PipelineSnapshot } from './pipeline';

/** Commits not yet on GitHub — queue storage or live pipeline, never both. */
export function inPipelineCount(pipeline: PipelineSnapshot[], pending: number): number {
  const live = pipeline.reduce(
    (sum, row) => sum + row.queued + row.writing + row.waitingPush + row.pushing,
    0,
  );
  return live > 0 ? live : pending;
}
