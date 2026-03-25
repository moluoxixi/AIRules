# Moluoxixi Rules 升级指南（Codex）

## 快速升级

### macOS / Linux

```bash
export MOLUO_HOME="${HOME}/.moluoxixi"
export MOLUO_REPO="${MOLUO_HOME}/source/aiRules"

git -C "${MOLUO_REPO}" pull --ff-only
node "${MOLUO_REPO}/scripts/sync-vendors.mjs" --home "${MOLUO_HOME}"

rsync -av --delete "${MOLUO_REPO}/rules/" "${MOLUO_HOME}/rules/"
rsync -av "${MOLUO_REPO}/skills/" "${MOLUO_HOME}/skills/"
rsync -av --delete "${MOLUO_REPO}/agents/" "${MOLUO_HOME}/agents/"

node "${MOLUO_REPO}/scripts/rebuild-links.mjs" --home "${MOLUO_HOME}"

rsync -av --delete "${MOLUO_HOME}/rules/" "${HOME}/.codex/rules/"
rsync -av --delete "${MOLUO_HOME}/skills/" "${HOME}/.codex/skills/"
rsync -av --delete "${MOLUO_HOME}/agents/" "${HOME}/.codex/agents/"
cp "${MOLUO_REPO}/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

rm -rf "${HOME}/.agents/skills/superpowers"
ln -sfn "${MOLUO_HOME}/vendors/superpowers/skills" "${HOME}/.agents/skills/superpowers"

for dir in "${MOLUO_HOME}"/skills/*; do
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
$MOLUO_HOME = Join-Path $env:USERPROFILE '.moluoxixi'
$MOLUO_REPO = Join-Path $MOLUO_HOME 'source\\aiRules'

git -C $MOLUO_REPO pull --ff-only
node "$MOLUO_REPO\\scripts\\sync-vendors.mjs" --home "$MOLUO_HOME"

Copy-Item "$MOLUO_REPO\\rules\\*" "$MOLUO_HOME\\rules" -Recurse -Force
Copy-Item "$MOLUO_REPO\\skills\\*" "$MOLUO_HOME\\skills" -Recurse -Force
Copy-Item "$MOLUO_REPO\\agents\\*" "$MOLUO_HOME\\agents" -Recurse -Force

node "$MOLUO_REPO\\scripts\\rebuild-links.mjs" --home "$MOLUO_HOME"

Copy-Item "$MOLUO_HOME\\rules\\*" "$env:USERPROFILE\\.codex\\rules" -Recurse -Force
Copy-Item "$MOLUO_HOME\\skills\\*" "$env:USERPROFILE\\.codex\\skills" -Recurse -Force
Copy-Item "$MOLUO_HOME\\agents\\*" "$env:USERPROFILE\\.codex\\agents" -Recurse -Force
Copy-Item "$MOLUO_REPO\\.codex\\AGENTS.md" "$env:USERPROFILE\\.codex\\AGENTS.md" -Force

if (Test-Path "$env:USERPROFILE\\.agents\\skills\\superpowers") {
  Remove-Item "$env:USERPROFILE\\.agents\\skills\\superpowers" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.agents\\skills\\superpowers" "$MOLUO_HOME\\vendors\\superpowers\\skills"

Get-ChildItem "$MOLUO_HOME\\skills" | ForEach-Object {
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
