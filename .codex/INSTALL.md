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
mkdir -p "${HOME}/.moluoxixi/source" "${HOME}/.moluoxixi/vendors" "${HOME}/.moluoxixi/rules" "${HOME}/.moluoxixi/skills" "${HOME}/.moluoxixi/agents"

# 1. clone 或更新仓库
if [ -d "${HOME}/.moluoxixi/source/aiRules/.git" ]; then
  git -C "${HOME}/.moluoxixi/source/aiRules" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi/source/aiRules"
fi

# 2. 先安装 superpowers，再拉取其余 vendors
node "${HOME}/.moluoxixi/source/aiRules/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"

# 3. 同步第一方内容到 ~/.moluoxixi
rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/rules/" "${HOME}/.moluoxixi/rules/"
rsync -av "${HOME}/.moluoxixi/source/aiRules/skills/" "${HOME}/.moluoxixi/skills/"
rsync -av --delete "${HOME}/.moluoxixi/source/aiRules/agents/" "${HOME}/.moluoxixi/agents/"

# 4. 重建 vendor skill 链接
node "${HOME}/.moluoxixi/source/aiRules/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

# 5. 投影到 ~/.codex
mkdir -p "${HOME}/.codex/rules" "${HOME}/.codex/skills" "${HOME}/.codex/agents"
rsync -av --delete "${HOME}/.moluoxixi/rules/" "${HOME}/.codex/rules/"
rsync -av --delete "${HOME}/.moluoxixi/skills/" "${HOME}/.codex/skills/"
rsync -av --delete "${HOME}/.moluoxixi/agents/" "${HOME}/.codex/agents/"
cp "${HOME}/.moluoxixi/source/aiRules/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

# 6. 暴露到 Codex 原生技能发现目录
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
