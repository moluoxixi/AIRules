# 未决问题索引

本目录登记 `busyming-ai-rules` 仓库中尚未落地的结构性问题。每条问题对应一个独立 `.md` 文件，控制在 3000 字以内。

所有问题均**经独立子代理逐字核验**（2026-06-28）确认事实成立；历史多轮复核中已被规则资产吸收或被反例推翻的条目不再保留（见末尾"已撤回条目"）。

## 当前未决问题

| 编号 | 主题 | 优先级 | 文件 |
|---|---|---|---|
| O-01 | 回路熔断缺运行时承载 | P0 | [01-回路熔断运行时承载.md](./01-回路熔断运行时承载.md) |
| O-02 | `blocked_id` 跨阶段共享缺消费契约 | P1 | [02-blocked-id消费契约.md](./02-blocked-id消费契约.md) |
| O-03 | 计数器责任主体在 agent 契约层完全缺失 | P2 | [03-计数器责任主体.md](./03-计数器责任主体.md) |
| E-01 | "项目 skill 不盲创宿主目录"零覆盖 | P2 | [04-项目skill宿主目录零覆盖.md](./04-项目skill宿主目录零覆盖.md) |
| O-04 / E-02 | 远期话题（聚合 trace + 纵向评测） | P3 | [05-远期话题.md](./05-远期话题.md) |

## 已撤回条目（核验不成立）

以下问题在历史 issue 中曾被列出，但子代理逐字核验后判定事实**不成立**或已被规则资产覆盖：

| 历史断言 | 核验反例 |
|---|---|
| `subagent-driven-development` 的 fix→review 循环无上限 | `skills/subagent-driven-development/SKILL.md:91` 已写"不得超过 2 次"+ 显式引用 `Test→Debug→Code` 的 `max_loop` 并说明二者关系 |
| 合约测试未覆盖 Consist→Code 与 `requirement_mismatch` 回路有界性 | `__test__/workflow-contract.test.ts:282-296` 已含 5 条 `assert.match` 断言完整覆盖 |
| `recall-memory` boundary 跳过是完全静默 opt-in | `skills/recall-memory/SKILL.md:25` 明示"跳过不静默——在召回输出末尾附一行可观测提示"并给出 `[info]` 模板 |
| 存量 memory 条目未迁移 `created_at` + `status` | `.airules/memory/memory-needs-review-like-skills.md:1-8` frontmatter 完整含 `created_at: 2026-06-27` 与 `status: active` |
| Phase 4 fixture 对自我进化约束**全部**零覆盖 | (a) `vendor/` git-ignored 已被 `workflow-contract.test.ts:324-329` 覆盖；(b) skill 登记 `constants/skills.ts` 已被 `check-rules-consistency.ts:183-197` 反向校验 + `workflow-contract.test.ts:100-109` fixture 覆盖；(c) memory frontmatter `status`/`created_at` 已被 `workflow-contract.test.ts:302-315` 校验。**仅 (d) 项目 skill 不盲创宿主目录确为零覆盖，保留为 E-01。** |

## 已闭合项（历史已落地）

以下历史问题已被规则资产吸收，不再列入未决清单：

- 全局回路熔断三条内层回路 + `mismatch_loop` 外层独立计数（`rules/AGENTS.md` 第 9 条 + Mermaid 图 + `__test__` 覆盖）
- YAML 验收清单（`skills/test-design`、`skills/consistency-check`）
- 并行 coder worktree 隔离（`skills/dispatching-parallel-agents`、`skills/using-git-worktrees`）
- 代码评审 `escalation_type` 升级路由（`agents/code-reviewer`、Mermaid 双出边）
- `budget_hint` token 软分配（阶段证据 schema 可选字段）
- memory 生命周期 prose（`created_at`、`status`、`superseded` 过滤、boundary 平衡召回）
- scope 判定 5 类候选落点
- spec-workflow 三态（propose / apply / archive）

## 修复优先级

1. **O-01** 回路熔断运行时承载 — 唯一 P0，违反项目自身"memory 不是 enforcement"原则。**运行时承载部分**（hook 硬熔断 + 账本）已由 [评估.md](./评估.md) P1 正式立项落地（`hooks/loop-guard.mjs`、`hooks/subagent-trace.mjs`、`constants/loop-ledger.ts`），原 issue 的"声明+契约+锚点"层与评估的"runtime"层互补、不分叉。
2. **O-02** `blocked_id` 消费契约 — 与 O-01 共享进度账本基础设施
3. **O-03** agent 输出契约补 `current_loop_id` / `current_iteration` 字段 — 配合 O-01 落地
4. **E-01** 项目 skill 不盲创宿主目录的 fixture — 单测补强
5. **O-04 / E-02** 远期话题 — 等聚合 trace 需求/宿主 runtime 能力到位
