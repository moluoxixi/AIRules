# Moluoxixi Skills Upgrade Guide (Codex)

## Quick Upgrade

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.agents/skills"
rm -rf "${HOME}/.agents/skills/moluoxixi"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.agents/skills/moluoxixi"

node "${HOME}/.moluoxixi/scripts/link-host-baselines.mjs" --home "${HOME}/.moluoxixi" --host codex
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"
node "$env:USERPROFILE\\.moluoxixi\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.agents\\skills" | Out-Null
if (Test-Path "$env:USERPROFILE\\.agents\\skills\\moluoxixi") {
  Remove-Item "$env:USERPROFILE\\.agents\\skills\\moluoxixi" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.agents\\skills\\moluoxixi" "$env:USERPROFILE\\.moluoxixi\\skills"

node "$env:USERPROFILE\\.moluoxixi\\scripts\\link-host-baselines.mjs" --home "$env:USERPROFILE\\.moluoxixi" --host codex
```

## Verification

Confirm after upgrade:

- `~/.agents/skills/moluoxixi` still points to `~/.moluoxixi/skills`
- `~/.codex/AGENTS.md` still points to `~/.moluoxixi/AGENTS.md`
