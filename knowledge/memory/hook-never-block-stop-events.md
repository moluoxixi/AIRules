---
name: hook-never-block-stop-events
description: Stop 等完成类 hook 永不阻断对话，恒 exit 0——是设计立场非能力限制，翻案须先立 ADR
metadata:
  type: boundary
  created_at: 2026-06-29
  status: active
---

完成类 hook（当前分发的是 Stop；若未来重新引入其它完成事件也同理）**永不阻断对话**：脚本任何异常都 `exit 0`，绝不返回 `decision: block` / `permissionDecision: deny`。其语义是「完成时记录」，非控制流干预。

**Why**：此边界是设计立场、**与能力无关**——即便宿主技术上支持在完成事件阻断，也不松动。理由是完成事件的职责是观测/记录（如 session 索引），把控制流干预塞进完成事件会让"记录"与"拦截"职责混淆，且阻断时机已过。

**How to apply**：写或改 `hooks/session-log.mjs` 等完成类 hook 时，保持 `try/catch` 吞异常 + 恒 `exit 0` + stdout 打 `{}`。若未来有人想用完成事件强制重派子代理 / 阻断收尾，**必须先翻案立新 ADR**，不得直接在脚本里加 `exit 2`。
