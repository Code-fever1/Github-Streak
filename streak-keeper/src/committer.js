import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { log, dbg } from './logger.js';

const COMMIT_MESSAGES = [
  'Update activity counter',
  'Log daily progress notes',
  'Tweak notes layout',
  'Refactor notes section',
  'Bump counter',
  'Add notes entry for this session',
  'Clean up notes formatting',
  'Record work session',
  'Update changelog notes',
  'Adjust notes metadata',
  'Sync counter state',
  'Revise notes wording',
  'Mark session complete',
  'Increment counter',
  'Polish notes wording',
  'Update session log',
  'Tidy notes file',
  'Refresh counter value',
  'Append progress note',
  'Update dev journal',
];

const NOTE_TOPICS = [
  'Reviewed pending TODO items',
  'Skimmed latest dependency release notes',
  'Tidied up local config files',
  'Drafted next steps for the roadmap',
  'Reviewed yesterday\'s notes',
  'Sanity-checked the build output',
  'Noted an idea for a future refactor',
  'Cleaned up stale branches locally',
  'Re-read a section of the docs',
  'Outlined a small cleanup task',
  'Logged a minor observation',
  'Reviewed open issues queue',
  'Brainstormed naming for an upcoming module',
  'Noted a potential edge case to revisit',
  'Sketched a quick plan for tomorrow',
  'Reviewed recent commit history',
  'Noted a small win from today',
  'Drafted a short follow-up reminder',
  'Reviewed a snippet of old code',
  'Captured a passing thought for later',
];

const TAGS = ['notes', 'chore', 'journal', 'housekeeping', 'log', 'meta', 'docs', 'misc'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function timestamp() {
  return new Date().toISOString();
}

function shortDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export class Committer {
  constructor(config, repo) {
    this.config = config;
    this.repo = repo;
    this.counterPath = resolve(repo.repoPath, 'COUNTER.md');
    this.notesPath = resolve(repo.repoPath, 'NOTES.md');
    this.changelogPath = resolve(repo.repoPath, 'CHANGELOG.md');
  }

  _readCounter() {
    if (!existsSync(this.counterPath)) return { total: 0, daily: {}, lastUpdated: null };
    try {
      return JSON.parse(readFileSync(this.counterPath, 'utf8'));
    } catch {
      return { total: 0, daily: {}, lastUpdated: null };
    }
  }

  _writeCounter(state) {
    state.lastUpdated = timestamp();
    writeFileSync(this.counterPath, JSON.stringify(state, null, 2) + '\n');
  }

  _appendNotes(entry) {
    if (!existsSync(this.notesPath)) {
      writeFileSync(
        this.notesPath,
        `# Development Notes\n\nA running journal of small daily activity.\n\n`,
      );
    }
    appendFileSync(this.notesPath, `## ${entry.time}\n\n- ${entry.topic}\n- tag: \`${entry.tag}\`\n- session: #${entry.session}\n\n`);
  }

  _appendChangelog(entry) {
    if (!existsSync(this.changelogPath)) {
      writeFileSync(this.changelogPath, `# Changelog\n\n`);
    }
    appendFileSync(this.changelogPath, `- [${shortDate()}] ${entry.topic} (#${entry.session})\n`);
  }

  // Make `n` commits, each with a realistic counter + notes change.
  async makeCommits(n) {
    if (n <= 0) {
      log('No commits scheduled for this hour.');
      return 0;
    }

    this.repo.configureIdentity();
    let made = 0;

    for (let i = 0; i < n; i++) {
      const state = this._readCounter();
      state.total = (state.total || 0) + 1;
      const day = shortDate();
      state.daily ??= {};
      state.daily[day] = (state.daily[day] || 0) + 1;

      const session = state.total;
      const entry = {
        time: timestamp(),
        topic: pick(NOTE_TOPICS),
        tag: pick(TAGS),
        session,
      };

      // Write counter + notes + changelog.
      this._writeCounter(state);
      this._appendNotes(entry);
      this._appendChangelog(entry);

      this.repo.stageAll();
      const message = this._buildMessage(entry);
      const ok = this.repo.commit(message);
      if (ok) {
        made++;
        dbg(`committed #${session}: ${message}`);
        // Small jitter between commits so timestamps differ.
        if (i < n - 1) await this._sleep(randInt(2000, 8000));
      }
    }

    log(`Made ${made}/${n} commits this run.`);
    return made;
  }

  _buildMessage(entry) {
    const styles = [
      `${pick(COMMIT_MESSAGES)} (#${entry.session})`,
      `${pick(COMMIT_MESSAGES).toLowerCase()}`,
      `${entry.tag}: ${pick(COMMIT_MESSAGES)}`,
      `${pick(COMMIT_MESSAGES)} — ${entry.tag}`,
      `${pick(COMMIT_MESSAGES)}`,
    ];
    return pick(styles);
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
