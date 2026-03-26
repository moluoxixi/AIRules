# Moluoxixi AI Rules

Moluoxixi AI Rules 是一套构建在 [superpowers](https://github.com/obra/superpowers) 之上的个人 AI 开发工作流仓库。

它的核心思路不是替代 `superpowers`，而是在 `superpowers` 提供的流程能力之上，再补上我自己长期维护的一层：

- 第一方 `rules`
- 第一方 `skills`
- 第一方 `agents`
- 通过 vendor 管理的第三方 skills
- Claude / Codex 共用的聚合安装结构

安装完成后，`superpowers` 仍然作为底层工作流能力存在，而这个仓库负责把第一方规则、技能和 agent 组织起来，并统一投影到 Claude 和 Codex 的读取位置。

## Installation

### Claude

在 Claude / Claude Code 中告诉它：

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/INSTALL.md
```

### Codex

在 Codex 中告诉它：

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

## Updating

### Claude

在 Claude / Claude Code 中告诉它：

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/UPGRADE.md
```

### Codex

在 Codex 中告诉它：

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/UPGRADE.md
```
