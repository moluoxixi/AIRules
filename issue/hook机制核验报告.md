# Hook 机制与编排调整核验报告

> 项目：busyming-ai-rules
> 核验时间：2026-06-29
> 核验范围：上一轮（"必须自建 runtime"口径下）关于 hook 机制调整建议的三类关键断言

---

## 结论先行

上一轮主体方向成立，但有三处具体断言被事实推翻，需要在落地前修正。最大的隐藏风险**不是技术**，而是项目设计立场要先翻案——`host-hook-mapping.md:32` 与 `ADR-0005:26` 都是"永不阻断对话"的明示决策，落地 PreToolUse 阻断前必须先走 reflect + 新立 ADR。

---

## §1 已验证（PASS）

### 1.1 PreToolUse hook 退出非零能阻断工具调用 — PASS

- **Claude Code 官方**：`code.claude.com/docs/en/hooks` 表格写明 PreToolUse "Can block it"，`exit 2` 阻断；JSON 协议是 `{"hookSpecificOutput": {"permissionDecision": "deny"}}`。
- **Cursor 官方**：`cursor.com/docs/agent/hooks` 写 `preToolUse` 的 "Exit code 2 - Block the action (equivalent to returning permission: 'deny')"。
- 双宿主都支持。**P0-1 的技术前提成立**。

### 1.2 SubagentStop 事件存在 — PASS（仅 Claude / Cursor）

- **Claude Code 官方**：`SubagentStop` 在事件清单内，"When a subagent finishes"。
- **Cursor 官方**：`subagentStop` 在事件清单内，"Subagent lifecycle completion"。
- **P0-2 第一层（跨子代理身份隔离）的技术前提成立**。

### 1.3 仓库现状对扩展几乎零基础 — PASS

- 仓库全文 grep `PreToolUse / PostToolUse / SubagentStop / SessionStart / exit 2 / permissionDecision / hookSpecificOutput` **零命中**。
- `host-hook-mapping.md:32` 反向明示："**永不阻断对话**……不返回 `decision: block`（那会强制 agent 继续，非本能力意图）"。
- 这意味着 P0-1 / P0-2 不是"在已有底座上加事件"，而是**推翻现有设计立场后新建底座**。

---

## §2 被推翻（FAIL，需要修正上一轮表述）

### 2.1 "用 session_id / parent_session_id 关联 coder / reviewer" — FAIL

- **实际**：Claude Code 公开字段是 `agent_id`（"Present only when the hook fires inside a subagent call. Use this to distinguish subagent hook calls from main-thread calls"）+ `agent_type`，**不是** `parent_session_id`（该字段在可见文档中未出现）。Cursor 用 `conversation_id` 跨主子代理共享，子代理识别走 subagentStart / Stop 事件 trace。
- **修正**：P0-2 第一层的实现应当是——`SubagentStart` hook 记录 `{agent_id, agent_type, conversation_id, timestamp}` 到 trace 文件；`PreToolUse` hook 在主代理调用 Agent / Task 工具时（即将派发 code-reviewer）查 trace，若同 `conversation_id` 内最近一次 `agent_type=coder` 子代理刚结束且即将派发同实例评审，则阻断。**字段名是 `agent_id` 不是 `parent_session_id`**，机制方向不变。

### 2.2 "hook 是 shell 脚本无法调模型，所以 capture/distill/reflect 不能挂 hook" — FAIL

- **实际**：Claude Code 官方明确支持 5 种 hook handler 类型——`command`（shell）、`http`、`mcp_tool`、`prompt`、`agent`。原文 "Hooks are user-defined shell commands, HTTP endpoints, or LLM prompts that execute automatically"。prompt / agent 类型可以调模型。
- **修正**：上一轮"ADR-0005 拒绝得过早但理由是对的"——理由其实**也是错的**。但跨宿主兼容性仍要按"最小公约数"设计（不是所有宿主都支持 prompt / agent hook），AIRules 仍应坚持只用 command 类型 hook。若未来要让 ADR-0005 重新评估"是否自动跑 capture"，**论据要换**——不能再用"hook 无法调模型"，应改用"破坏候选 + 人工审核语义"+"跨宿主兼容性"两条仍然成立的理由。

### 2.3 "现有 session-log.mjs 字段够支撑扩展" — FAIL

- **实际**：`session-log.mjs` 只读 4 个字段（`cwd / session_id|conversation_id / transcript_path / hook_event_name`），**完全没读** `tool_name / tool_input / agent_id / agent_type / subagent_id`。
- **修正**：P0-1 / P0-2 / P1-2 落地需要**新增三个独立脚本**（`loop-guard.mjs` / `subagent-trace.mjs` / `session-trace.mjs`），不是改 session-log.mjs。P1-3 工作量从"扩 schema + 改 install.ts"扩大到"扩 schema + 改 install.ts + 写 3 个新脚本 + 同步测试"。

---

## §3 仍未确定（MISSING，需要后续核验）

### 3.1 Codex CLI / Trae / Qoder 是否支持 PreToolUse + SubagentStop

- 仓库 ADR-0005 列表里这三家都**只列 Stop**。
- 没有它们的官方 hook 文档可查（不在已知 URL）。
- **影响**：如果某宿主不支持 PreToolUse，P0-1 在该宿主上只能降级为 prose-only。不影响 Claude Code / Cursor 用户，但影响 P1-3 跨宿主投影的承诺面。
- **建议**：P1-3 立项前必须先做一次"五宿主能力调研"，落地为 ADR-0006。

### 3.2 SubagentStop 完整 input schema

- Claude Code 文档可见部分**没有** SubagentStop 的完整 input schema 示例。
- **影响**：P0-2 第一层实现要依赖 `agent_id` 字段，落地前需要实测一次（写最小脚本 dump payload）。

---

## §4 上一轮判断的最终订正版

| 上一轮断言 | 订正后 |
|---|---|
| P0-1 PreToolUse 拦截超 max_loop 派发 | **保留**，技术前提成立 |
| P0-2 第一层用 hook 隔离 reviewer ≠ coder | **保留但订正字段名**：用 `agent_id` 关联，需要 SubagentStart + PreToolUse 两个事件配合 |
| P0-2 第二层（同会话角色切换）需要自建 runtime | **保留**，AIRules 应接受 prose-only 兜底 |
| P1-2 Stop hook 升级为 trace 落盘 | **保留** |
| P1-3 扩 hosts.ts 投影 | **保留但工作量上调**：还要写 3 个新脚本，且必须先做 ADR-0006 跨宿主调研 |
| 自动度量是唯一必须自建 runtime 的事 | **保留**，仍建议不做 |
| **新增**：ADR-0005 需要先 reflect | **新增**：`host-hook-mapping.md:32` 的"永不阻断"是项目设计立场而非技术约束，P0-1 / P0-2 落地前必须先用 reflect skill 把这条立场推翻并新立 ADR-0006，否则 hook 阻断与现有 ADR 直接冲突 |

---

## §5 关键风险提醒：立场先翻案

最大隐藏风险不是技术——是**项目设计立场要先翻案**。

`host-hook-mapping.md:32` 与 `ADR-0005:26` 都是"永不阻断"的明示决策。如果不先走 reflect 流程把这条决策推翻，落地 P0-1 的 PreToolUse 阻断脚本会和现有 ADR 直接冲突，未来评审会被一致性检查拦下来。

按 AIRules 的资产层级判定，这是 repo-maintenance 层的设计决策变更，应该走：

1. **用 reflect skill 归因**——为什么当时决策"永不阻断"？根因是"hook 无法调模型"（已被 §2.2 推翻）+"会强制 agent 继续"（仍部分成立）。
2. **立新 ADR-0006**，明确："Stop hook 仍永不阻断（只记录），PreToolUse hook 允许在客观信号层面阻断（仅回路计数 / blocked_id / agent 身份重叠三类硬条件）"。
3. **然后才能进入 P1-3 / P0-1 / P0-2 的实施**。

---

## §6 推进顺序建议

按这个顺序最划算（全程不需要自建 runtime）：

1. **reflect + ADR-0006**：推翻"永不阻断"立场，明确新边界
2. **跨宿主能力调研**：实测 Codex / Trae / Qoder 是否支持 PreToolUse + SubagentStop
3. **P1-3 底座**：扩 hosts.ts schema（单 event → events 数组）+ 改 install.ts / verify.ts
4. **P0-1**：新增 `loop-guard.mjs` + 账本结构化升级 + PreToolUse 投影
5. **P0-2 第一层**：新增 `subagent-trace.mjs` + SubagentStart 投影 + 在 loop-guard 里加身份核对
6. **P1-2**：新增 `session-trace.mjs`（不替代 session-log.mjs，并存）
7. **P0-2 第二层 prose 兜底**：在 `rules/AGENTS.md:101` 补"该约束依赖主代理实际派发子代理"事实陈述
8. **收口**：P1-1（check #9 文案）/ P2-1（issue README 与 DONE-TODO 合并）/ P2-2（hook 行为端到端测试）

---

## §7 不确定项（诚实陈述）

- §3 两条 MISSING 没有进一步核（避免无意义的网页猜测）。落地需派人实测三家宿主的 hook payload。
- 没有读 ADR-0005 的完整背景讨论（只读了行号 13-26 与 35-36），可能有未看到的设计约束。落地前应完整重读 ADR-0005 全文。
- "是否仍建议不做自动度量"基于"AIRules 是宿主无关 prompt 工程项目"的定位判断。若项目定位要变（比如绑定到 Qoder 作为内置规则集），结论可能要重判。
