# Moluoxixi Rules 升级指南（Codex）

## 快速升级

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi" pull --ff-only
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.codex"
cp "${HOME}/.moluoxixi/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

mkdir -p "${HOME}/.agents/skills"
rm -rf "${HOME}/.agents/skills/superpowers"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.agents/skills/superpowers"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"
node "$env:USERPROFILE\\.moluoxixi\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex" | Out-Null
if (Test-Path "$env:USERPROFILE\\.codex\\AGENTS.md") {
  Remove-Item "$env:USERPROFILE\\.codex\\AGENTS.md" -Force
}
Copy-Item "$env:USERPROFILE\\.moluoxixi\\.codex\\AGENTS.md" "$env:USERPROFILE\\.codex\\AGENTS.md" -Force

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.agents\\skills" | Out-Null
if (Test-Path "$env:USERPROFILE\\.agents\\skills\\superpowers") {
  Remove-Item "$env:USERPROFILE\\.agents\\skills\\superpowers" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.agents\\skills\\superpowers" "$env:USERPROFILE\\.moluoxixi\\skills"
```

## 验证

确认升级后：

- `superpowers` 已更新
- `~/.moluoxixi/skills` 链接仍有效
- `~/.agents/skills/superpowers` 已刷新为最新入口
- `~/.codex/AGENTS.md` 已重新从 `~/.moluoxixi/.codex/AGENTS.md` 同步
