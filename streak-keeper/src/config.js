import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const HOME = homedir();

function expandPath(p) {
  if (!p) return p;
  if (p.startsWith('$HOME')) return p.replace('$HOME', HOME);
  if (p.startsWith('~/')) return resolve(HOME, p.slice(2));
  return resolve(p);
}

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over;
  if (Array.isArray(over) || typeof over !== 'object' || over === null) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

const ENV_MAP = {
  STREAK_REPO_URL: 'repoUrl',
  STREAK_WORK_DIR: 'workDir',
  STREAK_STATE_DIR: 'stateDir',
  STREAK_GIT_NAME: ['git', 'authorName'],
  STREAK_GIT_EMAIL: ['git', 'authorEmail'],
  STREAK_GIT_BRANCH: ['git', 'branch'],
  STREAK_PUSH: 'push',
  STREAK_DRY_RUN: 'dryRun',
  STREAK_MIN_PER_HOUR: ['schedule', 'minPerHour'],
  STREAK_MAX_PER_HOUR: ['schedule', 'maxPerHour'],
  STREAK_DAILY_MIN: ['schedule', 'dailyMin'],
  STREAK_DAILY_MAX: ['schedule', 'dailyMax'],
  STREAK_QUIET_DAY_CHANCE: ['schedule', 'quietDayChance'],
  STREAK_QUIET_DAY_MAX: ['schedule', 'quietDayMax'],
};

function setPath(obj, path, value) {
  const keys = Array.isArray(path) ? path : [path];
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = cur[keys[i]] ?? {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function coerce(value) {
  if (value === undefined || value === null) return value;
  const s = String(value).trim();
  if (s === '') return s;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

export function loadConfig(configPath) {
  let fileConfig = {};
  const paths = [
    configPath,
    process.env.STREAK_CONFIG,
    resolve(process.cwd(), 'config.json'),
    resolve(homedir(), '.streak-keeper', 'config.json'),
  ].filter(Boolean);

  for (const p of paths) {
    if (p && existsSync(p)) {
      fileConfig = deepMerge(fileConfig, JSON.parse(readFileSync(p, 'utf8')));
      break;
    }
  }

  // Strip _comment keys.
  const strip = (o) => {
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      for (const k of Object.keys(o)) {
        if (k.startsWith('_')) delete o[k];
        else strip(o[k]);
      }
    }
  };
  strip(fileConfig);

  const envOver = {};
  for (const [envKey, cfgPath] of Object.entries(ENV_MAP)) {
    if (process.env[envKey] !== undefined) {
      setPath(envOver, cfgPath, coerce(process.env[envKey]));
    }
  }

  const merged = deepMerge(fileConfig, envOver);

  // Defaults.
  merged.workDir = expandPath(merged.workDir ?? '$HOME/.streak-keeper/work');
  merged.stateDir = expandPath(merged.stateDir ?? '$HOME/.streak-keeper/state');
  merged.git ??= {};
  merged.git.authorName ??= 'streak-keeper';
  merged.git.authorEmail ??= 'streak-keeper@users.noreply.github.com';
  merged.git.branch ??= 'main';
  merged.git.cloneDepth ??= 1;
  merged.schedule ??= {};
  merged.schedule.minPerHour ??= 1;
  merged.schedule.maxPerHour ??= 5;
  merged.schedule.dailyMin ??= 24;
  merged.schedule.dailyMax ??= 100;
  merged.schedule.quietDayChance ??= 0.18;
  merged.schedule.quietDayMax ??= 16;
  merged.push ??= true;
  merged.dryRun ??= false;

  if (!merged.repoUrl) {
    throw new Error('No repoUrl configured. Set repoUrl in config.json or STREAK_REPO_URL env var.');
  }

  return merged;
}
