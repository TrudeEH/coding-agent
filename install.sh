#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/trudeeh/coding-agent.git"
DEFAULT_REPO_DIR="$HOME/.local/share/coding-agent"
PI_HOME="${PI_HOME:-$HOME/.pi}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
REPO_DIR="${REPO_DIR:-}"

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

if [ -z "$REPO_DIR" ]; then
  REPO_DIR="$DEFAULT_REPO_DIR"
  for dir in "$SCRIPT_DIR" "$(pwd -P)"; do
    if [ -n "$dir" ] && [ -d "$dir/pi" ]; then
      REPO_DIR="$dir"
      break
    fi
  done
fi

if [ ! -d "$REPO_DIR/pi" ]; then
  if [ "$REPO_DIR" != "$DEFAULT_REPO_DIR" ]; then
    echo "pi/ not found in $REPO_DIR" >&2
    exit 1
  fi

  rm -rf "$DEFAULT_REPO_DIR"
  mkdir -p "$(dirname "$DEFAULT_REPO_DIR")"
  git clone "$REPO_URL" "$DEFAULT_REPO_DIR"
elif [ "$REPO_DIR" = "$DEFAULT_REPO_DIR" ] && [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" pull --ff-only
fi

have pi || npm install -g @earendil-works/pi-coding-agent

mkdir -p "$PI_HOME"
cp -a "$REPO_DIR/pi/." "$PI_HOME/"

pi update

echo "Installed pi dotfiles to $PI_HOME"
echo "Repo: $REPO_DIR"
echo "Restart pi or run /reload"
