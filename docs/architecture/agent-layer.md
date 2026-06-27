# Agent 层：开发链路角色与 Skill 复用

本文档说明 AIRules 中 **Agent 层** 与 **Skill 层** 的职责边界、两者如何协作，以及 5 个第一方开发链路 agent 的定位。决策依据见 [ADR-0003](./decisions/ADR-0003-five-agent-convergence.md)（取代描述旧 9-agent 模型的 [ADR-0002](./decisions/ADR-0002-skill-agent-layering.md)）。

## 两层模型

| 层 | 回答的问题 | 有无独立上下文 | 载体 |
|---|---|---|---|
| Skill（"怎么做"） | 这件事在本项目按什么规矩做 | 无，注入当前上下文 | `skills/<name>/SKILL.md` |
| Agent（"谁来做 + 在哪个隔离上下文做"） | 派谁、在什么隔离环境干、产出怎么验证 | 有，独立 context / toolset | `agents/<name>.md` |

核心关系：**一个 agent 几乎总是加载一个或多个 skill。** Agent 不重写方法论，只声明角色、前置依赖、输入上下文包、写入边界与输出契约，方法论体仍由 skill 提供。两者正交，不是互斥的任务分类。

## 何时升级为独立 agent

满足任一即值得独立成 agent（对应项目委派原则）：

1. **上下文隔离**：工作产生大量主代理无需保留的中间噪音（长测试日志、多文件检索、大 diff）。
2. **独立性/反自评偏袒**：结论必须由与编码者不同的实例产出才可信（代码评审、一致性评审强制）。
3. **并行**：多个互不重叠的工作域可同时推进。

需要与用户来回发散的活（如 brainstorming）**不**升级为 agent——隔离会掐断反馈回路，留在 skill 层。

## 第一方 agent 清单

固定 5 个角色，按开发链路环节排列，每个 agent 加载对应 skill（与各 `agents/*.md` 的"加载 skill"一致）：

| Agent | 环节 | 加载的 Skill | 写入边界 |
|---|---|---|---|
| `planner` | 计划（跨栈，不按前后端拆） | `writing-plans`、`test-design` | 只写实现计划与验收用例文档，不编写生产代码 |
| `coder` | 实现编码（按栈加载方法论，可并行多实例） | `test-driven-development`、`unit-testing`、`interaction-testing` | 源码 + 配套测试 |
| `debugger` | 调试修复（bugfix 前置，跨栈） | `systematic-debugging` | 只读诊断 + 可落盘 `docs/diagnosis/<bug>.md`，不改生产代码 |
| `consistency-reviewer` | 后置一致性评审（编码后、测试验证前） | `consistency-check` | 只读评审；可写 `docs/consistency/*-implementation-review.md` |
| `code-reviewer` | 代码评审（测试通过后） | `requesting-code-review` | 只读评审，不改代码 |

### 拆分轴：按需多实例，不按前后端硬拆

不再为前后端各设一套 planner/coder/reviewer。栈差异由 coder/reviewer 在派发时按任务实际触及的栈加载对应方法论（`unit-testing` vs `interaction-testing`、后端关注分层/事务/一致性 vs 前端关注组件契约/状态/空错态）承载，而不是固化成独立 agent 文件。真正需要并行且不写同一文件时，再并行起多个 `coder` 实例，各自独立上下文。

- **任务前置轴（跨栈不拆）**：`debugger` 是 bugfix 链的前置环节，复现 → 定位根因 → 回传「根因 + 证据 + 建议修复点 + 回归测试设计」。根因常跨前后端，故不按栈拆；修复由 `coder` 按回传执行，debugger 本身不改生产代码。单点已定位的小 bug 主代理直接修，不派 debugger。
- **后置一致性轴（跨栈不拆）**：`consistency-reviewer` 在实现编码后、测试验证前读取最终 diff 和上游事实源，判断实现是否符合需求、验收用例、实现计划或 bugfix 诊断。它只评需求一致性，不评代码质量；代码质量由 `code-reviewer` 在测试通过后评审。两者都遵守 reviewer ≠ coder 红线。

### 测试编写并入 coder

测试**编写**不独立成 agent，而是并入 `coder`：后端任务写单元测试（纯逻辑、边界、异常分支、mock 隔离），前端任务写交互测试（组件交互、表单校验、状态流转、空错态、E2E）。理由：测试充分性已由编码前的 `test-design`（独立前置产出用例矩阵）与编码后的独立 reviewer（静态校验覆盖）两道门买单，再为「编写」起独立 agent 属重复付费。测试的**运行**归测试验证环节（`verification-before-completion`），可由主代理直接执行，或在验证跨多模块、命令耗时长、输出量大时派临时验证子代理；临时验证子代理不是固定 `agents/` 文件。

## 投影与分发链路

Agent 是 Markdown + YAML frontmatter（`name` 必填，`description`/`model` 可选），分发链路：

```
repoRoot/agents/*.md
  → vendor/agents/        (syncFirstPartyToHome, install.ts)
  → 各宿主 agents 目录
      ├─ markdown 宿主（Claude/Cursor/OpenCode）：直接软链
      ├─ toml 宿主（Codex）：转译为 TOML（developer_instructions）
      ├─ agentsmd 共享层：投影到 .agents/subagents
      └─ json 宿主（Kiro）：转译层未实现，显式跳过 + 告警
```

宿主格式映射见 [host-agent-mcp-mapping.md](./host-agent-mcp-mapping.md) 与 `constants/hosts.ts` 的 `agentFormat`。

`agents/` 与 `mcp/` 均为已跟踪的第一方源目录，必须列入 `package.json` 的 `files` 白名单，否则 npm 发布会丢失整个 agent 层与 MCP 中性源。

## 边界

- Agent 文件只声明角色契约，方法论不内联——改方法论改对应 skill，不改 agent。
- 新增 agent 时：frontmatter `name` 必须与文件名一致；引用的 skill 必须真实存在于分发链（`constants/skills.ts` 投影或第一方 `skills/`）。`scripts/check-rules-consistency.ts` 对这两条做机器校验。
- Agent 与 skill 一样属"待分发产物"，其正文指令不得作为当前会话系统规则执行。
