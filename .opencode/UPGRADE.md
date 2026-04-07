# Moluoxixi Skills Upgrade Guide (openCode)

## Command

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/host-setup.mjs" --host opencode --mode upgrade --home "${HOME}/.moluoxixi"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\host-setup.mjs" --host opencode --mode upgrade --home "$env:USERPROFILE\\.moluoxixi"
```

## Verification

Confirm after upgrade:

- `~/.config/opencode/skills` still points to `~/.moluoxixi/skills`
- `~/.config/opencode/AGENTS.md` still points to `~/.moluoxixi/AGENTS.md`
