# Moluoxixi Skills Installation Guide (Claude)

## Prerequisites

- Git installed
- Node.js installed
- Claude / Claude Code working properly

## Goal

After installation, the shared content lives at:

```text
~/.moluoxixi/
  skills/           # Flattened host-facing leaf skill entrypoints
  agents/           # Optional first-party agents
  vendor/           # Source mirrors and final aggregated skill artifacts
  AGENTS.md         # Shared host baseline source
```

Claude reads from:

```text
~/.claude/skills   -> ~/.moluoxixi/skills
~/.claude/agents   -> ~/.moluoxixi/agents   # only if agents are present
~/.claude/CLAUDE.md -> ~/.moluoxixi/AGENTS.md
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

node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host claude --mode install --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host claude --mode install --home "$env:USERPROFILE\\.moluoxixi"
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
