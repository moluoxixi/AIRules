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

mkdir -p "${HOME}/.config/opencode"
rm -rf "${HOME}/.config/opencode/skills"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.config/opencode/skills"

node "${HOME}/.moluoxixi/scripts/link-host-baselines.mjs" --home "${HOME}/.moluoxixi" --host opencode
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.config\\opencode" | Out-Null
if (Test-Path "$env:USERPROFILE\\.config\\opencode\\skills") {
  Remove-Item "$env:USERPROFILE\\.config\\opencode\\skills" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.config\\opencode\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"

node "$env:USERPROFILE\\.moluoxixi\\scripts\\link-host-baselines.mjs" --home "$env:USERPROFILE\\.moluoxixi" --host opencode
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
