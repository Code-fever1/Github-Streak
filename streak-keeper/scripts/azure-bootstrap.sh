#!/usr/bin/env bash
# One-time bootstrap on a fresh Ubuntu Azure VM.
# Run from the streak-keeper folder on the server:
#   bash scripts/azure-bootstrap.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> Installing packages (git, openssh-client, curl)..."
if command -v apt-get >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y git openssh-client curl ca-certificates
fi

echo "==> Node.js..."
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "==> GitHub SSH..."
bash "$APP_DIR/scripts/setup-github-ssh.sh"

if [[ ! -f "$APP_DIR/.env" ]]; then
  TOKEN="$(openssl rand -hex 24)"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  sed -i "s/replace-with-long-random-secret/$TOKEN/" "$APP_DIR/.env"
  echo "Created .env with new STREAK_API_TOKEN"
fi

if [[ ! -f "$APP_DIR/config.json" ]]; then
  cp "$APP_DIR/config.api.example.json" "$APP_DIR/config.json"
  source "$APP_DIR/.env"
  if [[ -n "${STREAK_API_TOKEN:-}" ]]; then
    node -e "
      const fs=require('fs');
      const p='$APP_DIR/config.json';
      const c=JSON.parse(fs.readFileSync(p));
      c.apiToken=process.env.STREAK_API_TOKEN;
      fs.writeFileSync(p, JSON.stringify(c,null,2)+'\n');
    "
  fi
fi

echo "==> Installing npm dependencies..."
npm install --omit=dev 2>/dev/null || npm install

echo "==> Enabling API systemd service..."
chmod +x "$APP_DIR/install-api.sh"
"$APP_DIR/install-api.sh" "$APP_DIR/config.json"

echo ""
echo "=== Azure network ==="
echo "1. Azure Portal → VM → Networking → Inbound port rule"
echo "2. Add TCP ${STREAK_PORT:-8787} from your IP (or Any for testing)"
echo "3. Public IP → use in mobile Settings:"
echo "     http://<PUBLIC_IP>:${STREAK_PORT:-8787}"
echo ""
echo "=== Mobile app ==="
echo "Settings → paste URL + API token from .env on this server"
echo "Add project → SSH deploy key → paste the public key shown above into GitHub"
echo ""
echo "=== Security ==="
echo "- Never commit .env, config.json, or state/"
echo "- Restrict NSG to your home IP when possible"
