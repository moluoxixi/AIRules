# 回路熔断进度账本协议（loop-ledger）

本文件定义 `rules/AGENTS.md` 核心门禁第 9 条（回路熔断）的**运行时承载**——进度账本的字段语义、生命周期与读写责任。账本是 `max_loop` / `mismatch_loop` 从「prose 约束」落到「客观信号」的载体。

类型与决策逻辑的**单一事实源**是 `constants/loop-ledger.ts`；CLI 为 `scripts/loop-ledger.ts`；运行时读写由 `hooks/loop-guard.mjs`（PreToolUse 拦截）与 `hooks/subagent-trace.mjs`（SubagentStop 计数）承担。阻断边界依据见 [ADR-0006](./decisions/ADR-0006-cross-host-hook-capability-baseline.md)。

## 文件路径

```
<repo-root>/.airules/runtime/loops/<change-id>.json
```

一个变更（change-id）一份账本。`.airules/runtime/` 不进版本库（运行时态，随任务产生与清理）。

## Schema

```jsonc
{
  "change_id": "feat-loop-guard-2026-06-29",     // 变更稳定标识
  "created_at": "2026-06-29T10:00:00+08:00",     // ISO 8601
  "loops": {                                      // 四条受计数回路（第 9 条）
    "test_debug_code":     { "iteration": 0, "max_loop": 3 },
    "review_code_quality": { "iteration": 0, "max_loop": 3 },
    "consist_code":        { "iteration": 0, "max_loop": 3 },
    "review_req_mismatch": { "iteration": 0, "max_loop": 2 }  // mismatch 外层，低于内层
  },
  "blocked_entries": [                            // blocked_id 跨阶段传播（O-02 消费契约）
    {
      "blocked_id": "bid-001",
      "source_stage": "planner",
      "reason": "需求事实源缺失：用户角色矩阵未提供",
      "affected_downstream": ["coder", "consistency-reviewer"],
      "unblock_condition": "用户补全角色矩阵",
      "status": "open",                           // open | resolved
      "created_at": "2026-06-29T10:30:00+08:00",
      "resolved_at": "2026-06-29T11:00:00+08:00"  // 可选，解除时填
    }
  ],
  "recent_dispatches": [                          // 派发轨迹（subagent-trace 追加）
    {
      "timestamp": "2026-06-29T10:35:00+08:00",
      "agent_id": "coder-instance-a1b2",
      "agent_type": "coder",
      "target_stage": "implement",
      "current_loop_id": "test_debug_code",       // 该派发归属的回路（主代理决定）
      "outcome": "success"                        // success | mismatch | blocked | pending
    }
  ]
}
```

## 回路标识

四条回路与 `rules/AGENTS.md` 第 9 条一一对应：

| loop_id | 含义 | 默认 max_loop |
|---|---|---|
| `test_debug_code` | Test→Debug→Code 内层回路 | 3 |
| `review_code_quality` | Review→Code（code_quality 分支） | 3 |
| `consist_code` | Consist→Code 内层回路（必须独立熔断，不依赖 Test 兜底） | 3 |
| `review_req_mismatch` | Review→Req（requirement_mismatch 外层） | 2 |

`mismatch_loop` 不另立字段——它即 `loops.review_req_mismatch`，统一为「回路计数」模型。

## 阻断决策（decideBlock）

`loop-guard` 在主代理派子代理**前**调用 `decideBlock(ledger, request)`，按优先级返回首个命中的客观信号（ADR-0006 三类，**不得**基于模型主观判断）：

1. **回路超限** `loop_exceeded`：`request.current_loop_id` 对应回路 `iteration >= max_loop`。
2. **blocked_id 命中** `blocked_id`：存在 `status == "open"` 的条目且 `request.target_stage` ∈ 其 `affected_downstream`。
3. **agent 身份重叠** `agent_overlap`：`request` 是 reviewer（`code-reviewer` / `consistency-reviewer`）且其 `agent_id` 与 `recent_dispatches` 中某 coder 派发的 `agent_id` 相同（违反 reviewer≠coder 红线）。

命中即 PreToolUse `exit 2`，阻断理由写 stderr。三者皆不命中则放行。

### 词表契约（target_stage ↔ affected_downstream 必须同一套词）

`decideBlock` 用**字符串相等**匹配 `request.target_stage` 与 `affected_downstream[]` 的元素。两侧必须由主代理用**同一套标识词**填充，否则匹配恒不命中、阻断静默失效。本协议钉死取 **agent_type**（子代理类型名）作为该标识：

- `affected_downstream` 填受阻的 agent_type，如 `["coder", "consistency-reviewer", "code-reviewer"]`；
- 主代理派发子代理时，`target_stage` 也填该子代理的 agent_type（如派 coder 时 `target_stage: "coder"`）。

> 注意：`recent_dispatches[].target_stage` 另记「流水线阶段」语义（如 `implement`/`review`），用于人工审计，**不参与** blocked_id 匹配——匹配只发生在 `decideBlock` 入参的 `request.target_stage`（=agent_type）与 `affected_downstream` 之间。主代理派发时须保证传给 hook 的 `tool_input.target_stage` 用 agent_type 词表。

## 计数推进（recordDispatch）

`subagent-trace` 在子代理 SubagentStop 时调用 `recordDispatch(ledger, dispatch)`：

- `recent_dispatches` 追加一条；
- 若 `dispatch.current_loop_id` 合法且 `outcome != "pending"`，对应回路 `iteration + 1`。

此脚本**恒 exit 0、永不阻断**（ADR-0005：Stop/SubagentStop 是记录非控制流）；回路归属由主代理通过 `current_loop_id` 决定，脚本忠实计数、不改写归属。

## 生命周期

| 阶段 | 动作 | 责任主体 |
|---|---|---|
| 变更开始 | 首次派发时 `createLedger` 落盘（或 CLI `reset` 预建） | 主代理 / 人工 |
| 子代理结束 | `subagent-trace` 追加 dispatch + 推进回路 | hook（运行时） |
| 派发前 | `loop-guard` 据 `decideBlock` 决定放行/阻断 | hook（运行时） |
| 阻塞解除 | 用户澄清后把 blocked 条目 `status` 改 `resolved`、填 `resolved_at` | 主代理 |
| 变更收口 | 账本随 `.airules/runtime/` 清理或 CLI `reset` | 人工 |

## CLI

```bash
tsx scripts/loop-ledger.ts list [repo-root]            # 列出账本及回路计数 / open blocked 数
tsx scripts/loop-ledger.ts validate [repo-root]        # 校验所有账本 schema，违规 exit 1
tsx scripts/loop-ledger.ts reset <change-id> [repo-root]  # 重置某账本为空（人工解锁后重来）
```

## 承认的限制

- PreToolUse 是 guardrail 非密闭 boundary（ADR-0006 第三段）：agent 可能经等价工具路径绕过，账本阻断**降低**违规概率、不构成密闭强制。prose 红线 + 主代理自律仍是第一道防线。
- Trae 无 SubagentStop，无法跨宿主一致投影计数；该宿主回路熔断 prose-only 兜底。
- 账本并发写由单文件原子重写兜底（hook 串行触发为主，竞争窗口小）。
