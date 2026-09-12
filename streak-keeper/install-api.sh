#!/usr/bin/env bash
# Install streak-keeper API (always-on backend for the mobile app) as a user systemd service.
# Usage: ./install-api.sh [path/to/config.json]
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="${1:-$APP_DIR/config.json}"
NODE_BIN="$(command -v node || true)"
USER_NAME="$(whoami)"
HOME_DIR="$HOME"

if [[ -z "$NODE_BIN" ]]; then
  echo "error: node not found. Install Node 18+ first." >&2
  exit 1
fi

# Load .env if present (not committed to git)
if [[ -f "$APP_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  if [[ -f "$APP_DIR/config.api.example.json" ]]; then
    cp "$APP_DIR/config.api.example.json" "$CONFIG_PATH"
    echo "Created $CONFIG_PATH from example — edit apiToken before exposing to the internet."
  else
    echo "error: no config at $CONFIG_PATH" >&2
    exit 1
  fi
fi

USER_UNITS_DIR="$HOME_DIR/.config/systemd/user"
mkdir -p "$USER_UNITS_DIR"

SERVICE_FILE="$USER_UNITS_DIR/streak-keeper-api.service"
sed \
  -e "s|__NODE__|$NODE_BIN|g" \
  -e "s|__APP_DIR__|$APP_DIR|g" \
  -e "s|__CONFIG_PATH__|$CONFIG_PATH|g" \
  -e "s|__HOME__|$HOME_DIR|g" \
  -e "s|__USER__|$USER_NAME|g" \
  "$APP_DIR/systemd/streak-keeper-api.service.tmpl" > "$SERVICE_FILE"

loginctl enable-linger "$USER_NAME" 2>/dev/null || true
systemctl --user daemon-reload
systemctl --user enable --now streak-keeper-api.service

echo ""
echo "API service installed."
echo "  systemctl --user status streak-keeper-api.service"
echo "  journalctl --user -u streak-keeper-api.service -f"
echo ""
echo "Open TCP ${STREAK_PORT:-8787} in Azure NSG, then connect the app to:"
echo "  http://YOUR_AZURE_PUBLIC_IP:${STREAK_PORT:-8787}"
echo ""
echo "API token (from config or state/api.json):"
node -e "const fs=require('fs');const p='$CONFIG_PATH';let t=process.env.STREAK_API_TOKEN;if(!t&&fs.existsSync(p)){try{t=JSON.parse(fs.readFileSync(p)).apiToken}catch{}}if(!t){const s='$HOME_DIR/.streak-keeper/state/api.json';if(fs.existsSync(s))t=JSON.parse(fs.readFileSync(s)).apiToken}console.log(t||'(start once: npm run serve — token printed in logs)')"
