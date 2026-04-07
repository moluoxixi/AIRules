# Moluoxixi Skills Upgrade Guide (Qoder)

## Quick Upgrade

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.qoder"
rm -rf "${HOME}/.qoder/skills" "${HOME}/.qoder/agents"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.qoder/skills"

if [ -d "${HOME}/.moluoxixi/agents" ]; then
  ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.qoder/agents"
fi
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"
node "$env:USERPROFILE\\.moluoxixi\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.qoder" | Out-Null
if (Test-Path "$env:USERPROFILE\\.qoder\\skills") {
  Remove-Item "$env:USERPROFILE\\.qoder\\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.qoder\\agents") {
  Remove-Item "$env:USERPROFILE\\.qoder\\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.qoder\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\agents") {
  cmd /c mklink /J "$env:USERPROFILE\\.qoder\\agents" "$env:USERPROFILE\\.moluoxixi\\agents"
}
```

## Verification

```bash
ls ~/.qoder/skills
```

If agents are installed, also verify:

```bash
ls ~/.qoder/agents
```

Confirm after upgrade:

- `~/.qoder/skills/` still points to `~/.moluoxixi/skills/`
- `~/.qoder/agents/` is recreated only when `~/.moluoxixi/agents/` exists
- The Qoder install remains on the shared skills-first layout
