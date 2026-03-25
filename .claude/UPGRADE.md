# Moluoxixi Rules 升级指南（Claude）

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

rsync -av --delete "${MOLUO_HOME}/rules/" "${HOME}/.claude/rules/"
rsync -av --delete "${MOLUO_HOME}/skills/" "${HOME}/.claude/skills/"
rsync -av --delete "${MOLUO_HOME}/agents/" "${HOME}/.claude/agents/"
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

Copy-Item "$MOLUO_HOME\\rules\\*" "$env:USERPROFILE\\.claude\\rules" -Recurse -Force
Copy-Item "$MOLUO_HOME\\skills\\*" "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
Copy-Item "$MOLUO_HOME\\agents\\*" "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
```

## 验证

```bash
ls ~/.claude/skills
```

确认升级后：

- 新增或变更的第一方规则已同步
- `superpowers` 和其他第三方 skills 已更新
- `~/.moluoxixi/skills` 中的链接仍然有效
