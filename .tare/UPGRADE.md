# Moluoxixi Skills Upgrade Guide (tare)

## Command

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host tare --mode upgrade --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host tare --mode upgrade --home "$env:USERPROFILE\\.moluoxixi"
```

## Verification

Confirm after upgrade:

- `~/.agents/skills/moluoxixi` still points to `~/.moluoxixi/skills`
- `~/.tare/AGENTS.md` still points to `~/.moluoxixi/AGENTS.md`
