# Moluoxixi Rules 安装指南（Claude）

## 前提

- 已安装 Git
- 已安装 Node.js
- Claude 已可正常使用

## 目标

安装完成后，核心内容会集中在：

```text
~/.moluoxixi/
  vendors/
  rules/
  skills/
  agents/
  .claude/
  .codex/
```

Claude 实际读取：

```text
~/.claude/rules   -> ~/.moluoxixi/rules
~/.claude/skills  -> ~/.moluoxixi/skills
~/.claude/agents  -> ~/.moluoxixi/agents
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

# 2. 先安装 superpowers，再拉取其他 vendors
node "${HOME}/.moluoxixi/scripts/sync-vendors.mjs" --home "${HOME}/.moluoxixi"

# 3. 根据 manifest 重建第三方 skill 链接到 ~/.moluoxixi/skills
node "${HOME}/.moluoxixi/scripts/rebuild-links.mjs" --home "${HOME}/.moluoxixi"

# 4. 把 Claude 入口指向 ~/.moluoxixi
mkdir -p "${HOME}/.claude"
rm -rf "${HOME}/.claude/rules" "${HOME}/.claude/skills" "${HOME}/.claude/agents"
ln -sfn "${HOME}/.moluoxixi/rules" "${HOME}/.claude/rules"
ln -sfn "${HOME}/.moluoxixi/skills" "${HOME}/.claude/skills"
ln -sfn "${HOME}/.moluoxixi/agents" "${HOME}/.claude/agents"
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

New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude" | Out-Null
if (Test-Path "$env:USERPROFILE\\.claude\\rules") {
  Remove-Item "$env:USERPROFILE\\.claude\\rules" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\skills") {
  Remove-Item "$env:USERPROFILE\\.claude\\skills" -Recurse -Force
}
if (Test-Path "$env:USERPROFILE\\.claude\\agents") {
  Remove-Item "$env:USERPROFILE\\.claude\\agents" -Recurse -Force
}
cmd /c mklink /J "$env:USERPROFILE\\.claude\\rules" "$env:USERPROFILE\\.moluoxixi\\rules"
cmd /c mklink /J "$env:USERPROFILE\\.claude\\skills" "$env:USERPROFILE\\.moluoxixi\\skills"
cmd /c mklink /J "$env:USERPROFILE\\.claude\\agents" "$env:USERPROFILE\\.moluoxixi\\agents"
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
- `~/.claude/skills/` 已指向 `~/.moluoxixi/skills/`

## 说明

- 这里默认先安装 `superpowers`，再叠加你自己的规则与其他第三方 skills
- `rules/` 是第一方维护
- 第三方 skills 不直接复制到其他目录，而是围绕 `~/.moluoxixi/` 聚合并通过软链接暴露
