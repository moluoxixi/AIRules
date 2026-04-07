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

## Command

### macOS / Linux

```bash
mkdir -p "${HOME}/.moluoxixi"

if [ -d "${HOME}/.moluoxixi/.git" ]; then
  git -C "${HOME}/.moluoxixi" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi"
fi

node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host qoder --mode install --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host qoder --mode install --home "$env:USERPROFILE\\.moluoxixi"
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
