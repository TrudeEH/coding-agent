#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_HOME="${PI_HOME:-$HOME/.pi}"

if [ ! -d "$PI_HOME" ]; then
  echo "pi config not found: $PI_HOME" >&2
  exit 1
fi

mkdir -p "$REPO_DIR/pi"

rsync -av --delete \
  --exclude='agent/auth.json' \
  --exclude='agent/sessions/' \
  --exclude='agent/bin/' \
  --exclude='agent/git/' \
  --exclude='agent/npm/' \
  --exclude='auth.json' \
  --exclude='*.bak.*' \
  "$PI_HOME/" "$REPO_DIR/pi/"

echo "Synced $PI_HOME -> $REPO_DIR/pi"
