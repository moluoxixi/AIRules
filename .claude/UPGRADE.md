# Moluoxixi Skills Upgrade Guide (Claude)

## Quick Upgrade

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.claude"
rm -rf "${HOME}/.claude/skills" "${HOME}/.claude/agents"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.claude/skills"

if [ -d "${HOME}/.moluoxixi/agents" ]; then
  ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.claude/agents"
fi

node "${HOME}/.moluoxixi/scripts/link-host-baselines.mjs" --home "${HOME}/.moluoxixi" --host claude
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"
node "$env:USERPROFILE\\.moluoxixi\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude" | Out-Null
if (Test-Path "$env:USERPROFILE\\.claude\\skills") {
  Remove-Item "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\agents") {
  Remove-Item "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.claude\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\agents") {
  cmd /c mklink /J "$env:USERPROFILE\\.claude\\agents" "$env:USERPROFILE\\.moluoxixi\\agents"
}

node "$env:USERPROFILE\\.moluoxixi\\scripts\\link-host-baselines.mjs" --home "$env:USERPROFILE\\.moluoxixi" --host claude
```

## Verification

Confirm after upgrade:

- `~/.claude/skills/` still points to `~/.moluoxixi/skills/`
- `~/.claude/CLAUDE.md` still points to `~/.moluoxixi/AGENTS.md`
- optional `agents` projection is refreshed when present
