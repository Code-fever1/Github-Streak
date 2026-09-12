<p align="center">
  <img src="./streak-keeper/assets/banner.svg" alt="streak-keeper" width="100%" />
</p>

<p align="center">
  <a href="./streak-keeper/README.md#quick-start">
    <img src="https://img.shields.io/badge/get_started-3_steps-22c55e?logo=linux&style=for-the-badge" alt="quick start" />
  </a>
  <a href="./streak-keeper/config.example.json">
    <img src="https://img.shields.io/badge/configure-json_+_env-0ea5e9?style=for-the-badge" alt="config" />
  </a>
  <img src="https://img.shields.io/badge/runs-systemd_timer-8b5cf6?style=for-the-badge" alt="systemd" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-3b82f6?style=for-the-badge&logo=nodedotjs" alt="node" />
  <img src="https://img.shields.io/badge/license-MIT-0ea5e9?style=for-the-badge" alt="license" />
</p>

<h2 align="center">The server-side streak engine</h2>

<p align="center">
  A tiny Node.js service that keeps a private GitHub repository busy with realistic, hourly commits.
</p>

---

## :package: What lives here

```
Github-Streak/
├── .gitignore          # ignores Flutter artifacts and streak-keeper runtime files
├── mobile/             # React Native (Expo) mobile app
│   ├── app/            # screens (projects, activity, project detail)
│   ├── lib/            # planner, GitHub API, scheduler
│   └── README.md       # mobile setup guide
├── streak-keeper/      # the streak-keeping engine
│   ├── src/            # source code
│   ├── systemd/        # systemd user service + timer templates
│   ├── assets/         # banner and visuals
│   ├── config.example.json
│   ├── install.sh
│   └── README.md       # full documentation
└── README.md           # you are here
```

---

## :iphone: Mobile app

Runs on the phone. Paste a GitHub repo, add the SSH key, done. Offline commits wait in a queue.

```bash
cd mobile && npm start
```

See [`mobile/README.md`](./mobile/README.md).

---

## :rocket: Quick start (server)

All the server-side action is inside `streak-keeper/`:

```bash
cd streak-keeper
cp config.example.json config.json
# edit config.json and set repoUrl

./install.sh
journalctl --user -u streak-keeper.service -f
```

See the full guide in [`streak-keeper/README.md`](./streak-keeper/README.md).

---

## :link: Documentation

- [`streak-keeper/README.md`](./streak-keeper/README.md) — detailed setup, commands, and configuration.
- [`streak-keeper/config.example.json`](./streak-keeper/config.example.json) — annotated configuration template.
- [`streak-keeper/src/`](./streak-keeper/src/) — planner, committer, git wrapper, and CLI.

---

<p align="center">
  Built for green squares.
</p>
