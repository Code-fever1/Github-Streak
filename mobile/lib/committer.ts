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
  onCommitting?: () => Promise<void> | void;
  onPushing?: () => Promise<void> | void;
  onPushed?: (message: string) => Promise<void> | void;
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

/**
 * Create and push `n` commits one PATCH at a time.
 * While PATCH N is in flight, commit N+1 is already being built (parent = N's SHA).
 * If PATCH 422s, discard unpushed children and rebuild on latest HEAD (no force-push).
 */
export async function pushCommitsPipelined(
  project: Project,
  n: number,
  hooks: PipelineHooks = {},
): Promise<{ made: number; messages: string[] }> {
  if (n <= 0) return { made: 0, messages: [] };
  const token = await getGithubToken(project.id);
  if (!token) {
    throw new Error(
      'Add a GitHub personal access token on this project (repo scope). SSH deploy keys cannot push from the phone.',
    );
  }

  let git = await startCommitSession(project);
  let tree = await loadTree(git);
  let speculative: PreparedCommit | null = null;
  let made = 0;
  let ffTries = 0;
  const messages: string[] = [];

  const rebuild = async () => {
    git = await startCommitSession(project);
    tree = await loadTree(git);
    speculative = null;
  };

  while (made < n) {
    if (hooks.shouldStop?.()) break;

    await hooks.onCommitting?.();
    if (!speculative) {
      const created = await createPrepared(git, tree);
      speculative = created.prepared;
      tree = created.tree;
    }

    await hooks.onPushing?.();
    const current = speculative;
    speculative = null;

    const pushP = pushCommit(git, current.sha, current.parentSha);
    const wantNext = made + 1 < n && !hooks.shouldStop?.();
    const nextP = wantNext ? createPrepared(git, tree) : null;

    try {
      await pushP;
      ffTries = 0;
      made++;
      messages.push(current.message);
      await hooks.onPushed?.(current.message);
      if (nextP) {
        const created = await nextP;
        speculative = created.prepared;
        tree = created.tree;
      }
    } catch (err) {
      if (nextP) await nextP.catch(() => {});
      speculative = null;
      if (isFastForwardError(err) && ffTries < FF_RETRIES - 1) {
        ffTries += 1;
        await rebuild();
        continue;
      }
      throw err;
    }
  }

  return { made, messages };
}

export async function makeCommits(
  project: Project,
  n: number,
): Promise<{ made: number; messages: string[] }> {
  return pushCommitsPipelined(project, n);
}
