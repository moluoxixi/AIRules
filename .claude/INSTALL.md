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
  AGENTS.md         # Shared host baseline source
```

Claude reads from:

```text
~/.claude/skills   -> ~/.moluoxixi/skills
~/.claude/agents   -> ~/.moluoxixi/agents   # only if agents are present
~/.claude/CLAUDE.md -> ~/.moluoxixi/AGENTS.md
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

mkdir -p "${HOME}/.claude"
rm -rf "${HOME}/.claude/skills" "${HOME}/.claude/agents"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.claude/skills"

if [ -d "${HOME}/.moluoxixi/agents" ]; then
  ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.claude/agents"
fi

node "${HOME}/.moluoxixi/scripts/link-host-baselines.mjs" --home "${HOME}/.moluoxixi" --host claude
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

node "$env:USERPROFILE\\.moluoxixi\\scripts\\link-host-baselines.mjs" --home "$env:USERPROFILE\\.moluoxixi" --host claude
```

## Verification

```bash
ls ~/.moluoxixi/skills
ls ~/.claude/skills
ls ~/.claude/CLAUDE.md
```

If agents are installed, also verify:

```bash
ls ~/.claude/agents
```

Checkpoints:

- `~/.claude/skills/` points to `~/.moluoxixi/skills/`
- `~/.claude/CLAUDE.md` points to `~/.moluoxixi/AGENTS.md`
- `~/.claude/agents/` exists only when `~/.moluoxixi/agents/` exists
