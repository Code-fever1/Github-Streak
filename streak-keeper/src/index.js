#!/usr/bin/env node
import { loadConfig } from './config.js';
import { GitRepo } from './git.js';
import { Planner, buildDailyPlan } from './planner.js';
import { Committer } from './committer.js';
import { log, dbg, die, setVerbose } from './logger.js';

function parseArgs(argv) {
  const args = { once: false, planOnly: false, selfTest: false, verbose: false, config: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--once') args.once = true;
    else if (a === '--plan-only') args.planOnly = true;
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--config' || a === '-c') args.config = argv[++i];
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`streak-keeper — GitHub contribution streak maintainer

Usage:
  streak-keeper [options]

Options:
  --once        Run a single hourly tick (make this hour's commits, push, exit).
                This is what the systemd timer invokes.
  --plan-only   Generate (or read) today's plan and print it, then exit.
                No commits, no push.
  --self-test   Run internal planner/committer logic checks, then exit.
  --config FILE Path to config.json (overrides STREAK_CONFIG).
  -v, --verbose Verbose debug logging.
  -h, --help    Show this help.

Configuration:
  Copy config.example.json to config.json and set repoUrl.
  See README.md for systemd timer setup.`);
}

async function runOnce(config) {
  const repo = new GitRepo(config);
  log(`Ensuring repo is cloned at ${repo.workDir}...`);
  repo.ensureCloned();

  const planner = new Planner(config);
  const plan = planner.getTodayPlan();
  log(`Today's plan: ${plan.total} commits remaining (quiet=${plan.isQuiet}).`);

  const n = planner.commitsForCurrentHour(plan);
  log(`Commits scheduled for this hour: ${n}.`);

  if (n <= 0) {
    log('Nothing to do this hour.');
    return;
  }

  const committer = new Committer(config, repo);
  const made = await committer.makeCommits(n);
  planner.recordCommits(plan, made);

  if (made > 0 && config.push) {
    log('Pushing to origin...');
    repo.push();
  }
  log('Done.');
}

function runPlanOnly(config) {
  const planner = new Planner(config);
  const plan = planner.getTodayPlan();
  console.log(JSON.stringify(plan, null, 2));
}

function runSelfTest(config) {
  let pass = 0;
  let fail = 0;
  const check = (name, cond, detail = '') => {
    if (cond) {
      pass++;
      dbg(`self-test OK: ${name}`);
    } else {
      fail++;
      console.error(`self-test FAIL: ${name} ${detail}`);
    }
  };

  // Planner produces a plan within bounds.
  for (let i = 0; i < 200; i++) {
    const plan = buildDailyPlan(config.schedule);
    const total = plan.hours.reduce((s, n) => s + n, 0);
    check('plan total >= 0', total >= 0, `got ${total}`);
    check('plan total matches sum', total === plan.total, `${total} vs ${plan.total}`);
    check('per-hour within bounds', plan.hours.every((h) => h >= 0 && h <= config.schedule.maxPerHour));
    if (plan.isQuiet) {
      check('quiet day within quiet max', total <= config.schedule.quietDayMax, `got ${total}`);
    } else {
      // non-quiet days should be in [dailyMin, dailyMax] (allow small slack from distribution)
      check('normal day within daily range', total >= config.schedule.dailyMin * 0.8 && total <= config.schedule.dailyMax, `got ${total}`);
    }
  }

  // Deterministic-ish: quiet day chance roughly respected over many trials.
  let quietCount = 0;
  const trials = 1000;
  for (let i = 0; i < trials; i++) {
    if (buildDailyPlan(config.schedule).isQuiet) quietCount++;
  }
  const ratio = quietCount / trials;
  check('quiet day chance roughly in range', ratio > 0.05 && ratio < 0.35, `ratio=${ratio.toFixed(2)}`);

  console.log(`\nself-test: ${pass} passed, ${fail} failed`);
  if (fail > 0) die('self-test failed', 1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  setVerbose(args.verbose);

  if (args.selfTest && !args.config) {
    // Self-test doesn't need a real repo, only a schedule.
    process.env.STREAK_REPO_URL = process.env.STREAK_REPO_URL || 'self-test://dummy';
  }

  let config;
  try {
    config = loadConfig(args.config);
  } catch (err) {
    die(err.message);
  }

  if (args.selfTest) {
    runSelfTest(config);
    return;
  }

  if (args.planOnly) {
    runPlanOnly(config);
    return;
  }

  // Default and --once both run a single tick.
  try {
    await runOnce(config);
  } catch (err) {
    die(err.message);
  }
}

main();
