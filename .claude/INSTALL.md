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
export MOLUO_HOME="${HOME}/.moluoxixi"
export MOLUO_REPO="${MOLUO_HOME}/source/aiRules"

mkdir -p "${MOLUO_HOME}/source" "${MOLUO_HOME}/vendors" "${MOLUO_HOME}/rules" "${MOLUO_HOME}/skills" "${MOLUO_HOME}/agents"

# 1. clone 或更新你的仓库
if [ -d "${MOLUO_REPO}/.git" ]; then
  git -C "${MOLUO_REPO}" pull --ff-only
else
  git clone <your-repo-url> "${MOLUO_REPO}"
fi

# 2. 先安装 superpowers，再拉取其他 vendors
node "${MOLUO_REPO}/scripts/sync-vendors.mjs" --home "${MOLUO_HOME}"

# 3. 同步第一方规则、技能、agents 到 ~/.moluoxixi
rsync -av --delete "${MOLUO_REPO}/rules/" "${MOLUO_HOME}/rules/"
rsync -av "${MOLUO_REPO}/skills/" "${MOLUO_HOME}/skills/"
rsync -av --delete "${MOLUO_REPO}/agents/" "${MOLUO_HOME}/agents/"

# 4. 根据 manifest 重建第三方 skill 链接
node "${MOLUO_REPO}/scripts/rebuild-links.mjs" --home "${MOLUO_HOME}"

# 5. 投影到 Claude
mkdir -p "${HOME}/.claude/rules" "${HOME}/.claude/skills" "${HOME}/.claude/agents"
rsync -av --delete "${MOLUO_HOME}/rules/" "${HOME}/.claude/rules/"
rsync -av --delete "${MOLUO_HOME}/skills/" "${HOME}/.claude/skills/"
rsync -av --delete "${MOLUO_HOME}/agents/" "${HOME}/.claude/agents/"
```

### Windows PowerShell

```powershell
$MOLUO_HOME = Join-Path $env:USERPROFILE '.moluoxixi'
$MOLUO_REPO = Join-Path $MOLUO_HOME 'source\\aiRules'

New-Item -ItemType Directory -Force -Path (Join-Path $MOLUO_HOME 'source') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $MOLUO_HOME 'vendors') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $MOLUO_HOME 'rules') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $MOLUO_HOME 'skills') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $MOLUO_HOME 'agents') | Out-Null

if (Test-Path (Join-Path $MOLUO_REPO '.git')) {
  git -C $MOLUO_REPO pull --ff-only
} else {
  git clone <your-repo-url> $MOLUO_REPO
}

node "$MOLUO_REPO\\scripts\\sync-vendors.mjs" --home "$MOLUO_HOME"

Copy-Item "$MOLUO_REPO\\rules\\*" "$MOLUO_HOME\\rules" -Recurse -Force
Copy-Item "$MOLUO_REPO\\skills\\*" "$MOLUO_HOME\\skills" -Recurse -Force
Copy-Item "$MOLUO_REPO\\agents\\*" "$MOLUO_HOME\\agents" -Recurse -Force

node "$MOLUO_REPO\\scripts\\rebuild-links.mjs" --home "$MOLUO_HOME"

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\rules" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\agents" | Out-Null

Copy-Item "$MOLUO_HOME\\rules\\*" "$env:USERPROFILE\\.claude\\rules" -Recurse -Force
Copy-Item "$MOLUO_HOME\\skills\\*" "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
Copy-Item "$MOLUO_HOME\\agents\\*" "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
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
