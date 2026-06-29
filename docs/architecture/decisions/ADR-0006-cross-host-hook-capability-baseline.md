# ADR-0006 跨宿主 hook 能力基线与阻断边界

## 状态

proposed

> 状态说明：本 ADR 的**第一段「能力基线」是已核验的事实**，立场中性，用于修正 ADR-0005 的作废论据。但**第二段「阻断边界」（PreToolUse 允许在客观信号层阻断）是对 ADR-0005 / host-hook-mapping「永不阻断」立场的部分翻案，属 repo-maintenance 层设计决策变更，需仓库维护者明确批准后方可生效**。在批准前本 ADR 保持 `proposed`：能力基线可作背景引用，但任何 PreToolUse 阻断实现不得以"ADR-0006 已批准"为依据。批准后改为 `accepted`。

## 背景

ADR-0005 落地"会话自动记录 Stop hook 多宿主投影"时，基于两条当时未充分核验的前提：

1. **"hook 是 shell 脚本、无法调用模型"**（ADR-0005 替代方案段）——作为拒绝"hook 触发 LLM 摘要"的论据。
2. **"只有 Stop hook 是多宿主通用能力"**——`host-hook-mapping.md` 与 ADR-0005 投影模型只覆盖 Stop/stop 单事件，6 宿主全部固定为完成事件。

`host-hook-mapping.md` 与 ADR-0005 同时确立了一条设计红线：**"永不阻断对话"**——脚本任何异常都 exit 0，不返回 `decision: block`。该红线当时混合了两个不同性质的依据：一是"Stop hook 的语义是记录而非控制流"（**仍成立**），二是上述前提 1/2（**已被证伪**）。

2026-06-29 跨宿主能力调研（官方文档逐一核验）推翻了前提 1 与前提 2，需要把"能力事实"与"设计立场"分离，重新记录基线。

## 决策

### 一、能力基线（事实层，官方文档核验 2026-06-29）

| 宿主 | PreToolUse 阻断 | SubagentStart/Stop | SessionStart | 阻断机制 |
|---|---|---|---|---|
| Claude Code | ✅ | ✅ | ✅ | `permissionDecision:deny` / exit 2 |
| Cursor | ✅ | ✅（subagentStop） | ✅ | `permission:deny` / exit 2 |
| Codex CLI | ✅ | ✅ | ✅ | `hookSpecificOutput.permissionDecision:deny` / 旧 `decision:block` / exit 2 |
| Qoder | ✅ | ✅ | ✅ | `hookSpecificOutput.permissionDecision:deny/ask` / exit 2 |
| Trae | ✅ | ❌ **无 SubagentStop** | ✅ | `permissionDecision:deny` / exit 2 |

两条修正：

- **前提 1 证伪**：Claude Code / Codex 官方支持 `prompt` / `agent` 类型 hook handler，可调用模型；即便坚持只用 `command` 类型（跨宿主最小公约数），能力也远超"只能 shell"。
- **前提 2 证伪**：PreToolUse 为**五宿主普遍能力**；SubagentStart/Stop 为四宿主能力（Trae 缺）；SessionStart 为五宿主能力。ADR-0005"只有 Stop 通用"的前提作废。

### 二、阻断边界（立场层）

把 ADR-0005 混合的红线拆成按事件分级的明确边界：

- **Stop / SubagentStop hook：仍永不阻断**。其语义是"按轮/子代理完成时记录"，非控制流干预；保持异常 exit 0、不返回 block。此边界**与能力无关**，是设计立场，不因"技术上能阻断"而松动。
- **PreToolUse hook：允许在客观信号层阻断**，且**仅限**以下硬条件——
  1. 回路计数超 `max_loop` / `mismatch_loop`（客观计数）；
  2. `blocked_id` 处于 open 且当前派发命中其 `affected_downstream`（客观账本状态）；
  3. agent 身份重叠（reviewer 实例 == coder 实例，客观 `agent_id` 比对）。
  阻断理由必须可回溯到上述客观信号之一，**不得**基于模型主观判断阻断。

### 三、承认的能力限制（不可绕过的事实，落地必读）

- **PreToolUse 是 guardrail 而非密闭 boundary**：Codex 官方明示其只拦 Bash / apply_patch / MCP 工具调用，agent 可能经等价工具路径绕过。故 PreToolUse 阻断**降低**违规概率，**不构成**密闭强制——prose 红线 + 主代理遵从仍是第一道防线，hook 是补充非替代。
- **存量 bug**：Codex issue #27833 报告 apply_patch 的 deny 实测未被强制执行。任何 PreToolUse 投影落地前必须按宿主版本实测 payload 与 deny 生效性。
- **Trae 缺 SubagentStop**：依赖子代理生命周期的能力（reviewer≠coder 身份隔离）在 Trae 上只能 prose-only 兜底，不能跨宿主一致投影。

## 影响

- **本 ADR 只确立基线与边界，不实现任何阻断 hook**。`loop-guard` / `subagent-trace` 等 PreToolUse 投影是后续独立变更，立项时各自走需求/计划/评审，并先按"承认的能力限制"做宿主版本实测。
- 修正 ADR-0005 替代方案段的作废论据（已留痕，结论不变）。
- `host-hook-mapping.md` 的"永不阻断"红线需后续标注其适用范围为 Stop/SubagentStop（PreToolUse 不在此约束内）——属后续变更，本 ADR 不动其它文件。
- `constants/hosts.ts` 的 `HookProjection` 若要支持多事件，需从单 `event` 扩为 events 数组——后续变更，非本 ADR 范围。

## 替代方案

- **维持 ADR-0005 原状、不立新 ADR**：会让已证伪的论据继续作为决策前提流传，未来基于错前提决策；且"永不阻断"红线继续混合事实与立场，无法区分"Stop 不该阻断"（立场）与"hook 不能阻断"（错误事实）。
- **直接翻案为"允许任意 hook 阻断"**：过度——Stop/SubagentStop 阻断无正当语义，且会把"模型主观判断"引入控制流，违背"仅客观信号阻断"原则。
