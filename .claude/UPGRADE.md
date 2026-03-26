# Moluoxixi Rules 升级指南（Claude）

## 快速升级

### macOS / Linux

```bash
git -C "${HOME}/.moluoxixi/source/aiRules" pull --ff-only
node "${HOME}/.moluoxixi/source/aiRules/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"

rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/rules/" "${HOME}/.moluoxixi/rules/"
rsync -av "${HOME}/.moluoxixi/source/aiRules/skills/" "${HOME}/.moluoxixi/skills/"
rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/agents/" "${HOME}/.moluoxixi/agents/"

node "${HOME}/.moluoxixi/source/aiRules/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

mkdir -p "${HOME}/.claude/rules" "${HOME}/.claude/skills" "${HOME}/.claude/agents"
rsync -av --delete "${HOME}/.moluoxixi/rules/" "${HOME}/.claude/rules/"
rsync -av --delete "${HOME}/.moluoxixi/skills/" "${HOME}/.claude/skills/"
rsync -av --delete "${HOME}/.moluoxixi/agents/" "${HOME}/.claude/agents/"
```

### Windows PowerShell

```powershell
git -C "$env:USERPROFILE\\.moluoxixi\\source\\aiRules" pull --ff-only
node "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\scripts\\sync-vendors.mjs" --home "$env:USERPROFILE\\.moluoxixi"

Copy-Item "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\rules\\*" "$env:USERPROFILE\\.moluoxixi\\rules" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\skills\\*" "$env:USERPROFILE\\.moluoxixi\\skills" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\agents\\*" "$env:USERPROFILE\\.moluoxixi\\agents" -Recurse -Force

node "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\scripts\\rebuild-links.mjs" --home "$env:USERPROFILE\\.moluoxixi"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\rules" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\agents" | Out-Null

Copy-Item "$env:USERPROFILE\\.moluoxixi\\rules\\*" "$env:USERPROFILE\\.claude\\rules" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\skills\\*" "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
Copy-Item "$env:USERPROFILE\\.moluoxixi\\agents\\*" "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
```

## 验证

```bash
ls ~/.claude/skills
```

确认升级后：

- 新增或变更的第一方规则已同步
- `superpowers` 和其他第三方 skills 已更新
- `~/.moluoxixi/skills` 中的链接仍然有效
