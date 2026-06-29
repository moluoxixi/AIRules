---
name: hook-never-block-stop-events
description: Stop / SubagentStop hook 永不阻断对话，恒 exit 0——是设计立场非能力限制，翻案须先立 ADR
metadata:
  type: boundary
  created_at: 2026-06-29
  status: active
---

完成类 hook（Stop / SubagentStop）**永不阻断对话**：脚本任何异常都 `exit 0`，绝不返回 `decision: block` / `permissionDecision: deny`。其语义是「按轮/子代理完成时记录」，非控制流干预。

**Why**：此边界是设计立场、**与能力无关**——即便宿主技术上支持在 SubagentStop 阻断，也不松动。理由是完成事件的职责是观测/记录（如 [[hook-ledger]] 计数、session 索引），把控制流干预塞进完成事件会让"记录"与"拦截"职责混淆，且阻断时机已过（子代理已结束）。来源：ADR-0005 + [host-hook-mapping.md](../../docs/architecture/host-hook-mapping.md) 跨宿主行为红线段。

**How to apply**：写或改 `hooks/subagent-trace.mjs`、`hooks/session-log.mjs` 等完成类 hook 时，保持 `try/catch` 吞异常 + 恒 `exit 0` + stdout 打 `{}`。若未来有人想用 SubagentStop 强制重派子代理 / 阻断收尾，**必须先翻案立新 ADR**，不得直接在脚本里加 `exit 2`。PreToolUse 是另一回事，其阻断边界见 [[pretooluse-block-only-three-signals]]。
