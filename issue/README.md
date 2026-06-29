# 未决问题索引

本目录登记 `busyming-ai-rules` 仓库的结构性问题及其落地轨迹。

> **状态（截至 2026-06-29）**：O-01/O-02/O-03/E-01（P0–P2）已全部落地——prose 层与 runtime 承载层（hook 硬熔断 + 账本：`hooks/loop-guard.mjs`、`hooks/subagent-trace.mjs`、`constants/loop-ledger.ts`，ADR-0006 已 accepted）的落地凭据见 [DONE-TODO.md](./DONE-TODO.md)。仅 O-04 / E-02（P3 远期话题）仍未决。各问题立项时的分析快照与路线图（`01~04`、`评估.md`、`复核.md`、两份核验报告）已于落地后删除——内容已收口进 DONE-TODO.md 与代码/文档，历史正文可经 git 历史追溯。

## 仍未决问题

| 编号 | 主题 | 优先级 | 文件 |
|---|---|---|---|
| O-04 / E-02 | 远期话题（聚合 trace + 纵向评测） | P3 | [05-远期话题.md](./05-远期话题.md) |

## 已落地问题（凭据见 DONE-TODO.md 与代码）

| 编号 | 主题 | 落地凭据 |
|---|---|---|
| O-01 | 回路熔断缺运行时承载 | prose + runtime：[DONE-TODO.md](./DONE-TODO.md)；`hooks/loop-guard.mjs` + `hooks/subagent-trace.mjs` + `constants/loop-ledger.ts`（协议见 `docs/architecture/loop-ledger-protocol.md`） |
| O-02 | `blocked_id` 跨阶段共享缺消费契约 | [DONE-TODO.md](./DONE-TODO.md) O-02（5 agent 输入契约 + 账本结构化条目 + hook blocked_id 消费） |
| O-03 | 计数器责任主体在 agent 契约层缺失 | [DONE-TODO.md](./DONE-TODO.md) O-03（agent 回路字段）+ 账本 `recent_dispatches` 承载计数 |
| E-01 | "项目 skill 不盲创宿主目录"零覆盖 | [DONE-TODO.md](./DONE-TODO.md) E-01（`check-rules-consistency.ts` check #9） |

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

## 后续优先级

O-01/O-02/O-03/E-01 已落地（见上表）。剩余：

1. **O-04 / E-02** 远期话题 — 等聚合 trace 需求 / 宿主 runtime 能力到位再启动（触发条件见 [05-远期话题.md](./05-远期话题.md)）。
2. **现网烟测** — runtime hook 的真宿主生效性验证尚未跑（见 `docs/architecture/hook-smoke-test-guide.md`），Phase 2/3 过线前不宣称"已生效"。
