# Moluoxixi Skills Upgrade Guide (openCode)

## Quick Upgrade

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.config/opencode"
rm -rf "${HOME}/.config/opencode/skills"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.config/opencode/skills"

node "${HOME}/.moluoxixi/scripts/link-host-baselines.mjs" --home "${HOME}/.moluoxixi" --host opencode
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
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

Confirm after upgrade:

- `~/.config/opencode/skills` still points to `~/.moluoxixi/skills`
- `~/.config/opencode/AGENTS.md` still points to `~/.moluoxixi/AGENTS.md`
