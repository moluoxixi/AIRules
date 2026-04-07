# Moluoxixi Skills Installation Guide (Claude)

## Prerequisites

- Git installed
- Node.js installed
- Claude / Claude Code working properly

## Goal

After installation, the shared content lives at:

```text
~/.moluoxixi/
  skills/           # First-party skills plus linked vendor skills
  agents/           # Optional first-party agents
  vendors/          # Vendor clones used to build the aggregated skills tree
```

Claude reads from:

```text
~/.claude/skills  -> ~/.moluoxixi/skills
~/.claude/agents  -> ~/.moluoxixi/agents   # only if agents are present
```

## What's Included

### Skills

The aggregated `skills/` tree combines:

- First-party workflow and engineering skills such as `standard-workflow`, `frontend`, `backend`, `testing`, `verification`, and `wrap-up`
- Language and framework skills such as `javascript`, `typescript`, `react`, and `vue`
- Vendor skills linked from `vendors/`, including `superpowers/*`

### Agents

If the repository contains first-party agents, Claude will also project them to `~/.claude/agents`.

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

mkdir -p "${HOME}/.claude"
rm -rf "${HOME}/.claude/skills" "${HOME}/.claude/agents"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.claude/skills"

if [ -d "${HOME}/.moluoxixi/agents" ]; then
  ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.claude/agents"
fi
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude" | Out-Null
if (Test-Path "$env:USERPROFILE\\.claude\\skills") {
  Remove-Item "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\agents") {
  Remove-Item "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.claude\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\agents") {
  cmd /c mklink /J "$env:USERPROFILE\\.claude\\agents" "$env:USERPROFILE\\.moluoxixi\\agents"
}
```

## Verification

```bash
ls ~/.moluoxixi/skills
ls ~/.claude/skills
```

If agents are installed, also verify:

```bash
ls ~/.claude/agents
```

Checkpoints:

- `~/.moluoxixi/skills/` contains first-party and vendor skills
- `~/.claude/skills/` points to `~/.moluoxixi/skills/`
- `~/.claude/agents/` exists only when `~/.moluoxixi/agents/` exists
- Claude is using the shared skills-first layout

## Notes

- `superpowers/*` remains the baseline process layer inside the aggregated skills tree
- First-party guidance is published through `skills/`
- Re-run the install flow after repository updates so Claude keeps the latest linked skills
