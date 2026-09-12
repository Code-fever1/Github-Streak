<p align="center">
  <img src="./assets/banner.svg" alt="streak-keeper" width="100%" />
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/setup-3_steps-22c55e?logo=linux&style=for-the-badge" alt="setup: 3 steps" /></a>
  <a href="#configuration"><img src="https://img.shields.io/badge/config-json_+_env-0ea5e9?style=for-the-badge" alt="config" /></a>
  <a href="#systemd-management"><img src="https://img.shields.io/badge/runs-systemd_timer-8b5cf6?style=for-the-badge" alt="runs on systemd" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-3b82f6?style=for-the-badge&logo=nodedotjs" alt="node >= 18" />
  <img src="https://img.shields.io/badge/license-MIT-0ea5e9?style=for-the-badge" alt="license: MIT" />
</p>

<h2 align="center">A tiny, server-side bot that commits realistically to a private repo.</h2>

<p align="center">
  It plans a full day of activity, then runs once per hour to make 1–5 commits. Some days are quiet, some are busy — just like a real person.
</p>

---

## :zap: What it does

- :package: **Clones** a private repo on first run and keeps it in sync.
- :brain: **Plans one day at a time** with realistic activity patterns.
- :clock1: **Runs hourly** via a user `systemd` timer with randomized jitter.
- :fire: **Makes 1–5 commits per active hour** to keep the graph green.
- :speech_balloon: **Writes real-looking files**: `COUNTER.md`, `NOTES.md`, `CHANGELOG.md`.
- :key: **All settings** can live in `config.json` or as environment variables.

---

## :iphone: Phone remote (recommended)

The Expo app is a remote control. **Scheduled commits run on this server**, so the streak continues when the phone is offline. Instant **+1** from the app hits this API and commits immediately.

```bash
cd streak-keeper
npm run serve
```

Copy the printed **API token** and your LAN IP into the app **Settings** tab (`http://YOUR-LAN-IP:8787`).

SSH deploy keys are generated here with `ssh-keygen` and stored under `state/`. The phone only shows the public key.

Optional: `STREAK_API_TOKEN`, `STREAK_PORT`, `STREAK_HOST`.

---

## :rocket: Quick start (CLI timer, single repo)

```bash
cd streak-keeper

# 1. Copy and edit the config
cp config.example.json config.json
# set repoUrl, authorName, authorEmail

# 2. Make sure your machine can clone/push that repo
# (SSH key, token, or git credentials)

# 3. Install and enable the hourly timer
./install.sh

# 4. Watch it work
journalctl --user -u streak-keeper.service -f
```

---

## :gear: Configuration

### Minimal `config.json`

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

### Environment overrides

| Variable | Maps to | Example |
|----------|---------|---------|
| `STREAK_REPO_URL` | `repoUrl` | `git@github.com:...` |
| `STREAK_WORK_DIR` | `workDir` | `$HOME/.streak-keeper/work` |
| `STREAK_STATE_DIR` | `stateDir` | `$HOME/.streak-keeper/state` |
| `STREAK_GIT_NAME` | `git.authorName` | `Your Name` |
| `STREAK_GIT_EMAIL` | `git.authorEmail` | `you@example.com` |
| `STREAK_GIT_BRANCH` | `git.branch` | `main` |
| `STREAK_PUSH` | `push` | `true` / `false` |
| `STREAK_DRY_RUN` | `dryRun` | `true` / `false` |

---

## :hammer: Commands

| Command | What it does |
|---------|--------------|
| `node src/index.js --once` | Run a single hourly tick right now. |
| `node src/index.js --plan-only` | Print today's plan without committing. |
| `node src/index.js --self-test` | Run 800+ planner sanity checks. |
| `node src/index.js -v --once` | Run a tick with debug logging. |

---

## :hourglass: Systemd management

```bash
# Trigger immediately
systemctl --user start streak-keeper.service

# Check the schedule
systemctl --user list-timers streak-keeper.timer

# View logs
journalctl --user -u streak-keeper.service -n 50

# Stop completely
systemctl --user disable --now streak-keeper.timer
```

---

## :game_die: How the randomization works

1. At the first run of each UTC day a new plan is written to `stateDir`.
2. The day chooses a realistic mode:
   - :leaves: **Quiet day** ~18% of the time: 1–16 commits.
   - :chart_with_upwards_trend: **Normal / busy day** the rest: 24–100 commits.
3. Commits are spread across 24 hours with waking/evening weighted windows.
4. Each active hour produces 1–5 commits with varied dev-style messages.

---

## :lock: Security notes

- `config.json`, `work/`, and `state/` are ignored by the top-level `.gitignore` so they are not committed.
- Use an SSH key or token with access only to the target repo.
- The tool only writes to its configured `workDir` and `stateDir`.

---

<p align="center">
  Built for people who like green squares.
</p>
