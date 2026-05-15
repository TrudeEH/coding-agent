#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/trudeeh/coding-agent.git"
DEFAULT_REPO_DIR="$HOME/.local/share/coding-agent"
PI_HOME="${PI_HOME:-$HOME/.pi}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
REPO_DIR="${REPO_DIR:-}"

install_node_npm() {
  if command -v npm >/dev/null 2>&1; then
    return
  fi

  if command -v brew >/dev/null 2>&1; then
    brew install node
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y nodejs npm git
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm git
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --needed --noconfirm nodejs npm git
  else
    echo "npm not found. Install Node.js/npm, then rerun this script." >&2
    exit 1
  fi
}

install_git() {
  if command -v git >/dev/null 2>&1; then
    return
  fi

  if command -v brew >/dev/null 2>&1; then
    brew install git
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y git
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y git
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --needed --noconfirm git
  else
    echo "git not found. Install git, then rerun this script." >&2
    exit 1
  fi
}

install_curl() {
  if command -v curl >/dev/null 2>&1; then
    return
  fi

  if command -v brew >/dev/null 2>&1; then
    brew install curl
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y curl
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y curl
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --needed --noconfirm curl
  else
    echo "curl not found. Install curl, then rerun this script." >&2
    exit 1
  fi
}

install_rtk() {
  if command -v rtk >/dev/null 2>&1; then
    return
  fi

  if command -v brew >/dev/null 2>&1; then
    brew install rtk
  else
    install_curl
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi

  if ! command -v rtk >/dev/null 2>&1; then
    echo "rtk install completed, but rtk is not on PATH. Add ~/.local/bin to PATH, then rerun this script." >&2
    exit 1
  fi
}

install_git
install_node_npm
install_rtk

if [ -n "$REPO_DIR" ]; then
  :
elif [ -n "$SCRIPT_DIR" ] && [ -d "$SCRIPT_DIR/.git" ] && [ -d "$SCRIPT_DIR/pi" ]; then
  REPO_DIR="$SCRIPT_DIR"
else
  REPO_DIR="$DEFAULT_REPO_DIR"
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
elif [ "$REPO_DIR" = "$DEFAULT_REPO_DIR" ]; then
  git -C "$REPO_DIR" pull --ff-only
fi

if ! command -v pi >/dev/null 2>&1; then
  npm install -g @earendil-works/pi-coding-agent
fi

mkdir -p "$PI_HOME"
cp -a "$REPO_DIR/pi/." "$PI_HOME/"

pi update

echo "Installed pi dotfiles to $PI_HOME"
echo "Repo: $REPO_DIR"
echo "Restart pi or run /reload"
