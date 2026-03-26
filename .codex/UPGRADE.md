# Moluoxixi Rules 升级指南（Codex）

## 快速升级

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi/source/aiRules" pull --ff-only
node "${HOME}/.moluoxixi/source/aiRules/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"

rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/rules/" "${HOME}/.moluoxixi/rules/"
rsync -av "${HOME}/.moluoxixi/source/aiRules/skills/" "${HOME}/.moluoxixi/skills/"
rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/agents/" "${HOME}/.moluoxixi/agents/"

node "${HOME}/.moluoxixi/source/aiRules/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.codex/rules" "${HOME}/.codex/skills" "${HOME}/.codex/agents"
rsync -av --delete "${HOME}/.moluoxixi/rules/" "${HOME}/.codex/rules/"
rsync -av --delete "${HOME}/.moluoxixi/skills/" "${HOME}/.codex/skills/"
rsync -av --delete "${HOME}/.moluoxixi/agents/" "${HOME}/.codex/agents/"
cp "${HOME}/.moluoxixi/source/aiRules/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

mkdir -p "${HOME}/.agents/skills"
rm -rf "${HOME}/.agents/skills/superpowers"
ln -sfn "${HOME}/.moluoxixi/vendors/superpowers/skills" "${HOME}/.agents/skills/superpowers"

for dir in "${HOME}/.moluoxixi"/skills/*; do
  name="$(basename "$dir")"
  if [ "$name" = "superpowers" ]; then
    continue
  fi
  rm -rf "${HOME}/.agents/skills/${name}"
  ln -sfn "$dir" "${HOME}/.agents/skills/${name}"
done
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi\\source\\aiRules" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"

Copy-Item "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\rules\\*" "$env:USERPROFILE\\.moluoxixi\\rules" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\skills\\*" "$env:USERPROFILE\\.moluoxixi\\skills" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\agents\\*" "$env:USERPROFILE\\.moluoxixi\\agents" -Recurse -Force

node "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex\\rules" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex\\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex\\agents" | Out-Null

Copy-Item "$env:USERPROFILE\\.moluoxixi\\rules\\*" "$env:USERPROFILE\\.codex\\rules" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\skills\\*" "$env:USERPROFILE\\.codex\\skills" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\agents\\*" "$env:USERPROFILE\\.codex\\agents" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\.codex\\AGENTS.md" "$env:USERPROFILE\\.codex\\AGENTS.md" -Force

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.agents\\skills" | Out-Null
if (Test-Path "$env:USERPROFILE\\.agents\\skills\\superpowers") {
  Remove-Item "$env:USERPROFILE\\.agents\\skills\\superpowers" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.agents\\skills\\superpowers" "$env:USERPROFILE\\.moluoxixi\\vendors\\superpowers\\skills"

Get-ChildItem "$env:USERPROFILE\\.moluoxixi\\skills" | ForEach-Object {
  if ($_.Name -eq 'superpowers') {
    return
  }

  $target = "$env:USERPROFILE\\.agents\\skills\\$($_.Name)"
  if (Test-Path $target) {
    Remove-Item $target -Recurse -Force
  }

  cmd /c mklink /J $target $_.FullName
}
```

## 验证

确认升级后：

- `superpowers` 已更新
- `~/.moluoxixi/skills` 链接仍有效
- `~/.agents/skills` 已刷新
- `~/.codex/AGENTS.md` 已同步为最新版本
