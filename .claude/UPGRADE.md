# Moluoxixi Skills Upgrade Guide (Claude)

## Command

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host claude --mode upgrade --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host claude --mode upgrade --home "$env:USERPROFILE\\.moluoxixi"
```

## Verification

Confirm after upgrade:

- `~/.claude/skills/` still points to `~/.moluoxixi/skills/`
- `~/.claude/CLAUDE.md` still points to `~/.moluoxixi/AGENTS.md`
- optional `agents` projection is refreshed when present
