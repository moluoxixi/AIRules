# Moluoxixi Skills Upgrade Guide (Qoder)

## Command

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host qoder --mode upgrade --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host qoder --mode upgrade --home "$env:USERPROFILE\\.moluoxixi"
```

## Verification

Confirm after upgrade:

- `~/.qoder/skills/` still points to `~/.moluoxixi/skills/`
- `~/.qoder/AGENTS.md` still points to `~/.moluoxixi/AGENTS.md`
- optional `agents` projection is refreshed when present
