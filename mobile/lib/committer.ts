import {
  appendCommit,
  isFastForwardError,
  pushCommit,
  readFilesFromTree,
  startCommitSession,
  type CommitSession,
} from './github';
import { getGithubToken } from './storage';
import type { CounterState, Project } from './types';

const FF_RETRIES = 5;
const MAX_AHEAD = 10;

const COMMIT_MESSAGES = [
  'Update activity counter',
  'Log daily progress notes',
  'Bump counter',
  'Record work session',
  'Sync counter state',
  'Update session log',
  'Refresh counter value',
  'Append progress note',
];

const NOTE_TOPICS = [
  'Reviewed pending TODO items',
  'Tidied up local config files',
  'Drafted next steps for the roadmap',
  'Noted an idea for a future refactor',
  'Outlined a small cleanup task',
  'Logged a minor observation',
  'Noted a small win from today',
  'Captured a passing thought for later',
];

const TAGS = ['notes', 'chore', 'journal', 'housekeeping', 'log', 'meta'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function timestamp(): string {
  return new Date().toISOString();
}

function shortDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function parseCounter(raw: string | null): CounterState {
  if (!raw) return { total: 0, daily: {}, lastUpdated: null };
  try {
    return JSON.parse(raw) as CounterState;
  } catch {
    return { total: 0, daily: {}, lastUpdated: null };
  }
}

function buildMessage(session: number, tag: string): string {
  const styles = [
    `${pick(COMMIT_MESSAGES)} (#${session})`,
    `${tag}: ${pick(COMMIT_MESSAGES)}`,
    pick(COMMIT_MESSAGES),
  ];
  return pick(styles);
}

interface TreeState {
  counter: CounterState;
  notes: string;
  changelog: string;
}

export interface PreparedCommit {
  sha: string;
  parentSha: string;
  treeSha: string;
  counter: CounterState;
  notes: string;
  changelog: string;
  message: string;
}

export interface PipelineHooks {
  /** Reserve one queued unit to write. False if nothing left to write. */
  beginWrite?: () => boolean;
  onWriteDone?: () => void;
  onPushStart?: () => void;
  onPushDone?: (message: string) => Promise<void> | void;
  onPushError?: () => void;
  shouldStop?: () => boolean;
}

async function loadTree(git: CommitSession): Promise<TreeState> {
  const files = await readFilesFromTree(git, ['COUNTER.md', 'NOTES.md', 'CHANGELOG.md']);
  return {
    counter: parseCounter(files['COUNTER.md']),
    notes: files['NOTES.md'] ?? '# Development Notes\n\nA running journal of small daily activity.\n\n',
    changelog: files['CHANGELOG.md'] ?? '# Changelog\n\n',
  };
}

async function createPrepared(git: CommitSession, tree: TreeState): Promise<{ prepared: PreparedCommit; tree: TreeState }> {
  const parentSha = git.headSha;
  const next: CounterState = {
    ...tree.counter,
    total: (tree.counter.total || 0) + 1,
    daily: { ...(tree.counter.daily ?? {}) },
    lastUpdated: timestamp(),
  };
  const day = shortDate();
  next.daily[day] = (next.daily[day] || 0) + 1;
  const sessionNo = next.total;
  const topic = pick(NOTE_TOPICS);
  const tag = pick(TAGS);
  const message = buildMessage(sessionNo, tag);
  const notes = `${tree.notes}## ${timestamp()}\n\n- ${topic}\n- tag: \`${tag}\`\n- session: #${sessionNo}\n\n`;
  const changelog = `${tree.changelog}- [${shortDate()}] ${topic} (#${sessionNo})\n`;
  await appendCommit(git, message, {
    'COUNTER.md': `${JSON.stringify(next, null, 2)}\n`,
    'NOTES.md': notes,
    'CHANGELOG.md': changelog,
  });
  const prepared: PreparedCommit = {
    sha: git.headSha,
    parentSha,
    treeSha: git.treeSha,
    counter: next,
    notes,
    changelog,
    message,
  };
  return { prepared, tree: { counter: next, notes, changelog } };
}

class Wake {
  private waiters: Array<() => void> = [];

  wait(): Promise<void> {
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  wake(): void {
    const pending = this.waiters.splice(0);
    pending.forEach((fn) => fn());
  }
}

/**
 * Two workers for one repo:
 * - writer: keeps creating commit objects into a buffer
 * - pusher: takes the oldest unique SHA and PATCHes, one at a time
 * They never wait on each other except backpressure (buffer full / empty).
 */
export async function pushCommitsPipelined(
  project: Project,
  hooks: PipelineHooks = {},
): Promise<{ made: number; messages: string[] }> {
  const token = await getGithubToken(project.id);
  if (!token) {
    throw new Error(
      'Add a GitHub personal access token on this project (repo scope). SSH deploy keys cannot push from the phone.',
    );
  }

  let git = await startCommitSession(project);
  let tree = await loadTree(git);
  let ready: PreparedCommit[] = [];
  let made = 0;
  let ffTries = 0;
  let lastPushOk = false;
  let redoWithoutReserve = 0;
  let stopWorkers = false;
  let writerDone = false;
  const messages: string[] = [];
  const wake = new Wake();

  const stopped = () => stopWorkers || Boolean(hooks.shouldStop?.());

  const rebuildGit = async () => {
    redoWithoutReserve = ready.length;
    ready = [];
    lastPushOk = false;
    git = await startCommitSession(project);
    tree = await loadTree(git);
  };

  const runWriter = async () => {
    try {
      while (!stopped()) {
        while (ready.length >= MAX_AHEAD && !stopped()) await wake.wait();
        if (stopped()) break;

        let reserved = false;
        if (redoWithoutReserve > 0) {
          redoWithoutReserve -= 1;
        } else if (hooks.beginWrite?.()) {
          reserved = true;
        } else if (ready.length === 0) {
          break;
        } else {
          await wake.wait();
          continue;
        }

        const created = await createPrepared(git, tree);
        if (stopped()) break;
        tree = created.tree;
        ready.push(created.prepared);
        if (reserved) hooks.onWriteDone?.();
        wake.wake();
      }
    } finally {
      writerDone = true;
      wake.wake();
    }
  };

  const runPusher = async () => {
    while (!stopped()) {
      while (ready.length === 0 && !writerDone && !stopped()) await wake.wait();
      if (ready.length === 0) break;

      const current = ready.shift()!;
      hooks.onPushStart?.();
      try {
        await pushCommit(git, current.sha, current.parentSha, { checkHead: !lastPushOk });
        lastPushOk = true;
        ffTries = 0;
        made++;
        messages.push(current.message);
        await hooks.onPushDone?.(current.message);
        wake.wake();
      } catch (err) {
        lastPushOk = false;
        ready.unshift(current);
        hooks.onPushError?.();
        throw err;
      }
    }
  };

  while (!hooks.shouldStop?.()) {
    stopWorkers = false;
    writerDone = false;
    let workerErr: unknown;
    const writer = runWriter().catch((err) => {
      workerErr = err;
      stopWorkers = true;
      wake.wake();
    });
    const pusher = runPusher().catch((err) => {
      workerErr = err;
      stopWorkers = true;
      wake.wake();
    });
    await Promise.all([writer, pusher]);
    if (!workerErr) break;
    if (isFastForwardError(workerErr) && ffTries < FF_RETRIES - 1) {
      ffTries += 1;
      await rebuildGit();
      continue;
    }
    throw workerErr;
  }

  return { made, messages };
}

export async function makeCommits(project: Project, n: number): Promise<{ made: number; messages: string[] }> {
  let left = n;
  return pushCommitsPipelined(project, {
    beginWrite: () => {
      if (left <= 0) return false;
      left -= 1;
      return true;
    },
  });
}
