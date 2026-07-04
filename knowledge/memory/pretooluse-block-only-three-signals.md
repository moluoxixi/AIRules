---
name: pretooluse-block-only-three-signals
description: 已废弃的 development runtime PreToolUse 阻断策略；仅作历史记录，当前不再分发对应 hook
metadata:
  type: boundary
  created_at: 2026-06-29
  status: superseded
---

历史 development runtime PreToolUse hook 曾**仅允许**在以下三类**客观信号**下 `exit 2` 阻断派发，按优先级：

1. **回路计数超限**：`current_loop_id` 对应回路 `iteration >= max_loop`（账本客观计数）；
2. **blocked_id 命中**：存在 `status: open` 的条目且 `target_stage ∈ affected_downstream`（账本客观状态）；
3. **agent 身份重叠**：reviewer 实例 `agent_id` 与近期 coder 派发同 `agent_id`（客观比对，违反 reviewer≠coder）。

**Why**：阻断理由必须可回溯到上述客观信号之一，**不得**基于模型主观判断阻断——否则把不可审计的"语义判断"引入控制流，违背 baseline「门禁锚定客观信号」原则。**关键限制**：PreToolUse 是 guardrail 非密闭 boundary，hook 阻断只降低违规概率、不构成密闭强制。

**How to apply**：当前不再应用；development runtime loop hook / ledger 链路已撤下。若未来重新引入运行时阻断，必须重新立项并复核宿主能力、客观信号边界与角色分发范围。关联 [[hook-never-block-stop-events]]、[[cross-host-hook-capability-2026-06]]。
