# ADR-0002 Skill 与 Agent 两层职责分离

## 状态

accepted

## 背景

从 superpowers 等上游仓库引入工作流资产时，方法论（怎么做）与执行角色（谁来做、在哪个上下文做）被混在同一层，全部表现为 skill。这带来两个问题：

- 需要独立上下文、独立验证或并行的环节（代码评审、复杂重构执行、长验证/日志收集）没有承载体，只能靠主代理在同一上下文里自评或保留大量中间产物，违反"评审员与编码者必须不同实例"的反偏袒要求，也让长 diff、测试日志、多文件检索污染主上下文。
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
| debugger | systematic-debugging；偏差归因时配合 retrospective-correction | bugfix 链前置：复现 → 定位根因 → 回传根因 + 证据 + 修复点 + 回归测试设计（不改生产代码，跨栈不拆） | 上下文隔离 |
| frontend-planner | frontend-impl-plan、knowledge-search | 前端实现计划 + 性能前置评估 | 上下文隔离、并行 |
| backend-planner | backend-impl-plan、knowledge-search | 后端实现计划 + 安全前置评估 | 上下文隔离、并行 |
| frontend-coder | frontend-impl-plan、playwright、test-docs | 按计划写前端源码 + 配套交互测试 | 上下文隔离、并行 |
| backend-coder | backend-impl-plan、test-docs、test-driven-development | 按计划写后端源码 + 配套单元测试 | 上下文隔离、并行 |
| frontend-reviewer | code-reviewer | 前端栈独立只读评审 | 反自评偏袒、并行 |
| backend-reviewer | code-reviewer | 后端栈独立只读评审 | 反自评偏袒、并行 |
| consistency-reviewer | consistency-check | 编码后核对最终 diff 是否符合需求、测试设计、实现计划或 bugfix 诊断 | 反自评偏袒、上下文隔离 |
| architecture-refactor | architecture-deepening、test-driven-development、architecture-docs | 用户确认 DC-* 后精化重构计划并交付行为等价改造 + 跨缝测试，回传 ADR 要点 | 上下文隔离 |

两条正交的拆分轴：

- **任务类型前置轴（跨栈不拆）**：`debugger` 是 bugfix 链的前置环节，复现并定位根因后回传「根因 + 证据 + 建议修复点 + 回归测试设计」。根因常跨前后端，故不按栈拆；修复由 coder 按回传执行，debugger 本身不改生产代码。单点已定位的小 bug 主代理直接修，不派 debugger。
- **栈线轴（前后端拆分）**：plan/coder/reviewer 各分前后端独立 agent 文件，因为前后端的上下文来源、关注点、评审维度真实分叉（前端：目录边界/组件契约/交互/空错态；后端：分层/数据一致性/并发幂等/权限）。两轴正交，debugger 的跨栈定位不与 plan/coder/reviewer 的栈线拆分冲突。
- **后置一致性轴（跨栈不拆）**：`consistency-reviewer` 在编码后、测试验证前读取最终 diff 与上游事实源，核对实现是否忠实落地需求、用例、计划或 bugfix 诊断；它不替代编码前 `consistency-check`，也不承担 `code-reviewer` 的代码质量评审职责。
- **架构深化轴（确认后执行）**：`architecture-refactor` 只在 `architecture-deepening` 已产出候选且用户确认具体 DC-* 后触发，负责把候选精化为可回退的重构计划并交付跨缝测试；未确认候选时不自行选择目标。

测试**编写**不独立成 agent，而是并入对应 coder：`backend-coder` 写单元测试（纯逻辑、边界、异常分支、mock 隔离），`frontend-coder` 写交互测试（组件交互、表单校验、状态流转、空错态、E2E）。理由：测试充分性已由编码前的 `test-docs`（独立前置产出用例矩阵）与编码后的独立 reviewer（静态校验覆盖）两道门买单，再为「编写」起独立 agent 属重复付费；测试的**运行**归测试验证环节（`verification-before-completion`），与编写分离，可由主代理直接执行，也可在输出量大或跨多模块时派临时验证子代理。临时验证子代理和文档 clean/headless validator 是按任务创建的隔离上下文，不对应固定 `agents/` 文件。

## 替代方案

- **全部留在 skill 层**：无法表达隔离执行与反自评偏袒，代码评审无法强制不同实例。
- **每个环节一个常驻 agent、不复用 skill**：方法论与角色焊死，方法论更新要改多处，且前后端无法共享同一评审/编码方法论。
- **前后端共用一个通用 agent、仅派发时分实例**：评审/编码维度差异大，单一 agent 的指令会臃肿且互相干扰；分栈独立 agent 让每栈维度内聚。

## 影响

- `agents/` 是第一方 agent 源目录，经 `vendor/agents/` 投影到各宿主；`package.json` 的 `files` 白名单必须包含 `agents` 与 `mcp`，否则 npm 发布会丢失 agent 层与 MCP 中性源。
- 新增/修改 agent 时，frontmatter 必须含 `name`（install.ts 强制），`description` 用于主代理按场景判断是否派发；body 即 agent 指令，必须显式声明加载的 skill、前置依赖（链式门禁）、写入边界与输出状态语义。
- agent 引用的 skill 必须真实存在于分发链（`constants/skills.ts` 第一方或 vendor 投影），不得引用不存在的 skill。
- 开发链路的环节—资产映射（见 AGENTS.md「开发链路控制」表）与本分层一致：plan/coder/reviewer/consistency-reviewer/architecture-refactor 环节由具名 agent 承载；测试验证由 `verification-before-completion` skill 在主代理或临时验证子代理中执行，方法论由其加载的 skill 提供。

## 后续约束

- 新增 agent 前，先判断是否满足三条升级判据之一；只配当 skill 的方法论不得包装成 agent。
- 新增 agent 引用新 skill 前，先确认该 skill 已纳入 `constants/skills.ts` 分发。
- json 格式宿主（Kiro）的 agent 转译层尚未实现，投影时显式跳过并告警；实现前不得静默软链错误格式。
