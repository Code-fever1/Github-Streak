# streak-keeper

A server-side, systemd-timed Node.js tool that makes realistic, randomized commits to a private GitHub repository so your contribution streak stays green.

## What it does

- **Clones** a private repo on first run.
- **Plans one day at a time** with realistic activity:
  - Most days: 24–100 commits total.
  - Occasional quiet days: 1–16 commits.
  - Commits are distributed across waking hours, with random hour-to-hour intensity.
- **Runs once per hour** via a user `systemd` timer.
- **Makes 1–5 commits per active hour**, each editing:
  - `COUNTER.md` — running JSON counter.
  - `NOTES.md` — timestamped dev-style notes.
  - `CHANGELOG.md` — short changelog line.
- **Varied commit messages** so the history doesn't look machine-made.
- **Pushes** to the configured `origin` branch.

## Quick start

```bash
cd /home/alijah/Documents/PROJECTS/Github-Streak/streak-keeper

# 1. Copy and fill in the config.
cp config.example.json config.json
# edit config.json: set repoUrl, git identity, and optional schedule tweaks.

# 2. Make sure your git credentials/SSH key work for the private repo.
#    (The script runs `git clone` and `git push` using the system git.)

# 3. Install the systemd user timer.
./install.sh

# 4. Watch it run.
journalctl --user -u streak-keeper.service -f
```

## Configuration

Edit `config.json` (or set environment variables). Minimal example:

```json
{
  "repoUrl": "git@github.com:your-username/your-private-repo.git",
  "workDir": "$HOME/.streak-keeper/work",
  "stateDir": "$HOME/.streak-keeper/state",
  "git": {
    "authorName": "Your Name",
    "authorEmail": "your.email@example.com",
    "branch": "main"
  }
}
```

All keys can be overridden with environment variables:

| Variable | Maps to |
|----------|---------|
| `STREAK_REPO_URL` | `repoUrl` |
| `STREAK_WORK_DIR` | `workDir` |
| `STREAK_STATE_DIR` | `stateDir` |
| `STREAK_GIT_NAME` | `git.authorName` |
| `STREAK_GIT_EMAIL` | `git.authorEmail` |
| `STREAK_GIT_BRANCH` | `git.branch` |
| `STREAK_PUSH` | `push` (`true`/`false`) |
| `STREAK_DRY_RUN` | `dryRun` (`true`/`false`) |

## Commands

```bash
# Run a single hourly tick now (also what the timer does).
node src/index.js --once

# Print today's generated plan without committing.
node src/index.js --plan-only

# Run internal self-tests for the planner.
node src/index.js --self-test

# Verbose debug logging.
node src/index.js -v --once
```

## Systemd management

The install script sets up a user timer that fires roughly every hour with a randomized 25-minute delay.

```bash
# Trigger now
systemctl --user start streak-keeper.service

# Check timer
systemctl --user list-timers streak-keeper.timer

# View recent logs
journalctl --user -u streak-keeper.service -n 50

# Disable
systemctl --user disable --now streak-keeper.timer
```

## How the randomization works

1. At the first run of each UTC day a plan is generated and stored under `stateDir`.
2. The planner chooses a daily "mode":
   - `quiet` ~18% of the time (low day; 1–16 commits).
   - `normal`/`busy` the rest (24–100 commits).
3. Commits are distributed across 24 hours using weighted activity windows:
   - More likely in typical work/evening hours.
   - Less likely during sleep / lunch.
   - Capped at 5 commits per hour.
4. Each actual run makes 1–5 commits with random dev-style messages and tags.

## Security notes

- Keep `config.json` out of git — it may contain the repo URL and is ignored via the top-level `.gitignore` by default.
- Use an SSH key or token that only has access to the target repo.
- This tool only touches the configured `workDir` and `stateDir`; it never writes anywhere else.
