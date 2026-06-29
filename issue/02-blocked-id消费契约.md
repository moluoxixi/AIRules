# O-02 · `blocked_id` 跨阶段共享缺少消费契约（P1）

## 现状（核验通过）

`rules/AGENTS.md` 阶段证据 schema 中 `blocked_id` 标注为"可选"，但**没有任何 skill/agent 的输出契约要求消费 `blocked_id`**——即使 planner 标了 blocked_id，下游也不会读取它。

核验证据：

- `rules/AGENTS.md:64`：`blocked_id`（可选）"当某 `MISSING`/`BLOCKED` 跨阶段传播时…用户澄清解除后据此批量解锁下游"。**定义存在，未指定消费方**。
- 全仓 Grep `blocked_id` 命中 3 处：
  - `rules/AGENTS.md:64`（定义/产出方）
  - `skills/subagent-driven-development/SKILL.md:124`（"可选 blocked 传播扩展…在账本里给它一个稳定 `blocked_id`，记一行 `BLOCKED <id>: <源头/原因>, 受阻任务 3/5/7, 解除条件 <…>`"——产出 + 自身账本读写，未要求其他子代理读取）
  - `issue/未决问题.md`（问题登记，非契约）
- 5 个 agents 文件（`planner.md`、`coder.md`、`consistency-reviewer.md`、`code-reviewer.md`、`debugger.md`）的"输入上下文包"与"职责"段经 Grep 后**无任何 `blocked_id` 出现**。

  - `agents/consistency-reviewer.md:16-21` 输入清单仅含 diff、需求/计划/验收用例、YAML 验收清单、N/A 条件
  - `agents/code-reviewer.md:18-22`、`agents/debugger.md:16-22` 同样缺失

## 现场观察

子代理压测中并行派发 4 个子代理时，planner 在前置门禁标 `MISSING blocked`，但 3 个下游子代理**无机制感知**，独立执行得出的结论虽契约正确但语义悬空。

## 修复建议

### 1. 进度账本中明确 `blocked_id` 数据结构

在 `skills/subagent-driven-development/SKILL.md` 的进度账本段（`:117-124`），把当前的可选记录升级为有结构的条目：

```
BLOCKED <blocked_id>:
  source_stage: <planner | consistency | review | test | debug>
  reason: <原始 MISSING 字段或失败摘要>
  affected_downstream: [<stage>, <stage>, ...]
  unblock_condition: <用户澄清的具体内容 / 上游产物补齐方式>
  status: open | resolved
  created_at: <YYYY-MM-DD>
```

### 2. 子代理输入契约 MUST 读账本

在 5 个 agent 文件（`planner.md`、`coder.md`、`consistency-reviewer.md`、`code-reviewer.md`、`debugger.md`）的"输入上下文包"段增加一条：

> 执行前 MUST 读取进度账本（`subagent-driven-development` 中规定的位置），若发现自身所属下游阶段在 `affected_downstream` 列表中且对应 `BLOCKED` 仍为 `open`，立即转 `BLOCKED` 状态回执，**不继续推理**；附带回执 `blocked_id` 以便主代理在解除时批量解锁。

### 3. 主代理派发协议补充

主代理派发任一子代理前，把账本中所有 `open` 状态的 `BLOCKED` 条目附入派发上下文。当用户澄清解除某条 `BLOCKED` 时，主代理把 `status` 改为 `resolved`，并据 `affected_downstream` 批量重派受阻下游。

## 与 O-01 的关系

进度账本是 O-01（回路计数）与 O-02（blocked 传播）**共享的基础设施**。两者应作为一个机制设计：

- O-01 在账本中维护 `{loop_name → iteration}`
- O-02 在账本中维护 `{blocked_id → 结构化条目}`

避免分别立两套机制。落地建议在同一份 `skills/subagent-driven-development/SKILL.md` 子节中一并扩展。

## 回归测试设计

```yaml
- id: TC-BlockedId-001
  name: planner 标 blocked_id 后，下游派发被自动阻断
  given: planner 输出 blocked_id=B-001，affected_downstream=[consistency, code-review]
  when: 主代理尝试派发 consistency-reviewer
  then: consistency-reviewer 输入契约读账本发现 B-001 open，立即回执 BLOCKED

- id: TC-BlockedId-002
  name: 用户澄清解除 blocked_id 后批量解锁
  given: 账本 B-001 status=open，受阻 3 个下游
  when: 主代理把 status 改为 resolved
  then: 3 个下游可被重新派发，账本 resolved_at 字段被填入
```

## 影响范围

- `skills/subagent-driven-development/SKILL.md`（进度账本扩展 blocked_id 结构化条目）
- `agents/planner.md`、`agents/coder.md`、`agents/consistency-reviewer.md`、`agents/code-reviewer.md`、`agents/debugger.md`（输入契约段补"读账本"要求）
- `__test__/workflow-contract.test.ts` 增加 2 条 blocked_id 传播测试
- 与 O-01 同步落地，避免重复设计基础设施

## 关联

- **O-01** 共享进度账本基础设施
- **O-03** agent 输入契约改造可在同一轮 PR 中完成（输入契约 + 输出契约一起更新）
