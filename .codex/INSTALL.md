# Moluoxixi Skills Installation Guide (Codex)

## Prerequisites

- Git installed
- Node.js installed
- Codex CLI installed

## Goal

Codex uses these locations:

```text
~/.moluoxixi/                 Shared installation root
~/.agents/skills/moluoxixi    Codex skill namespace for this repository
~/.codex/AGENTS.md            Host guidance copied from this repository
```

The Codex projection is:

```text
~/.agents/skills/moluoxixi -> ~/.moluoxixi/skills
~/.codex/AGENTS.md         <- ~/.moluoxixi/.codex/AGENTS.md
```

## What's Included

### Skills

`~/.agents/skills/moluoxixi/` exposes the aggregated `~/.moluoxixi/skills/` tree, including:

- First-party skills such as `standard-workflow`, `personal-defaults`, `frontend`, `backend`, `testing`, `verification`, and `wrap-up`
- Language and framework skills such as `javascript`, `typescript`, `react`, and `vue`
- Linked vendor skills, including `superpowers/*`

### Guidance Layer

`~/.codex/AGENTS.md` explains how to use the first-party skill layering together with the aggregated skill namespace.

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

mkdir -p "${HOME}/.codex"
cp "${HOME}/.moluoxixi/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

mkdir -p "${HOME}/.agents/skills"
rm -rf "${HOME}/.agents/skills/moluoxixi"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.agents/skills/moluoxixi"
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex" | Out-Null
if (Test-Path "$env:USERPROFILE\\.codex\\AGENTS.md") {
  Remove-Item "$env:USERPROFILE\\.codex\\AGENTS.md" -Force
}
Copy-Item "$env:USERPROFILE\\.moluoxixi\\.codex\\AGENTS.md" "$env:USERPROFILE\\.codex\\AGENTS.md" -Force

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.agents\\skills" | Out-Null
if (Test-Path "$env:USERPROFILE\\.agents\\skills\\moluoxixi") {
  Remove-Item "$env:USERPROFILE\\.agents\\skills\\moluoxixi" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.agents\\skills\\moluoxixi" "$env:USERPROFILE\\.moluoxixi\\skills"
```

## Verification

```bash
ls ~/.moluoxixi/skills
ls -la ~/.agents/skills/moluoxixi
ls ~/.codex/AGENTS.md
```

Checkpoints:

- `~/.agents/skills/moluoxixi` points to `~/.moluoxixi/skills`
- `~/.codex/AGENTS.md` is refreshed from `~/.moluoxixi/.codex/AGENTS.md`
- Codex is using the repository namespace `moluoxixi`, not a `superpowers` alias

## Notes

- `superpowers/*` still ships inside the aggregated skill tree as the baseline process layer
- First-party guidance is distributed through `~/.agents/skills/moluoxixi/`
- Re-run the install flow after updates so the namespace and `AGENTS.md` stay aligned
