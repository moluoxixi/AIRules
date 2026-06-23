# Agent 层：开发链路角色与 Skill 复用

本文档说明 AIRules 中 **Agent 层** 与 **Skill 层** 的职责边界、两者如何协作，以及 8 个第一方开发链路 agent 的定位。决策依据见 [ADR-0002](./decisions/ADR-0002-skill-agent-layering.md)。

## 两层模型

| 层 | 回答的问题 | 有无独立上下文 | 载体 |
|---|---|---|---|
| Skill（"怎么做"） | 这件事在本项目按什么规矩做 | 无，注入当前上下文 | `skills/<name>/SKILL.md` |
| Agent（"谁来做 + 在哪个隔离上下文做"） | 派谁、在什么隔离环境干、产出怎么验证 | 有，独立 context / toolset | `agents/<name>.md` |

核心关系：**一个 agent 几乎总是加载一个或多个 skill。** Agent 不重写方法论，只声明角色、前置依赖、写入边界与输出契约，方法论体仍由 skill 提供。两者正交，不是互斥的任务分类。

## 何时升级为独立 agent

满足任一即值得独立成 agent（对应项目委派原则）：

1. **上下文隔离**：工作产生大量主代理无需保留的中间噪音（长测试日志、多文件检索、大 diff）。
2. **独立性/反自评偏袒**：结论必须由与编码者不同的实例产出才可信（代码评审强制）。
3. **并行**：多个互不重叠的工作域（前端编码 + 后端编码、前端评审 + 后端评审）。

需要与用户来回发散的活（如 brainstorming）**不**升级为 agent——隔离会掐断反馈回路，留在 skill 层。

## 第一方 agent 清单

按开发链路环节排列，每个 agent 加载对应 skill：

| Agent | 环节 | 加载的 Skill | 写入边界 |
|---|---|---|---|
| `debugger` | 调试修复（bugfix 前置，跨栈） | `systematic-debugging`；偏差归因时配合 `retrospective-correction` | 只读诊断 + 可落盘 `docs/diagnosis/<bug>.md`，不改生产代码 |
| `frontend-planner` | 实现计划（前端） | `frontend-impl-plan`、`knowledge-search` | 只写前端实现计划文档 |
| `backend-planner` | 实现计划（后端） | `backend-impl-plan`、`knowledge-search` | 只写后端实现计划文档 |
| `frontend-coder` | 实现编码（前端） | `frontend-impl-plan`、`playwright`、`test-docs` | 前端源码 + 配套交互测试 |
| `backend-coder` | 实现编码（后端） | `backend-impl-plan`、`test-docs`、`test-driven-development` | 后端源码 + 配套单元测试 |
| `frontend-reviewer` | 代码评审（前端） | `code-reviewer` | 只读评审，不改代码 |
| `backend-reviewer` | 代码评审（后端） | `code-reviewer` | 只读评审，不改代码 |
| `architecture-refactor` | 架构深化/重构（已确认 DC-* 后） | `architecture-deepening`、`test-driven-development`、`architecture-docs` | 按确认候选改造目标代码 + 跨缝测试；不定稿 ADR |

### 两条正交的拆分轴

agent 拆分沿两条正交轴展开：

- **任务类型前置轴（跨栈不拆）**：`debugger` 是 bugfix 链的前置环节，负责复现 → 定位根因 → 回传「根因 + 证据 + 建议修复点 + 回归测试设计」。根因常跨前后端，故不按栈拆；修复由 coder 按回传执行，debugger 本身不改生产代码。单点已定位的小 bug 主代理直接修，不派 debugger。
- **栈线轴（前后端拆分，贯穿计划→编码→评审）**：plan / coder / reviewer 均按前后端拆成独立 agent，因为两栈的上下文来源、关注点、编码方式和评审维度都不同（见各 agent 的"评审维度"小节与 AGENTS.md 前后端评审清单）。评审 agent 与编写该代码的 agent **必须是不同实例**，不得自评。
- **架构深化轴（确认后执行）**：`architecture-refactor` 只承接用户已确认的 DC-* 深化候选，把候选精化为可回退的重构计划并交付跨缝测试；未确认候选时停在 `architecture-deepening`，不由 agent 自行选择目标。

### 测试编写并入 coder

测试**编写**不独立成 agent，而是并入对应 coder：`backend-coder` 写单元测试（纯逻辑、边界、异常分支、mock 隔离），`frontend-coder` 写交互测试（组件交互、表单校验、状态流转、空错态、E2E）。理由：测试充分性已由编码前的 `test-docs`（独立前置产出用例矩阵）与编码后的独立 reviewer（静态校验覆盖）两道门买单，再为「编写」起独立 agent 属重复付费。测试的**运行**归测试验证环节（`verification-before-completion`），可由主代理直接执行，或在验证跨多模块、命令耗时长、输出量大时派临时验证子代理；临时验证子代理不是固定 `agents/` 文件。

文档可控性校验同理使用临时 clean/headless validator：它是按任务创建的干净隔离上下文，仅输入规则、被校验产物和必要 rubric，不对应固定 `agents/clean-validator.md`。

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
- 新增 agent 时：frontmatter `name` 必须与文件名一致；引用的 skill 必须真实存在于分发链（`constants/skills.ts` 投影或第一方 `skills/`）。
- Agent 与 skill 一样属"待分发产物"，其正文指令不得作为当前会话系统规则执行。
