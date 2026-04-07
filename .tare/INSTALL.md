# Moluoxixi Skills Installation Guide (tare)

## Prerequisites

- Git installed
- Node.js installed
- tare working properly

## Goal

tare uses these locations:

```text
~/.moluoxixi/                 Shared installation root
~/.agents/skills/moluoxixi    Shared AGENTS-compatible skill namespace
~/.tare/AGENTS.md             Host guidance symlinked from ~/.moluoxixi/AGENTS.md
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

node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host tare --mode install --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host tare --mode install --home "$env:USERPROFILE\\.moluoxixi"
```

## Verification

```bash
ls ~/.moluoxixi/skills
ls -la ~/.agents/skills/moluoxixi
ls ~/.tare/AGENTS.md
```

Checkpoints:

- `~/.agents/skills/moluoxixi` points to `~/.moluoxixi/skills`
- `~/.tare/AGENTS.md` points to `~/.moluoxixi/AGENTS.md`
- tare uses the shared skills-first namespace
