# Moluoxixi Rules 安装指南（Codex）

## 前提

- 已安装 Git
- 已安装 Node.js
- 已安装 Codex

## 目标

Codex 侧最终会用到这两个位置：

```text
~/.moluoxixi/          统一聚合层
~/.agents/skills/      Codex 原生技能发现目录
```

其中最终只会暴露一个命名空间入口：

```text
~/.agents/skills/superpowers -> ~/.moluoxixi/skills
```

## 安装步骤

### macOS / Linux

```bash
mkdir -p "${HOME}/.moluoxixi"

# 1. clone 或更新仓库
if [ -d "${HOME}/.moluoxixi/.git" ]; then
  git -C "${HOME}/.moluoxixi" pull --ff-only
else
  git clone https://github.com/moluoxixi/AIRules.git "${HOME}/.moluoxixi"
fi

# 2. 先安装 superpowers，再拉取其余 vendors
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"

# 3. 重建 vendor skill 链接到 ~/.moluoxixi/skills
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

# 4. 建立 Codex 入口
mkdir -p "${HOME}/.codex"
cp "${HOME}/.moluoxixi/.codex/AGENTS.md" "${HOME}/.codex/AGENTS.md"

# 5. 暴露到 Codex 原生技能发现目录
mkdir -p "${HOME}/.agents/skills"
rm -rf "${HOME}/.agents/skills/superpowers"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.agents/skills/superpowers"
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.moluoxixi" | Out-Null

if (Test-Path "$env:USERPROFILE\\.moluoxixi\\.git") {
  git -C "$env:USERPROFILE\\.moluoxixi" pull --ff-only
} else {
  git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\\.moluoxixi"
}

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

```bash
ls ~/.moluoxixi/vendors/superpowers
ls -la ~/.agents/skills/superpowers
```

确认点：

- 已先安装 `superpowers`
- `~/.moluoxixi/skills/` 下已聚合第一方和第三方 skills
- `~/.agents/skills/superpowers` 已指向 `~/.moluoxixi/skills`
- `~/.codex/AGENTS.md` 已从 `~/.moluoxixi/.codex/AGENTS.md` 同步
