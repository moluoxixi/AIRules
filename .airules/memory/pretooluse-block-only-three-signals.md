---
name: pretooluse-block-only-three-signals
description: PreToolUse hook 仅允许在三类客观信号下阻断，不得基于模型主观判断；且是 guardrail 非密闭 boundary
metadata:
  type: boundary
  created_at: 2026-06-29
  status: active
---

PreToolUse hook（`hooks/loop-guard.mjs`）**仅允许**在以下三类**客观信号**下 `exit 2` 阻断派发，按优先级：

1. **回路计数超限**：`current_loop_id` 对应回路 `iteration >= max_loop`（账本客观计数）；
2. **blocked_id 命中**：存在 `status: open` 的条目且 `target_stage ∈ affected_downstream`（账本客观状态）；
3. **agent 身份重叠**：reviewer 实例 `agent_id` 与近期 coder 派发同 `agent_id`（客观比对，违反 reviewer≠coder）。

**Why**：阻断理由必须可回溯到上述客观信号之一，**不得**基于模型主观判断阻断——否则把不可审计的"语义判断"引入控制流，违背 baseline「门禁锚定客观信号」原则。来源：[ADR-0006](../../docs/architecture/decisions/ADR-0006-cross-host-hook-capability-baseline.md) 第二段（accepted 2026-06-29）。**关键限制**：PreToolUse 是 guardrail 非密闭 boundary（ADR-0006 第三段）——Codex 官方明示只拦 Bash/apply_patch/MCP，agent 可经等价工具路径绕过；故 hook 阻断**降低**违规概率、**不构成**密闭强制，prose 红线 + 主代理自律仍是第一道防线。

**How to apply**：扩展 `loop-guard.mjs` 拦截条件、或有人想让 hook 基于"语义/质量判断"阻断时，回到这三类客观信号边界，新增信号须先过 ADR。决策逻辑单一事实源是 [constants/loop-ledger.ts](../../constants/loop-ledger.ts) 的 `decideBlock`，脚本内联等价逻辑由契约测试对齐。关联 [[hook-never-block-stop-events]]、[[cross-host-hook-capability-2026-06]]。
