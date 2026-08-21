#!/usr/bin/env bash
# Install streak-keeper as a user systemd timer.
# Usage: ./install.sh [path/to/config.json]
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="${1:-$APP_DIR/config.json}"
NODE_BIN="$(command -v node || true)"
USER_NAME="$(whoami)"
HOME_DIR="$HOME"

if [[ -z "$NODE_BIN" ]]; then
  echo "error: node not found in PATH" >&2
  exit 1
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "error: config not found at $CONFIG_PATH" >&2
  echo "hint: copy config.example.json to config.json and fill in repoUrl first." >&2
  exit 1
fi

# Validate config has repoUrl.
if ! node -e "const c=require('$CONFIG_PATH'); if(!c.repoUrl) process.exit(1)" 2>/dev/null; then
  echo "error: config at $CONFIG_PATH is missing 'repoUrl'." >&2
  exit 1
fi

USER_UNITS_DIR="$HOME_DIR/.config/systemd/user"
mkdir -p "$USER_UNITS_DIR"

# Render the service template.
SERVICE_FILE="$USER_UNITS_DIR/streak-keeper.service"
sed \
  -e "s|__NODE__|$NODE_BIN|g" \
  -e "s|__APP_DIR__|$APP_DIR|g" \
  -e "s|__CONFIG_PATH__|$CONFIG_PATH|g" \
  -e "s|__HOME__|$HOME_DIR|g" \
  -e "s|__USER__|$USER_NAME|g" \
  "$APP_DIR/systemd/streak-keeper.service.tmpl" > "$SERVICE_FILE"

cp "$APP_DIR/systemd/streak-keeper.timer" "$USER_UNITS_DIR/streak-keeper.timer"

echo "Installed units:"
echo "  $SERVICE_FILE"
echo "  $USER_UNITS_DIR/streak-keeper.timer"

systemctl --user daemon-reload
systemctl --user enable --now streak-keeper.timer

echo
echo "Timer enabled. Next runs:"
systemctl --user list-timers streak-keeper.timer --no-pager || true
echo
echo "Useful commands:"
echo "  systemctl --user status streak-keeper.timer"
echo "  systemctl --user list-timers streak-keeper.timer"
echo "  journalctl --user -u streak-keeper.service -f"
echo "  systemctl --user start streak-keeper.service   # trigger a tick now"
echo "  systemctl --user disable --now streak-keeper.timer   # stop"
