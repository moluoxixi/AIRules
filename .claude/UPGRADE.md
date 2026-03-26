# Moluoxixi Rules 升级指南（Claude）

## 快速升级

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.claude"
rm -rf "${HOME}/.claude/rules" "${HOME}/.claude/skills" "${HOME}/.claude/agents"
ln -sfn "${HOME}/.moluoxixi/rules" "${HOME}/.claude/rules"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.claude/skills"
ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.claude/agents"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"
node "$env:USERPROFILE\\.moluoxixi\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude" | Out-Null
if (Test-Path "$env:USERPROFILE\\.claude\\rules") {
  Remove-Item "$env:USERPROFILE\\.claude\\rules" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\skills") {
  Remove-Item "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\agents") {
  Remove-Item "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.claude\\rules" "$env:USERPROFILE\\.moluoxixi\\rules"
cmd /c mklink /J "$env:USERPROFILE\\.claude\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"
cmd /c mklink /J "$env:USERPROFILE\\.claude\\agents" "$env:USERPROFILE\\.moluoxixi\\agents"
```

## 验证

```bash
ls ~/.claude/skills
```

确认升级后：

- `~/.claude/` 入口仍指向 `~/.moluoxixi/`
- `superpowers` 和其他第三方 skills 已更新
- `~/.moluoxixi/skills` 中的链接仍然有效
