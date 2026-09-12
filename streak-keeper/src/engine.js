import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GitRepo } from './git.js';
import { Planner } from './planner.js';
import { Committer } from './committer.js';
import { generateEd25519Key, publicKeyFromPrivate, sshCommand } from './ssh.js';
import { currentFixedSlot, commitsForScheduledTick, shouldRunTick } from './timer.js';
import { log } from './logger.js';

const locks = new Map();

async function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(
    id,
    prev.then(() => next),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function gitConfigFor(project, secrets, workRoot, keysDir) {
  const workDir = join(workRoot, project.id);
  mkdirSync(workDir, { recursive: true });
  mkdirSync(keysDir, { recursive: true });

  const git = {
    authorName: project.authorName,
    authorEmail: project.authorEmail,
    branch: project.branch,
    cloneDepth: 1,
  };

  if (project.authType === 'ssh') {
    if (!secrets.sshPrivateKey) throw new Error('No SSH private key stored on the server for this project.');
    const keyPath = join(keysDir, project.id);
    writeFileSync(keyPath, secrets.sshPrivateKey.endsWith('\n') ? secrets.sshPrivateKey : `${secrets.sshPrivateKey}\n`, {
      mode: 0o600,
    });
    chmodSync(keyPath, 0o600);
    return {
      repoUrl: `git@github.com:${project.owner}/${project.repo}.git`,
      workDir,
      git,
      push: true,
      dryRun: false,
      gitEnv: { GIT_SSH_COMMAND: sshCommand(keyPath) },
    };
  }

  if (!secrets.token) throw new Error('No GitHub token stored on the server for this project.');
  return {
    repoUrl: `https://x-access-token:${secrets.token}@github.com/${project.owner}/${project.repo}.git`,
    workDir,
    git,
    push: true,
    dryRun: false,
  };
}

function openRepo(project, secrets, paths) {
  const config = gitConfigFor(project, secrets, paths.workDir, paths.keysDir);
  return new GitRepo(config);
}

export function generateSshKeyPair() {
  return generateEd25519Key('streak-keeper');
}

export function importSshPrivateKey(privateKey) {
  const publicKey = publicKeyFromPrivate(privateKey);
  return { privateKey: privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`, publicKey };
}

export async function verifyProjectAccess(project, secrets, paths) {
  const repo = openRepo(project, secrets, paths);
  repo.lsRemote();
}

export async function runScheduledTick(store, project, paths, { force = false } = {}) {
  return withLock(project.id, async () => {
    const now = new Date();
    const base = {
      id: `${project.id}-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      message: '',
      commits: 0,
      timestamp: now.toISOString(),
      success: false,
    };

    if (!project.enabled && !force) {
      return { ...base, message: 'Project paused', success: true };
    }

    const ticks = store.readTicks();
    if (!force && !shouldRunTick(project, ticks.lastTicks[project.id] || null, now, ticks.lastFixedSlots[project.id] || null)) {
      return { ...base, message: 'Not due yet', success: true };
    }

    try {
      const secrets = store.getSecrets(project.id);
      const repo = openRepo(project, secrets, paths);
      log(`Tick ${project.name}: ensuring clone...`);
      repo.ensureCloned();

      const planner = new Planner({
        stateDir: join(paths.stateDir, 'plans', project.id),
        schedule: project.schedule,
      });
      const plan = planner.getTodayPlan();
      const n = commitsForScheduledTick(project, plan, now);

      if (n <= 0) {
        store.setLastTick(project.id, now, project.timer?.mode === 'fixed_times' ? currentFixedSlot(now) : null);
        return { ...base, message: 'Nothing scheduled for this slot', success: true };
      }

      const committer = new Committer({ push: true }, repo);
      const made = await committer.makeCommits(n);
      planner.recordCommits(plan, made);
      if (made > 0) repo.push();
      store.setLastTick(project.id, now, project.timer?.mode === 'fixed_times' ? currentFixedSlot(now) : null);

      return {
        ...base,
        message: made > 0 ? `Scheduled tick: ${made} commit(s)` : 'No commits made',
        commits: made,
        success: true,
      };
    } catch (err) {
      return { ...base, message: 'Tick failed', error: err.message, success: false };
    }
  });
}

/** One-shot git+SSH commit using a client-supplied deploy key (localhost Expo). */
export async function runEphemeralCommits(paths, body) {
  const n = Math.min(Math.max(Number(body.n) || 1, 1), 20);
  const project = {
    id: String(body.id || `${body.owner}-${body.repo}`),
    name: `${body.owner}/${body.repo}`,
    owner: body.owner,
    repo: body.repo,
    branch: body.branch || 'main',
    authorName: body.authorName || body.owner,
    authorEmail: body.authorEmail || `${body.owner}@users.noreply.github.com`,
    authType: 'ssh',
    enabled: true,
  };
  const secrets = { sshPrivateKey: body.privateKey };
  return withLock(project.id, async () => {
    const repo = openRepo(project, secrets, paths);
    repo.ensureCloned();
    const committer = new Committer({ push: true }, repo);
    const made = await committer.makeCommits(n);
    if (made > 0) repo.push();
    return { made };
  });
}

export async function runQuickCommit(store, project, paths) {
  return withLock(project.id, async () => {
    const now = new Date();
    const base = {
      id: `${project.id}-${Date.now()}`,
      projectId: project.id,
      projectName: project.name,
      message: '',
      commits: 0,
      timestamp: now.toISOString(),
      success: false,
      manual: true,
    };

    if (!project.enabled) {
      return { ...base, message: 'Project paused', error: 'Enable the project first', success: false };
    }

    try {
      const secrets = store.getSecrets(project.id);
      const repo = openRepo(project, secrets, paths);
      repo.ensureCloned();
      const committer = new Committer({ push: true }, repo);
      const made = await committer.makeCommits(1);
      if (made > 0) repo.push();
      return {
        ...base,
        message: '[+1] Instant commit',
        commits: made,
        success: made > 0,
        error: made > 0 ? undefined : 'Git produced no commit',
      };
    } catch (err) {
      return { ...base, message: 'Quick commit failed', error: err.message, success: false };
    }
  });
}

export function getTodayPlan(project, paths) {
  const planner = new Planner({
    stateDir: join(paths.stateDir, 'plans', project.id),
    schedule: project.schedule,
  });
  return planner.getTodayPlan();
}

export async function runDueTicks(store, paths) {
  const results = [];
  for (const project of store.listProjects().filter((p) => p.enabled)) {
    const ticks = store.readTicks();
    if (!shouldRunTick(project, ticks.lastTicks[project.id] || null, new Date(), ticks.lastFixedSlots[project.id] || null)) {
      continue;
    }
    const logEntry = await runScheduledTick(store, project, paths, { force: false });
    if (logEntry.message !== 'Not due yet') {
      store.appendLog(logEntry);
      results.push(logEntry);
    }
  }
  return results;
}
