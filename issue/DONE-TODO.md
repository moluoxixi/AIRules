# issue 落地 ToDoList（2026-06-29）

本轮处理 `issue/` 目录 5 个问题文档。先由独立子代理逐条核验事实，再按推荐方案实现 O-01/O-02/O-03/E-01（P0–P2），O-04/E-02（P3）按文档本意暂缓。O-01 当前仅保留"声明 + 契约 + 锚点"层，不再分发 development runtime 回路 hook。

## ✅ 已完成

### O-01 · 回路熔断责任主体 + 账本计数子节（P0）
- [x] `rules/AGENTS.md` 第 9 条补**计数责任主体**声明：`loop_iteration`/`mismatch_loop` 由主代理维护并持久化进账本；子代理只回执 `current_loop_id` 与建议增量；主代理派发 coder 前 MUST 先读账本计数，达上限立即转 `BLOCKED`。
- [x] `skills/subagent-driven-development/SKILL.md` 新增 `### 内层回路计数账本` 子节（`LOOP-COUNTERS` 结构 + 读/增/熔断时机）。
- [x] 回归锚点：`workflow-contract.test.ts` 加 2 条断言（责任主体文本 + `LOOP-COUNTERS`）。
- [ ] ~~运行时硬熔断 hook~~ — **当前决策不做**。development runtime loop hook / ledger 链路已按角色收敛方向撤下；回路熔断继续保留 prose 与 workflow-contract 约束，不作为宿主 hook 分发资产。
- [ ] ~~baseline 同步 `~/.qoderwork/agents.md`~~ — 宿主侧文件，不在本仓库范围。

### O-02 · blocked_id 消费契约（P1）
- [x] `skills/subagent-driven-development/SKILL.md` 把 blocked 传播从单行升级为**结构化条目**（`source_stage`/`reason`/`affected_downstream`/`unblock_condition`/`status`/`created_at` + `resolved_at` 批量解锁）。
- [x] 5 个 agent（planner/coder/debugger/consistency-reviewer/code-reviewer）「输入上下文包」各加"执行前 MUST 读账本→命中 `affected_downstream` 即回执 `BLOCKED`"消费契约。
- [x] `rules/AGENTS.md` blocked_id 定义补**消费契约**（产出方 + 消费方双方落契约）。
- [x] 回归锚点：账本结构化字段 + 5 agent 读账本契约断言。

### O-03 · agent 契约回路字段（P2）
- [x] `consistency-reviewer`/`code-reviewer`/`debugger` 输出契约加**声明性字段**（`current_loop_id`/`current_iteration`，主代理传入、子代理回执）与**建议性字段**（`recommended_next_action`）。
- [x] `code-reviewer` 额外含 `escalation_type` + `should_increment_mismatch_loop`（仅其适用）。
- [x] 同步 `consistency-check`/`requesting-code-review`/`systematic-debugging` 三个 skill 的输出边界样例。
- [x] 回归锚点：三 agent 字段存在 + `should_increment_mismatch_loop` 断言。

### E-01 · 项目 skill 不盲创宿主目录（P2）
- [x] `scripts/check-rules-consistency.ts` 新增 **check #9**：扫 `skills/` 下 SKILL.md 与安装脚本（`.sh/.bash/.ps1/.py/.ts/.js/.mjs/.cjs`），命中 `~/.claude`、`$HOME/.cursor`、`${HOME}/.qoderwork` 等宿主全局目录即报错。
- [x] `rules/AGENTS.md` scope 判定段加文本锚点（防 prose 被误删）。
- [x] 回归锚点：真实仓库经 check #9 验证 0 命中（复用脚本为唯一事实源）+ 种入 rogue skill 验证 check #9 真能捕获 + scope 锚点存在。

### 验证与评审
- [x] **实际运行**：`npm run rules:check` PASS；`npm test` 161/161 PASS（含 36 条 contract，10 条本轮新增）；`npm run lint:check` 0 error；`npm run typecheck` 0 error。
- [x] **独立评审**（reviewer ≠ coder）：一致性 PASS、代码质量 PASS（无 Critical，`escalation_type: code_quality`）。已采纳评审 Improvements：check #9 消息措辞改为诚实表述"引用(presence)"而非臆断"自建"、文件类型扩到 ps1/py/bash、正则补 `${HOME}` 花括号形；fixture 测试改为复用 `checkRulesConsistency` 避免与脚本逻辑漂移；rules 消费契约"派发前"措辞改"执行前"对齐 agent 文件。

## ⏳ 暂缓（P3，文档本意不在本轮）

### O-04 · 流水线聚合 trace 格式
- [ ] 现状属实：阶段证据 schema 仅散文式逐阶段字段，无结构化聚合容器。
- 暂缓原因：不影响当前正确性，仅影响 self-evolution 数据质量；当前启发式扫描已够用。
- 触发条件：`distill-candidates` 报信噪比下降 / 提出按流水线粒度做指标分析 / O-01 账本格式自然演化出 run-level 聚合需求。

### E-02 · 纵向评测依赖宿主 runtime
- [ ] 现状属实，且是**显式取舍**：项目主动放弃 runtime 计数器（`recall_count`/`override_count`），靠启发式扫描沉淀素材。
- 暂缓原因：纯 prompt 项目无运行时事件流；按 baseline 取舍原则不算 Gap。
- 触发条件：宿主（QoderWork/Claude Code/Cursor）提供 recall 事件 + override 事件 + 事件聚合查询三类能力后才启动。

## 📋 核验结论备注

- O-01/O-03/E-01 三个 issue 的事实断言**完全属实**。
- O-02 核心缺口（无消费方契约）属实；仅一处措辞略有夸大（原文称"指明产出方"，实际 rules 文本产出/消费方都未指名）——已在落地时一并补全双方。
- 本轮**未触及** `vendor/`（git-ignored 只读沙箱）与任何 git-ignored 文件。

## 影响文件清单

| 文件 | 改动 |
|---|---|
| `rules/AGENTS.md` | 第 9 条计数责任主体；blocked_id 消费契约；scope 判定宿主目录锚点 |
| `skills/subagent-driven-development/SKILL.md` | 内层回路计数账本子节；blocked 结构化条目 |
| `agents/{planner,coder,debugger,consistency-reviewer,code-reviewer}.md` | 输入上下文包加读账本消费契约 |
| `agents/{consistency-reviewer,code-reviewer,debugger}.md` | 输出契约加回路字段 |
| `skills/{consistency-check,requesting-code-review,systematic-debugging}/SKILL.md` | 输出边界回路字段样例 |
| `scripts/check-rules-consistency.ts` | 新增 check #9 |
| `__test__/workflow-contract.test.ts` | 新增 describe 块，10 条 O-01/O-02/O-03/E-01 断言与 fixture |
