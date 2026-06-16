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
| `frontend-planner` | 实现计划（前端） | `frontend-impl-plan`、`knowledge-search` | 只写前端实现计划文档 |
| `backend-planner` | 实现计划（后端） | `backend-impl-plan`、`knowledge-search` | 只写后端实现计划文档 |
| `frontend-coder` | 实现编码（前端） | `frontend-impl-plan`、`playwright`、`test-docs` | 前端源码 + 配套测试 |
| `backend-coder` | 实现编码（后端） | `backend-impl-plan`、`test-docs`、`test-driven-development` | 后端源码 + 配套测试 |
| `unit-test-author` | 测试设计/编写（单元） | `test-docs`、`test-driven-development` | 单元测试 + mock/fixture |
| `interaction-test-author` | 测试设计/编写（交互） | `test-docs`、`playwright` | 前端交互测试 + fixture/mock |
| `frontend-reviewer` | 代码评审（前端） | `code-reviewer` | 只读评审，不改代码 |
| `backend-reviewer` | 代码评审（后端） | `code-reviewer` | 只读评审，不改代码 |

### 前后端分栈

plan / coder / reviewer 均按前后端拆成独立 agent，因为两栈的上下文来源、关注点、编码方式和评审维度都不同（见各 agent 的"评审维度"小节与 AGENTS.md 前后端评审清单）。评审 agent 与编写该代码的 agent **必须是不同实例**，不得自评。

### 测试拆分

测试拆为 `unit-test-author`（纯逻辑、边界、异常分支、mock）与 `interaction-test-author`（组件交互、表单校验、状态流转、空错态、E2E）。两者均只**编写**测试，**不负责运行**——运行归测试验证环节（`verification-before-completion`）。

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
