# ADR-0002 Skill 与 Agent 两层职责分离

## 状态

accepted

## 背景

从 superpowers 等上游仓库引入工作流资产时，方法论（怎么做）与执行角色（谁来做、在哪个上下文做）被混在同一层，全部表现为 skill。这带来两个问题：

- 需要独立上下文、独立验证或并行的环节（代码评审、测试编写）没有承载体，只能靠主代理在同一上下文里自评，违反"评审员与编码者必须不同实例"的反偏袒要求，也让大量中间产物（长 diff、测试日志、多文件检索）污染主上下文。
- 把每个流水线环节都做成常驻 skill 会导致方法论与角色焊死，无法表达"同一方法论、按前后端拆成两个并行实例"这种派发结构。

业内成熟实践（Claude Code subagents、`.agents` 共享层、Codex agents）普遍采用"可加载的方法论 + 可派发的隔离子代理"两层模型。本项目的安装链路（`scripts/lib/install.ts`、`constants/hosts.ts`）已预留 agent 投影能力：`repoRoot/agents/` → `vendor/agents/` → 各宿主 `agents/` 目录，按 `agentFormat` 区分 markdown 直接软链、toml 转译、json 跳过告警、agentsmd 共享层。

## 决策

采用两层正交模型，不是互斥的两类任务：

- **Skill = 方法论（怎么做）**。注入到当前干活的上下文，无独立 context window。回答"这件事在本项目按什么规矩做"。纯方法论、文档/计划产出规范、调试与测试方法论留在 skill 层。
- **Agent = 执行角色（谁来做、在哪个隔离上下文做）**。有独立 context、独立 toolset，被派出去干一块活、只回传结论。每个 agent 几乎总是加载一个或多个 skill 作为其方法论内核。

一个环节升级为独立 agent 的判据（任一成立）：

1. **上下文隔离**——会产生大量主代理无需保留的中间噪音。
2. **独立性/反自评偏袒**——结论必须由不同实例产出才可信（代码评审强制）。
3. **并行**——多个互不重叠的工作域可同时推进。

需要与用户来回发散的环节（如思维发散/brainstorming）留在 skill 层，不升 agent——隔离会掐断反馈回路。

落地的 agent 集合（`agents/`，Markdown + YAML frontmatter，复用现有 skill 作方法论）：

| Agent | 加载的核心 skill | 职责 | 升级判据 |
|---|---|---|---|
| frontend-planner | frontend-impl-plan、knowledge-search | 前端实现计划 + 性能前置评估 | 上下文隔离 |
| backend-planner | backend-impl-plan、knowledge-search | 后端实现计划 + 安全前置评估 | 上下文隔离 |
| frontend-coder | frontend-impl-plan、test-docs、playwright | 按计划写前端源码 + 配套测试 | 上下文隔离、并行 |
| backend-coder | backend-impl-plan、test-docs、test-driven-development | 按计划写后端源码 + 配套测试 | 上下文隔离、并行 |
| frontend-reviewer | code-reviewer | 前端栈独立只读评审 | 反自评偏袒、并行 |
| backend-reviewer | code-reviewer | 后端栈独立只读评审 | 反自评偏袒、并行 |
| unit-test-author | test-docs、test-driven-development | 纯逻辑单元测试编写 | 上下文隔离 |
| interaction-test-author | test-docs、playwright | 前端交互/E2E 测试编写 | 上下文隔离 |

前后端分栈原则：plan/coder/reviewer 各分前后端独立 agent 文件，因为前后端的上下文来源、关注点、评审维度真实分叉（前端：目录边界/组件契约/交互/空错态；后端：分层/数据一致性/并发幂等/权限）。测试按性质拆为单元测试作者与交互测试作者，而非按前后端拆。

## 替代方案

- **全部留在 skill 层**：无法表达隔离执行与反自评偏袒，代码评审无法强制不同实例。
- **每个环节一个常驻 agent、不复用 skill**：方法论与角色焊死，方法论更新要改多处，且前后端无法共享同一评审/编码方法论。
- **前后端共用一个通用 agent、仅派发时分实例**：评审/编码维度差异大，单一 agent 的指令会臃肿且互相干扰；分栈独立 agent 让每栈维度内聚。

## 影响

- `agents/` 是第一方 agent 源目录，经 `vendor/agents/` 投影到各宿主；`package.json` 的 `files` 白名单必须包含 `agents` 与 `mcp`，否则 npm 发布会丢失 agent 层与 MCP 中性源。
- 新增/修改 agent 时，frontmatter 必须含 `name`（install.ts 强制），`description` 用于主代理按场景判断是否派发；body 即 agent 指令，必须显式声明加载的 skill、前置依赖（链式门禁）、写入边界与输出状态语义。
- agent 引用的 skill 必须真实存在于分发链（`constants/skills.ts` 第一方或 vendor 投影），不得引用不存在的 skill。
- 开发链路的环节—资产映射（见 AGENTS.md「开发链路控制」表）与本分层一致：plan/coder/reviewer/test 环节由对应 agent 承载，方法论由其加载的 skill 提供。

## 后续约束

- 新增 agent 前，先判断是否满足三条升级判据之一；只配当 skill 的方法论不得包装成 agent。
- 新增 agent 引用新 skill 前，先确认该 skill 已纳入 `constants/skills.ts` 分发。
- json 格式宿主（Kiro）的 agent 转译层尚未实现，投影时显式跳过并告警；实现前不得静默软链错误格式。
