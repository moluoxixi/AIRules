---
name: cross-host-hook-capability-2026-06
description: 五宿主 hook 能力官方核验结论——Codex/Qoder/Trae 已远超"只列 Stop"，PreToolUse 普遍支持但仅 guardrail 非密闭 boundary
metadata:
  type: reference
  created_at: 2026-06-29
  status: active
review_status: pending
---

PENDING_REVIEW · 待人工审核转正

跨宿主 hook 能力官方文档核验（2026-06-29），推翻 ADR-0005 与两份 issue 报告"Codex/Trae/Qoder 只列 Stop"的过时前提。

| 宿主 | PreToolUse deny | SubagentStart/Stop | SessionStart |
|---|---|---|---|
| Claude Code | ✅ | ✅ | ✅ |
| Cursor | ✅ | ✅ (subagentStop) | ✅ |
| Codex CLI | ✅ | ✅ | ✅ |
| Qoder | ✅ | ✅ | ✅ |
| Trae | ✅ | ❌ 无 SubagentStop | ✅ |

**对进化闭环 roadmap 的影响**：
- 回路计数熔断（PreToolUse deny）的跨宿主前提五家全成立，不必降级 prose-only。
- reviewer≠coder 身份隔离依赖 SubagentStop，Trae 缺口 → 该家只能 prose 兜底。
- **硬限制**：Codex 官方明示 PreToolUse "guardrail rather than a complete enforcement boundary"，只拦 Bash/apply_patch/MCP，agent 可绕道等价工具。即"运行时 invariant"收益弱于第一份报告假设。
- **存量 bug**：Codex issue #27833，apply_patch 的 deny 实测未强制执行，落地须按版本实测。

**来源**：developers.openai.com/codex/hooks、docs.qoder.com/en/cli/hooks、docs.trae.cn/ide_hook-configuration-reference（均 2026-06-29 官方文档）。关联 [[memory-needs-review-like-skills]]——本条同样走候选+审核，不自动转正。
