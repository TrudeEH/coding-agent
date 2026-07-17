#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_HOME="${PI_HOME:-$HOME/.pi}"

if [ "$REPO_DIR" = "$PI_HOME" ]; then
  echo "Repo already lives at $PI_HOME; no sync needed."
  git -C "$REPO_DIR" status --short
  exit 0
fi

echo "This repo now belongs at $PI_HOME." >&2
echo "Run ./install.sh to clone/migrate it there." >&2
exit 1
