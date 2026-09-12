# Streak Keeper Mobile

All on the phone. Paste a GitHub repo, add the SSH key GitHub shows you, done.

Offline commits are **queued** and sent when the app is open with internet (and in the background when the OS allows).

## Run

```bash
cd mobile
npm start
```

## Add a repo

1. Paste `https://github.com/you/your-repo`
2. Copy the SSH key
3. GitHub → repo → **Settings → Deploy keys → Add** → allow **write**
4. **+1 now** or let the timer run

Each user gets their own random SSH key. Private key stays on the device (secure store).

## Offline

If there is no internet, commits are saved in a queue. They go out as soon as you are online or you open the app again.

## Timer

On the project screen: every 15m / 30m / 1h / 2h / 4h, or fixed times.
