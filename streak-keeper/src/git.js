import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { log, die } from './logger.js';

function git(args, opts = {}) {
  const { cwd, quiet = false, ignoreError = false } = opts;
  try {
    const out = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    if (!quiet && out.trim()) log(`git ${args.join(' ')} -> ${out.trim().split('\n')[0]}`);
    return out.toString();
  } catch (err) {
    if (ignoreError) return '';
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    if (quiet) return '';
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
  }
}

export class GitRepo {
  constructor(config) {
    this.config = config;
    this.url = config.repoUrl;
    this.workDir = resolve(config.workDir);
    this.branch = config.git.branch;
    this.name = config.git.authorName;
    this.email = config.git.authorEmail;
    this.depth = config.git.cloneDepth;
    this.dryRun = config.dryRun;
  }

  get repoPath() {
    return this.workDir;
  }

  isCloned() {
    return existsSync(resolve(this.workDir, '.git'));
  }

  ensureCloned() {
    if (this.isCloned()) {
      log(`Repo already present at ${this.workDir}, fetching...`);
      // Make sure remote is up to date and we're on the right branch.
      git(['fetch', '--quiet', 'origin'], { cwd: this.workDir, quiet: true });
      this._checkoutBranch();
      git(['pull', '--quiet', '--ff-only', 'origin', this.branch], {
        cwd: this.workDir,
        quiet: true,
        ignoreError: true,
      });
      return;
    }

    mkdirSync(this.workDir, { recursive: true });
    log(`Cloning ${this.url} into ${this.workDir}...`);
    git(['clone', '--quiet', `--depth=${this.depth}`, '--branch', this.branch, this.url, this.workDir], {
      quiet: true,
      ignoreError: true,
    });
    // Fallback: branch may not exist on a fresh repo; clone default then create branch.
    if (!this.isCloned()) {
      git(['clone', '--quiet', `--depth=${this.depth}`, this.url, this.workDir], { quiet: true });
      this._checkoutBranch({ createIfMissing: true });
    }
    this.configureIdentity();
  }

  _checkoutBranch({ createIfMissing = false } = {}) {
    const branches = git(['branch', '--list'], { cwd: this.workDir, quiet: true });
    const exists = branches.split('\n').some((b) => b.trim().replace(/^\*/, '') === this.branch);
    if (exists) {
      git(['checkout', '--quiet', this.branch], { cwd: this.workDir, quiet: true });
    } else if (createIfMissing) {
      git(['checkout', '--quiet', '-b', this.branch], { cwd: this.workDir, quiet: true });
    }
  }

  configureIdentity() {
    git(['config', 'user.name', this.name], { cwd: this.workDir, quiet: true });
    git(['config', 'user.email', this.email], { cwd: this.workDir, quiet: true });
    git(['config', 'commit.gpgsign', 'false'], { cwd: this.workDir, quiet: true });
  }

  stage(file) {
    git(['add', '--', file], { cwd: this.workDir, quiet: true });
  }

  stageAll() {
    git(['add', '-A'], { cwd: this.workDir, quiet: true });
  }

  hasStagedChanges() {
    const out = git(['status', '--porcelain'], { cwd: this.workDir, quiet: true });
    return out.trim().length > 0;
  }

  commit(message) {
    if (!this.hasStagedChanges()) {
      log('No staged changes, skipping commit.');
      return false;
    }
    if (this.dryRun) {
      log(`[dry-run] would commit: ${message}`);
      return true;
    }
    git(['commit', '--quiet', '-m', message], { cwd: this.workDir, quiet: true });
    return true;
  }

  push() {
    if (this.dryRun) {
      log('[dry-run] would push to origin');
      return;
    }
    git(['push', '--quiet', 'origin', this.branch], { cwd: this.workDir, quiet: true, ignoreError: true });
  }
}
