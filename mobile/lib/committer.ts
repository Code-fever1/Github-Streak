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
  onRebuild?: () => void;
  shouldStop?: () => boolean;
}

const TARGET_BUFFER = 10;

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

/**
 * Fill a stack of commit objects (up to 10), then push them one unique PATCH at a time.
 * Writing keeps going while a push is in flight so Committed can sit at +10 with Queue still holding the rest.
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
  const ready: PreparedCommit[] = [];
  let createP: Promise<void> | null = null;
  let pushP: Promise<void> | null = null;
  let made = 0;
  let ffTries = 0;
  let lastPushOk = false;
  const messages: string[] = [];

  const rebuild = async () => {
    if (createP) await createP.catch(() => {});
    createP = null;
    if (pushP) await pushP.catch(() => {});
    pushP = null;
    ready.length = 0;
    lastPushOk = false;
    git = await startCommitSession(project);
    tree = await loadTree(git);
    hooks.onRebuild?.();
  };

  const canWrite = () => !createP && ready.length < MAX_AHEAD && (hooks.beginWrite ? hooks.beginWrite() : false);

  while (!hooks.shouldStop?.()) {
    if (canWrite()) {
      createP = (async () => {
        try {
          const created = await createPrepared(git, tree);
          tree = created.tree;
          ready.push(created.prepared);
          hooks.onWriteDone?.();
        } catch (err) {
          hooks.onRebuild?.();
          throw err;
        }
      })().finally(() => {
        createP = null;
      });
    }

    const filled = ready.length >= TARGET_BUFFER;
    const writesIdle = !createP && ready.length > 0;
    const mayPush = filled || writesIdle;
    if (!pushP && ready.length > 0 && mayPush) {
      const current = ready.shift()!;
      hooks.onPushStart?.();
      const skipHeadCheck = lastPushOk;
      pushP = (async () => {
        try {
          await pushCommit(git, current.sha, current.parentSha, { checkHead: !skipHeadCheck });
          lastPushOk = true;
          ffTries = 0;
          made++;
          messages.push(current.message);
          await hooks.onPushDone?.(current.message);
        } catch (err) {
          lastPushOk = false;
          ready.unshift(current);
          throw err;
        }
      })().finally(() => {
        pushP = null;
      });
    }

    const inflight = [createP, pushP].filter((p): p is Promise<void> => Boolean(p));
    if (inflight.length === 0) break;

    try {
      await Promise.race(inflight);
    } catch (err) {
      if (isFastForwardError(err) && ffTries < FF_RETRIES - 1) {
        ffTries += 1;
        await rebuild();
        continue;
      }
      if (createP) await createP.catch(() => {});
      if (pushP) await pushP.catch(() => {});
      throw err;
    }
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
