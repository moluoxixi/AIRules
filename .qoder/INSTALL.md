# Moluoxixi Skills Installation Guide (Qoder)

## Prerequisites

- Git installed
- Node.js installed
- Qoder IDE working properly

## Goal

After installation, the shared content lives at:

```text
~/.moluoxixi/
  skills/
  agents/
  vendors/
  AGENTS.md
```

Qoder reads from:

```text
~/.qoder/skills   -> ~/.moluoxixi/skills
~/.qoder/agents   -> ~/.moluoxixi/agents   # only if agents are present
~/.qoder/AGENTS.md -> ~/.moluoxixi/AGENTS.md
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

mkdir -p "${HOME}/.qoder"
rm -rf "${HOME}/.qoder/skills" "${HOME}/.qoder/agents"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.qoder/skills"

if [ -d "${HOME}/.moluoxixi/agents" ]; then
  ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.qoder/agents"
fi

node "${HOME}/.moluoxixi/scripts/link-host-baselines.mjs" --home "${HOME}/.moluoxixi" --host qoder
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.qoder" | Out-Null
if (Test-Path "$env:USERPROFILE\\.qoder\\skills") {
  Remove-Item "$env:USERPROFILE\\.qoder\\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.qoder\\agents") {
  Remove-Item "$env:USERPROFILE\\.qoder\\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.qoder\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\agents") {
  cmd /c mklink /J "$env:USERPROFILE\\.qoder\\agents" "$env:USERPROFILE\\.moluoxixi\\agents"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\link-host-baselines.mjs" --home "$env:USERPROFILE\\.moluoxixi" --host qoder
```

## Verification

```bash
ls ~/.moluoxixi/skills
ls ~/.qoder/skills
ls ~/.qoder/AGENTS.md
```

If agents are installed, also verify:

```bash
ls ~/.qoder/agents
```

Checkpoints:

- `~/.qoder/skills/` points to `~/.moluoxixi/skills/`
- `~/.qoder/AGENTS.md` points to `~/.moluoxixi/AGENTS.md`
- `~/.qoder/agents/` exists only when `~/.moluoxixi/agents/` exists
