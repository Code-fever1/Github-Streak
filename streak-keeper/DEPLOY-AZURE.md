# Deploy streak-keeper on Azure (backend for the mobile app)

The phone only **controls** the server. All git commits, SSH keys, and timers run on your Azure VM 24/7.

## Architecture

```
Phone (Expo)  ──HTTP──►  Azure VM :8787  ──SSH──►  GitHub repo
              API token       streak-keeper API
```

## 1. Create the Azure VM

- **Image:** Ubuntu 22.04 LTS
- **Size:** B1s or larger
- **Inbound port:** TCP **8787** (Networking → NSG → Add inbound rule)
- Note the **Public IP address**

SSH in:

```bash
ssh azureuser@YOUR_PUBLIC_IP
```

## 2. Put the code on the server

```bash
git clone https://github.com/YOUR_USER/Github-Streak.git
cd Github-Streak/streak-keeper
```

Or copy only `streak-keeper/` with `scp -r`.

## 3. Bootstrap (one command)

```bash
bash scripts/azure-bootstrap.sh
```

This installs Node, sets up GitHub SSH (`~/.ssh/id_ed25519`), creates `.env` + `config.json` with a random API token, and starts the systemd API service.

**Copy your deploy public key** from the script output → GitHub repo → **Settings → Deploy keys** → Allow write.

### Use your existing GitHub SSH key instead

On your laptop:

```bash
scp ~/.ssh/id_ed25519 azureuser@YOUR_PUBLIC_IP:~/.ssh/id_ed25519
scp ~/.ssh/id_ed25519.pub azureuser@YOUR_PUBLIC_IP:~/.ssh/id_ed25519.pub
```

On Azure:

```bash
chmod 600 ~/.ssh/id_ed25519
bash scripts/setup-github-ssh.sh ~/.ssh/id_ed25519
```

## 4. Open the firewall

| Where | Rule |
|-------|------|
| Azure NSG | Inbound TCP 8787 → VM |
| Ubuntu ufw (optional) | `sudo ufw allow 8787/tcp` |

## 5. Get API token

On the server:

```bash
grep STREAK_API_TOKEN ~/Github-Streak/streak-keeper/.env
# or
cat ~/.streak-keeper/state/api.json
```

## 6. Connect the mobile app

On your dev machine:

```bash
cd mobile
cp .env.example .env
# Edit: EXPO_PUBLIC_STREAK_SERVER_URL=http://YOUR_PUBLIC_IP:8787
npm start
```

In the app:

1. **Settings** → Server URL `http://YOUR_PUBLIC_IP:8787`
2. **Settings** → API token (from step 5) → **Save & connect**
3. **Add project** → owner/repo, branch, author
4. **SSH deploy key** → Generate key → copy public key to GitHub if not done yet
5. Set your **timer** → Save

**Commit +1 now** calls the Azure server immediately.

## 7. Service commands

```bash
systemctl --user status streak-keeper-api.service
journalctl --user -u streak-keeper-api.service -f
systemctl --user restart streak-keeper-api.service
```

## Files that must stay private (gitignored)

| File | Contains |
|------|----------|
| `streak-keeper/.env` | API token, env overrides |
| `streak-keeper/config.json` | API token, paths |
| `streak-keeper/state/` | Project secrets, SSH keys, logs |
| `streak-keeper/work/` | Cloned repos |
| `mobile/.env` | Default server URL / token for dev |

Never commit these. Only `*.example` files go in git.

## Optional: HTTPS with Nginx

For production, put Nginx in front with TLS and proxy to `127.0.0.1:8787`. Then use `https://your-domain` in the app Settings.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App "Cannot reach server" | Check Azure NSG, public IP, `curl http://IP:8787/health` |
| 401 Unauthorized | API token mismatch — copy from server `.env` |
| Git push fails | Deploy key missing write access, or wrong owner/repo |
| `Permission denied (publickey)` | Run `setup-github-ssh.sh`, add pubkey to GitHub |
