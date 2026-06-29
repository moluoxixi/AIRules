---
name: project-skill-no-host-global-write
description: 项目级 skill 不得在安装脚本或 SKILL.md 中引用宿主全局目录主动创建全局资产
metadata:
  type: constraint
  created_at: 2026-06-29
  status: active
---

项目级 skill **不得**在安装脚本或 SKILL.md 中引用宿主全局目录（`~/.claude/`、`~/.cursor/`、`~/.qoderwork/`、`$HOME/.claude/`、`${HOME}/...` 等）主动创建全局资产。

**Why**：「写源 skills 目录 + 登记 `constants/skills.ts` + 经 vendor 投影」机制仅在 AIRules 仓库内适用；分发到用户项目时，全局可复用洞见是**上游贡献候选**（交人工决定回流 AIRules），不在用户仓库内自建「全局」资产。违反会导致用户项目内出现未经审核的"全局"资产、后续同步分叉冲突、scope 判定流程被绕过。来源：[rules/AGENTS.md](../../rules/AGENTS.md) scope 判定段。

**How to apply**：写 `init-project` 类或任何项目级 skill 时，安装/写入路径只落项目内（`.airules/`、项目根），不碰宿主 home。此约束有客观信号兜底——[check-rules-consistency.ts](../../scripts/check-rules-consistency.ts) check #9 扫 `skills/` 下 SKILL.md 与安装脚本（`.sh/.bash/.ps1/.py/.ts/.js/.mjs/.cjs`），命中宿主全局目录引用即报错。即「不只靠 prose、有脚本拦截」。
