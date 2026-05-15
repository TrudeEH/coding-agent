# Trude's Coding Agent

Plugins, themes, and configurations for `pi`.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/trudeeh/coding-agent/main/install.sh | bash
```

Installer clones/updates this repo at `~/.local/share/coding-agent`, copies `pi/` into `~/.pi`, installs pi if missing, installs Node/npm/git/curl via Homebrew, apt, dnf, or pacman if missing, installs `rtk`, then runs `pi update` to install plugin dependencies.

## Useful Commands

Built-in pi:

- `/login` - authenticate provider.
- `/model` - switch model.
- `/settings` - change theme, thinking level, transport, etc.
- `/reload` - reload extensions, skills, prompts, themes.
- `/session` - show current session info.
- `/resume` - resume previous session.
- `/compact` - compact context.

Custom:

- `/plan` - open plan manager.
- `/plan on` - planning mode; read-only exploration.
- `/plan off` - leave planning mode.
- `/ssh user@host[:/path]` - run pi tools remotely over SSH.
- `/ssh status` - show SSH routing state.
- `/ssh off` - disable SSH routing.
- `/usage` - show Codex quota plus current token/cost usage.
- `/pi` - show LLM-visible tools and injected skills.
- `/skill:librarian` - research OSS library internals with source links.
- `/skill:pi-subagents` - delegate work to subagents/chains/parallel runs.
