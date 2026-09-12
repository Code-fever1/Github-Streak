import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const DEFAULT_SCHEDULE = {
  minPerHour: 1,
  maxPerHour: 5,
  dailyMin: 24,
  dailyMax: 100,
  quietDayChance: 0.18,
  quietDayMax: 16,
};

const DEFAULT_TIMER = { mode: 'interval', intervalMinutes: 60 };

export class Store {
  constructor(stateDir) {
    this.stateDir = stateDir;
    this.keysDir = join(stateDir, 'keys');
    mkdirSync(this.keysDir, { recursive: true });
    this.projectsPath = join(stateDir, 'projects.json');
    this.secretsPath = join(stateDir, 'secrets.json');
    this.metaPath = join(stateDir, 'api.json');
    this.ticksPath = join(stateDir, 'ticks.json');
    this.logsPath = join(stateDir, 'logs.json');
    this.pendingKeysPath = join(stateDir, 'pending-keys.json');
  }

  _read(path, fallback) {
    if (!existsSync(path)) return fallback;
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return fallback;
    }
  }

  _write(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  }

  getApiToken() {
    const meta = this._read(this.metaPath, {});
    if (meta.apiToken) return meta.apiToken;
    const apiToken = randomBytes(24).toString('hex');
    this._write(this.metaPath, { apiToken, createdAt: new Date().toISOString() });
    return apiToken;
  }

  listProjects() {
    return this._read(this.projectsPath, []);
  }

  saveProjects(projects) {
    this._write(this.projectsPath, projects);
  }

  getProject(id) {
    return this.listProjects().find((p) => p.id === id) || null;
  }

  upsertProject(project) {
    const projects = this.listProjects();
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) projects[idx] = project;
    else projects.push(project);
    this.saveProjects(projects);
    return project;
  }

  deleteProject(id) {
    this.saveProjects(this.listProjects().filter((p) => p.id !== id));
    const secrets = this._read(this.secretsPath, {});
    delete secrets[id];
    this._write(this.secretsPath, secrets);
    const ticks = this.readTicks();
    delete ticks.lastTicks[id];
    delete ticks.lastFixedSlots[id];
    this._write(this.ticksPath, ticks);
  }

  getSecrets(id) {
    return this._read(this.secretsPath, {})[id] || {};
  }

  setSecrets(id, patch) {
    const all = this._read(this.secretsPath, {});
    all[id] = { ...(all[id] || {}), ...patch };
    this._write(this.secretsPath, all);
  }

  savePendingKey(id, privateKey, publicKey) {
    const pending = this._read(this.pendingKeysPath, {});
    pending[id] = { privateKey, publicKey, createdAt: new Date().toISOString() };
    this._write(this.pendingKeysPath, pending);
  }

  takePendingKey(id) {
    const pending = this._read(this.pendingKeysPath, {});
    const key = pending[id];
    if (!key) return null;
    delete pending[id];
    this._write(this.pendingKeysPath, pending);
    return key;
  }

  peekPendingKey(id) {
    return this._read(this.pendingKeysPath, {})[id] || null;
  }

  readTicks() {
    const data = this._read(this.ticksPath, {});
    return {
      lastTicks: data.lastTicks || {},
      lastFixedSlots: data.lastFixedSlots || {},
    };
  }

  setLastTick(id, now = new Date(), fixedSlot = null) {
    const ticks = this.readTicks();
    ticks.lastTicks[id] = now.toISOString();
    if (fixedSlot) ticks.lastFixedSlots[id] = fixedSlot;
    this._write(this.ticksPath, ticks);
  }

  listLogs() {
    return this._read(this.logsPath, []);
  }

  appendLog(entry) {
    const logs = this.listLogs();
    logs.unshift(entry);
    this._write(this.logsPath, logs.slice(0, 300));
    return entry;
  }
}

export function newProjectId() {
  return `${Date.now()}-${randomBytes(3).toString('hex')}`;
}

export function normalizeProject(raw) {
  return {
    id: raw.id,
    name: raw.name || `${raw.owner}/${raw.repo}`,
    owner: raw.owner,
    repo: raw.repo,
    authorName: raw.authorName || 'streak-keeper',
    authorEmail: raw.authorEmail || 'streak-keeper@users.noreply.github.com',
    branch: raw.branch || 'main',
    enabled: raw.enabled !== false,
    authType: raw.authType || 'token',
    sshPublicKey: raw.sshPublicKey,
    schedule: raw.schedule || DEFAULT_SCHEDULE,
    timer: raw.timer || DEFAULT_TIMER,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export { DEFAULT_SCHEDULE, DEFAULT_TIMER };
