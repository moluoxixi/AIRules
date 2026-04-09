# Moluoxixi AI Workflow Distribution

英文说明请见 [README.md](README.md)。

Moluoxixi AI Workflow Distribution 是一个基于 [superpowers](https://github.com/obra/superpowers) 的、以 skills-first 为核心的个人 AI 工作流发行版。

它面向 Claude、Codex、Qoder、tare 和 openCode，提供统一的技能分发、宿主接入方式与本地安装结构。

## 这个发行版包含什么

- 位于仓库根目录的 `AGENTS.md`，作为宿主全局规则的唯一源文件
- 放在 `skills/` 下的第一方与投影 skills，用来承载本地工作流默认值和宿主消费入口
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

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/INSTALL.md`

### 更新

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/UPGRADE.md`

## Codex

### 安装

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md`

### 更新

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/UPGRADE.md`

## Qoder

### 安装

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/INSTALL.md`

### 更新

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/UPGRADE.md`

## tare

### 安装

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/INSTALL.md`

### 更新

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/UPGRADE.md`

## openCode

### 安装

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/INSTALL.md`

### 更新

`https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/UPGRADE.md`

## 核心定位

- 这是一个 `skills-first` 的仓库，而不是 `rules-first`
- `superpowers/*` 仍然是底层流程基线
- 第一方 skills 负责表达你的工作方式与技术偏好
- 各宿主通过各自的入口文件把同一套技能树投影到本机
