# Moluoxixi Rules Upgrade Guide (Qoder)

## Quick Upgrade

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.qoder"
rm -rf "${HOME}/.qoder/rules" "${HOME}/.qoder/skills" "${HOME}/.qoder/agents"
ln -sfn "${HOME}/.moluoxixi/rules" "${HOME}/.qoder/rules"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.qoder/skills"
ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.qoder/agents"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\.moluoxixi\scripts\sync-vendors.mjs" --home "$env:USERPROFILE\.moluoxixi"
node "$env:USERPROFILE\.moluoxixi\scripts\rebuild-links.mjs" --home "$env:USERPROFILE\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.qoder" | Out-Null
if (Test-Path "$env:USERPROFILE\.qoder\rules") {
  Remove-Item "$env:USERPROFILE\.qoder\rules" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\.qoder\skills") {
  Remove-Item "$env:USERPROFILE\.qoder\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\.qoder\agents") {
  Remove-Item "$env:USERPROFILE\.qoder\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\.qoder\rules" "$env:USERPROFILE\.moluoxixi\rules"
cmd /c mklink /J "$env:USERPROFILE\.qoder\skills" "$env:USERPROFILE\.moluoxixi\skills"
cmd /c mklink /J "$env:USERPROFILE\.qoder\agents" "$env:USERPROFILE\.moluoxixi\agents"
```

## Verification

```bash
ls ~/.qoder/skills
```

Confirm after upgrade:

- `~/.qoder/` entry still points to `~/.moluoxixi/`
- `superpowers` and other third-party skills are updated
- Links in `~/.moluoxixi/skills` remain valid
