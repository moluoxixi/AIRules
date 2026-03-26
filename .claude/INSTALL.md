# Moluoxixi Rules 安装指南（Claude）

## 前提

- 已安装 Git
- 已安装 Node.js
- Claude 已可正常使用

## 目标

安装完成后，会形成如下结构：

```text
~/.moluoxixi/
  vendors/
  rules/
  skills/
  agents/
  source/aiRules/
```

Claude 实际读取：

```text
~/.claude/rules/
~/.claude/skills/
~/.claude/agents/
```

## 安装步骤

### macOS / Linux

```bash
mkdir -p "${HOME}/.moluoxixi/source" "${HOME}/.moluoxixi/vendors" "${HOME}/.moluoxixi/rules" "${HOME}/.moluoxixi/skills" "${HOME}/.moluoxixi/agents"

# 1. clone 或更新仓库
if [ -d "${HOME}/.moluoxixi/source/aiRules/.git" ]; then
  git -C "${HOME}/.moluoxixi/source/aiRules" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi/source/aiRules"
fi

# 2. 先安装 superpowers，再拉取其他 vendors
node "${HOME}/.moluoxixi/source/aiRules/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"

# 3. 同步第一方规则、技能、agents 到 ~/.moluoxixi
rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/rules/" "${HOME}/.moluoxixi/rules/"
rsync -av "${HOME}/.moluoxixi/source/aiRules/skills/" "${HOME}/.moluoxixi/skills/"
rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/agents/" "${HOME}/.moluoxixi/agents/"

# 4. 根据 manifest 重建第三方 skill 链接
node "${HOME}/.moluoxixi/source/aiRules/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

# 5. 投影到 Claude
mkdir -p "${HOME}/.claude/rules" "${HOME}/.claude/skills" "${HOME}/.claude/agents"
rsync -av --delete "${HOME}/.moluoxixi/rules/" "${HOME}/.claude/rules/"
rsync -av --delete "${HOME}/.moluoxixi/skills/" "${HOME}/.claude/skills/"
rsync -av --delete "${HOME}/.moluoxixi/agents/" "${HOME}/.claude/agents/"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi\\source" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi\\vendors" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi\\rules" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi\\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi\\agents" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\source\\aiRules\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi\\source\\aiRules" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi\\source\\aiRules"
}

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
ls ~/.moluoxixi/vendors/superpowers
ls ~/.moluoxixi/skills
ls ~/.claude/skills
```

确认点：

- `superpowers` 已安装
- `~/.moluoxixi/skills/` 下能看到 vendor skill 链接和第一方 skills
- `~/.claude/skills/` 下已经同步完成

## 说明

- 这里默认先安装 `superpowers`，再叠加你自己的规则与其他第三方 skills
- `rules/` 是第一方维护
- 第三方 skills 不直接拷进仓库，而是通过 `vendors/` + 软链接统一暴露
