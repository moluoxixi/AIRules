# Moluoxixi Rules 安装指南（Codex）

## 前提

- 已安装 Git
- 已安装 Node.js
- 已安装 Codex

## 目标

Codex 侧最终会用到三层目录：

```text
~/.moluoxixi/          统一聚合层
~/.codex/              Codex 规则与镜像目录
~/.agents/skills/      Codex 原生技能发现目录
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

# 2. 先安装 superpowers，再拉取其余 vendors
node "${MOLUO_REPO}/scripts/sync-vendors.mjs" --home "${MOLUO_HOME}"

# 3. 同步第一方内容到 ~/.moluoxixi
rsync -av --delete "${MOLUO_REPO}/rules/" "${MOLUO_HOME}/rules/"
rsync -av "${MOLUO_REPO}/skills/" "${MOLUO_HOME}/skills/"
rsync -av --delete "${MOLUO_REPO}/agents/" "${MOLUO_HOME}/agents/"

# 4. 重建 vendor skill 链接
node "${MOLUO_REPO}/scripts/rebuild-links.mjs" --home "${MOLUO_HOME}"

# 5. 投影到 ~/.codex
mkdir -p "${HOME}/.codex/rules" "${HOME}/.codex/skills" "${HOME}/.codex/agents"
rsync -av --delete "${MOLUO_HOME}/rules/" "${HOME}/.codex/rules/"
rsync -av --delete "${MOLUO_HOME}/skills/" "${HOME}/.codex/skills/"
rsync -av --delete "${MOLUO_HOME}/agents/" "${HOME}/.codex/agents/"
cp "${MOLUO_REPO}/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

# 6. 暴露到 Codex 原生技能发现目录
mkdir -p "${HOME}/.agents/skills"
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex\\rules" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex\\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.codex\\agents" | Out-Null

Copy-Item "$MOLUO_HOME\\rules\\*" "$env:USERPROFILE\\.codex\\rules" -Recurse -Force
Copy-Item "$MOLUO_HOME\\skills\\*" "$env:USERPROFILE\\.codex\\skills" -Recurse -Force
Copy-Item "$MOLUO_HOME\\agents\\*" "$env:USERPROFILE\\.codex\\agents" -Recurse -Force
Copy-Item "$MOLUO_REPO\\.codex\\AGENTS.md" "$env:USERPROFILE\\.codex\\AGENTS.md" -Force

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.agents\\skills" | Out-Null
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

```bash
ls ~/.moluoxixi/vendors/superpowers
ls ~/.codex/skills
ls ~/.agents/skills
```

确认点：

- 已先安装 `superpowers`
- `~/.moluoxixi/skills/` 下已聚合第一方和第三方 skills
- `~/.agents/skills/` 下已暴露给 Codex 原生发现
- `~/.codex/AGENTS.md` 已存在
