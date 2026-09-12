import { createMultiFileCommit, getFileContent } from './github';
import { commitViaGitServer } from './git-server';
import { getSshKey } from './storage';
import type { CounterState, Project } from './types';

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

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function makeCommits(
  project: Project,
  n: number,
): Promise<{ made: number; messages: string[] }> {
  if (n <= 0) return { made: 0, messages: [] };

  const sshKey = await getSshKey(project.id);
  if (sshKey) {
    return commitViaGitServer(project, n, sshKey);
  }

  let counterFile = await getFileContent(project, 'COUNTER.md').catch(() => null);
  let notesFile = await getFileContent(project, 'NOTES.md').catch(() => null);
  let changelogFile = await getFileContent(project, 'CHANGELOG.md').catch(() => null);

  let counter = parseCounter(counterFile?.content ?? null);
  let notes = notesFile?.content ?? '# Development Notes\n\nA running journal of small daily activity.\n\n';
  let changelog = changelogFile?.content ?? '# Changelog\n\n';

  let made = 0;
  const messages: string[] = [];

  for (let i = 0; i < n; i++) {
    counter.total = (counter.total || 0) + 1;
    const day = shortDate();
    counter.daily ??= {};
    counter.daily[day] = (counter.daily[day] || 0) + 1;
    counter.lastUpdated = timestamp();

    const session = counter.total;
    const topic = pick(NOTE_TOPICS);
    const tag = pick(TAGS);
    const message = buildMessage(session, tag);

    notes += `## ${timestamp()}\n\n- ${topic}\n- tag: \`${tag}\`\n- session: #${session}\n\n`;
    changelog += `- [${shortDate()}] ${topic} (#${session})\n`;

    await createMultiFileCommit(project, message, {
      'COUNTER.md': JSON.stringify(counter, null, 2) + '\n',
      'NOTES.md': notes,
      'CHANGELOG.md': changelog,
    });
    made++;
    messages.push(message);
    if (i < n - 1) await sleep(randInt(1500, 4000));
  }

  return { made, messages };
}

export async function makeQuickCommit(project: Project) {
  const { made, messages } = await makeCommits(project, 1);
  return { made, message: messages[0] || 'Quick commit' };
}
