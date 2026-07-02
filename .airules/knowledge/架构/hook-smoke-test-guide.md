# Hook 现网烟测指引（loop-guard / subagent-trace）

本文件是 PreToolUse 熔断 hook 与 SubagentStop 计数 hook 的**真宿主验证**步骤。离线单元测试（`__test__/hook-contract.test.ts`）已覆盖三类拦截路径、跨宿主字段名兼容（snake_case + camelCase）与计数累积熔断；但 hook 的最终生效性依赖各宿主真实 payload 字段名与 deny 解释方式，**必须在真宿主跑过一次才算闭环**（[ADR-0006](decisions/ADR-0006-cross-host-hook-capability-baseline.md) 第三段要求落地前按宿主版本实测）。

> 状态：离线 Phase 1 已自动化（CI 跑）；Phase 2/3 真宿主跑需人工执行，结果回填本文件「烟测记录」表。在 Phase 2 过线前，不宣称「runtime enforcement 已生效」。

## 为什么离线测试不够

hook 在宿主侧以 plain `node` 启动，读 stdin 的 JSON payload。离线测试用我们**自构造**的 payload，但真宿主的字段名可能与假设不符：

- **字段名差异**：Claude/Codex/Qoder 多为 `snake_case` + `tool_input`；Cursor 用 `camelCase`（`toolInput`/`toolName`/`subagentType`）。hook 已用 `pickField` 双命名兜底，但**真宿主到底用哪个键名只能现场确认**。取不到 `change_id` 时 hook 走「放行」分支——熔断静默失效，表面无报错。
- **deny 解释方式**：各宿主对 PreToolUse `exit 2` / `permissionDecision: deny` 的处理不同；Codex 有已知 deny 未强制执行的存量 bug（issue #27833）。
- **Cursor failClosed**：Cursor 的 `failClosed: true` 模式下 hook 崩溃会反向触发拦截，需确认 `exit 0` 兜底被正确解释。

## Phase 1 · 离线模拟（已自动化）

```bash
npx vitest run __test__/hook-contract.test.ts
```

覆盖：三类拦截（loop_exceeded / blocked_id / agent_overlap）exit 2、subagent-trace 三种 outcome 写账本、camelCase 信封兼容、字段名取不到时 fail-open 行为固化。**这是回归基线，改 hook 后必跑。**

## Phase 2 · 单宿主真跑（Claude Code，人工）

目标：在真 Claude Code 验证一次完整的「派发 → 计数 → 熔断」闭环。

1. 选一个测试项目，`cd` 进去。手动建一个上限为 1 的账本便于快速触顶：
   ```bash
   npm run loop:ledger reset smoke-claude <测试项目绝对路径>
   # 然后手动把 .airules/runtime/loops/smoke-claude.json 的 test_debug_code.max_loop 改为 1
   ```
2. 确认 `~/.claude/settings.json` 已投影三事件 hook（`npm run sync` 后）：
   ```bash
   # 应能看到 PreToolUse / SubagentStop / Stop 三个事件各有指向 hooks/ 下脚本的受管条目
   ```
3. 在 Claude Code 发起一个会派发同类子代理两次的任务，主代理派发时须在 `tool_input` 注入 `change_id: "smoke-claude"`、`current_loop_id: "test_debug_code"`、`target_stage`、`agent_id`、`subagent_type`。
4. **验证点**：
   - [ ] 第 1 次子代理结束后，账本 `loops.test_debug_code.iteration` 变为 1（subagent-trace 生效）。
   - [ ] 第 2 次派发前 PreToolUse hook 触发，工具调用被 `exit 2` 拦截。
   - [ ] Claude Code 的错误反馈中出现 `[loop-guard] BLOCKED (loop_exceeded)` stderr 文案。
   - [ ] `recent_dispatches` 正确记录派发轨迹。
5. **若熔断未触发**：极可能是 payload 字段名与 `pickField` 候选不符。打印一次真实 payload（临时在脚本头加 `appendFileSync('/tmp/hook-payload.log', readStdin())`）核对实际键名，再回填 `pickField` 候选或修正主代理注入逻辑。

## Phase 3 · 多宿主烟测（按需，人工）

Cursor / Codex / Qoder 各重复 Phase 2 验证点，重点确认字段名兼容。Qoder 若在 IDE 版本里仍无法触发全局规则/skills 或 SubagentStop，记录为上游缺口，不在 AIRules 中拆 `qoder-cli` 合同。Trae 验证 prose-only 兜底（不部署 hook，仅靠主代理读 `rules/AGENTS.md` 自律）。

- **Codex**：额外验证 `exit 2` 是否真被强制（issue #27833）。若 deny 未生效，记录为该宿主已知限制，prose 兜底。
- **Cursor**：验证 `failClosed` 模式下 hook 正常 `exit 0` 不误触发拦截。

## 烟测记录

| 日期 | 宿主 | 版本 | Phase | 结果 | 备注 |
|---|---|---|---|---|---|
| _待填_ | Claude Code | | 2 | _未跑_ | |
| _待填_ | Cursor | | 3 | _未跑_ | |
| _待填_ | Codex | | 3 | _未跑_ | deny bug #27833 待验 |
| _待填_ | Qoder | | 3 | _未跑_ | 验 Stop + SubagentStop + PreToolUse；IDE 缺口按上游 bug 记录 |
