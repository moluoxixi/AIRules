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

## Installation Steps

### macOS / Linux

```bash
mkdir -p "${HOME}/.moluoxixi"

if [ -d "${HOME}/.moluoxixi/.git" ]; then
  git -C "${HOME}/.moluoxixi" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi"
fi

node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.agents/skills"
rm -rf "${HOME}/.agents/skills/moluoxixi"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.agents/skills/moluoxixi"

node "${HOME}/.moluoxixi/scripts/link-host-baselines.mjs" --home "${HOME}/.moluoxixi" --host tare
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"
node "$env:USERPROFILE\\.moluoxixi\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.agents\\skills" | Out-Null
if (Test-Path "$env:USERPROFILE\\.agents\\skills\\moluoxixi") {
  Remove-Item "$env:USERPROFILE\\.agents\\skills\\moluoxixi" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.agents\\skills\\moluoxixi" "$env:USERPROFILE\\.moluoxixi\\skills"

node "$env:USERPROFILE\\.moluoxixi\\scripts\\link-host-baselines.mjs" --home "$env:USERPROFILE\\.moluoxixi" --host tare
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
