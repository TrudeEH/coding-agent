#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/trudeeh/coding-agent.git"
PI_HOME="${PI_HOME:-$HOME/.pi}"
REPO_DIR="${REPO_DIR:-$PI_HOME}"

have() { command -v "$1" >/dev/null 2>&1; }

install_packages() {
  if have brew; then
    brew install "$@"
  elif have apt-get; then
    sudo apt-get update
    sudo apt-get install -y "$@"
  elif have dnf; then
    sudo dnf install -y "$@"
  elif have pacman; then
    sudo pacman -Sy --needed --noconfirm "$@"
  else
    echo "No supported package manager found. Install missing tools, then rerun this script." >&2
    exit 1
  fi
}

have git || install_packages git

if ! have npm; then
  if have brew; then
    brew install node
  else
    install_packages nodejs npm git
  fi
fi

if ! have rtk; then
  if have brew; then
    brew install rtk
  else
    have curl || install_packages curl
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi

if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" pull --ff-only
else
  if [ -e "$REPO_DIR" ] && [ -n "$(find "$REPO_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1)" ]; then
    backup="$REPO_DIR.bak-install-$(date +%Y%m%d%H%M%S)"
    mv "$REPO_DIR" "$backup"
    git clone "$REPO_URL" "$REPO_DIR"
    cp -a "$backup/." "$REPO_DIR/"
    echo "Existing pi home preserved in $backup"
  else
    rm -rf "$REPO_DIR"
    mkdir -p "$(dirname "$REPO_DIR")"
    git clone "$REPO_URL" "$REPO_DIR"
  fi
fi

have pi || npm install -g @earendil-works/pi-coding-agent

pi update

echo "Installed pi repo at $REPO_DIR"
echo "Edit $REPO_DIR directly; changes are git-tracked there."
echo "Restart pi or run /reload"
