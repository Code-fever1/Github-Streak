#!/usr/bin/env bash
# Run ON the Azure VM (or any Linux server) after SSH login.
# Prepares GitHub SSH and optionally imports your existing deploy key.
set -euo pipefail

KEY_PATH="${1:-$HOME/.ssh/id_ed25519}"
EMAIL="${2:-streak-keeper@$(hostname)}"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [[ ! -f "$KEY_PATH" ]]; then
  echo "No key at $KEY_PATH — generating ed25519..."
  ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "$EMAIL"
fi
chmod 600 "$KEY_PATH"
chmod 644 "${KEY_PATH}.pub"

# GitHub host key (safe to cache)
ssh-keyscan -t ed25519,rsa github.com 2>/dev/null >> "$HOME/.ssh/known_hosts" || true
sort -u "$HOME/.ssh/known_hosts" -o "$HOME/.ssh/known_hosts"
chmod 644 "$HOME/.ssh/known_hosts"

echo ""
echo "=== Add this deploy key to GitHub ==="
echo "Repo → Settings → Deploy keys → Add deploy key → Allow write access"
echo ""
cat "${KEY_PATH}.pub"
echo ""
echo "Test:"
echo "  GIT_SSH_COMMAND='ssh -i $KEY_PATH -o IdentitiesOnly=yes' git ls-remote git@github.com:OWNER/REPO.git HEAD"
