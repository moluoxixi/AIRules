# Moluoxixi Skills Installation Guide (openCode)

## Prerequisites

- Git installed
- Node.js installed
- openCode installed

## Goal

openCode reads these locations:

```text
~/.config/opencode/skills   -> ~/.moluoxixi/skills
~/.config/opencode/AGENTS.md -> ~/.moluoxixi/AGENTS.md
```

## Command

### macOS / Linux

```bash
mkdir -p "${HOME}/.moluoxixi"

if [ -d "${HOME}/.moluoxixi/.git" ]; then
  git -C "${HOME}/.moluoxixi" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi"
fi

node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host opencode --mode install --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host opencode --mode install --home "$env:USERPROFILE\\.moluoxixi"
```

## Verification

```bash
ls ~/.moluoxixi/skills
ls ~/.config/opencode/skills
ls ~/.config/opencode/AGENTS.md
```

Checkpoints:

- `~/.config/opencode/skills` points to `~/.moluoxixi/skills`
- `~/.config/opencode/AGENTS.md` points to `~/.moluoxixi/AGENTS.md`
- openCode uses the shared skills-first projection
