# Moluoxixi AI Workflow Distribution

英文说明请见 [README.md](README.md)。

Moluoxixi AI Workflow Distribution 是一个基于 [superpowers](https://github.com/obra/superpowers) 的、以 skills-first 为核心的个人 AI 工作流发行版。

它面向 Claude、Codex、Qoder、tare 和 openCode，提供统一的技能分发、宿主接入方式与本地安装结构。

## 这个发行版包含什么

- 位于仓库根目录的 `AGENTS.md`，作为宿主全局规则的唯一源文件
- 克隆到 `vendor/repos/` 下的远程 vendor skill 仓库
- 放在 `vendor/skills/` 下的最终技能产物树
- 通过 `~/.moluoxixi/skills/` 暴露给宿主的 leaf skill 投影入口
- 通过 `constants/skills.js` 声明并投影到各宿主的 vendor skills
- 放在 `agents/` 下的第一方 agents，用于编排型辅助角色
- 分别位于 `.claude/`、`.codex/`、`.qoder/`、`.tare/`、`.opencode/` 下的宿主安装与升级文档

## 支持的宿主

- Claude / Claude Code
- Codex CLI
- Qoder IDE
- tare
- openCode

## Claude

### 安装

告诉 Claude:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/INSTALL.md
```

### 更新

告诉 Claude:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/UPGRADE.md
```

## Codex

### 安装

告诉 Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

### 更新

告诉 Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/UPGRADE.md
```

## Qoder

### 安装

告诉 Qoder:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/INSTALL.md
```

### 更新

告诉 Qoder:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/UPGRADE.md
```

## tare

### 安装

告诉 tare:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/INSTALL.md
```

### 更新

告诉 tare:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/UPGRADE.md
```

## openCode

### 安装

告诉 openCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/INSTALL.md
```

### 更新

告诉 openCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/UPGRADE.md
```

## 核心定位

- 这是一个 `skills-first` 的仓库，而不是 `rules-first`
- `superpowers/*` 仍然是底层流程基线
- 第一方 skills 负责表达你的工作方式与技术偏好
- 各宿主通过各自的入口文件把同一套技能树投影到本机

## 技能目录约定

- `constants/skills.js` 负责声明哪些远程 vendor 仓库会被同步到 `vendor/repos/`
- 同一个 manifest 也负责声明这些 vendor source 如何进入 `vendor/skills/`
- `vendor/skills/` 是唯一的最终产物树
- 宿主消费的 `~/.moluoxixi/skills/` 只保留来自 `vendor/skills/` 的扁平 leaf skill 入口
