#!/usr/bin/env node
// AIRules 回路熔断 PreToolUse hook（跨宿主：Claude / Cursor / Codex / Qoder；Trae prose-only 不部署）。
//
// 主代理派子代理前由宿主调用，读进度账本 .airules/runtime/loops/<change-id>.json，按 ADR-0006 三类
// 客观信号决定是否阻断派发。命中即 exit 2（PreToolUse 阻断约定）+ stderr 写可回溯理由；否则放行 exit 0。
//
// schema 与决策逻辑单一事实源 constants/loop-ledger.ts（decideBlock）；本脚本运行在宿主侧、plain node
// 启动、无法 import TS，故内联等价 decideBlock，由 __test__/hook-contract.test.ts 对齐两边、防漂移。
//
// 阻断边界（ADR-0006，仅客观信号，不得基于模型主观判断）：
//   1. loop_exceeded：current_loop_id 对应回路 iteration >= max_loop
//   2. blocked_id：存在 open 条目且 target_stage ∈ affected_downstream
//   3. agent_overlap：reviewer 实例 agent_id 与近期 coder 派发同 agent_id（reviewer≠coder）
// 承认的限制：PreToolUse 是 guardrail 非密闭 boundary（可经等价工具绕过）；降低违规概率非密闭强制。
//
// 安全：账本读失败 / 无 change_id / 非子代理派发工具 → 放行（exit 0）。只在能明确读到客观信号时才阻断，
// 避免误伤正常工具调用（hook 拦的是 Task 类派发，不是所有工具）。

import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// ── 与 constants/loop-ledger.ts 对齐（契约测试断言一致）──
const LOOP_IDS = ['test_debug_code', 'review_code_quality', 'consist_code', 'review_req_mismatch']
const REVIEWER_AGENT_TYPES = ['code-reviewer', 'consistency-reviewer']
const CODER_AGENT_TYPES = ['coder']
// 仅对子代理派发类工具生效；其它工具调用一律放行（PreToolUse 会对所有工具触发）。
const DISPATCH_TOOL_NAMES = ['Task', 'task', 'dispatch_agent', 'run_subagent']

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  }
  catch {
    return ''
  }
}

function firstString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.length > 0) {
      return v
    }
  }
  return undefined
}

function isReviewer(t) {
  return typeof t === 'string' && REVIEWER_AGENT_TYPES.includes(t)
}
function isCoder(t) {
  return typeof t === 'string' && CODER_AGENT_TYPES.includes(t)
}

/** decideBlock 等价（constants/loop-ledger.ts）。返回 { blocked, signal, reason }。 */
function decideBlock(ledger, req) {
  // 1. 回路计数超限。
  if (LOOP_IDS.includes(req.current_loop_id)) {
    const c = ledger.loops && ledger.loops[req.current_loop_id]
    if (c && typeof c.iteration === 'number' && typeof c.max_loop === 'number' && c.iteration >= c.max_loop) {
      return { blocked: true, signal: 'loop_exceeded', reason: `回路 ${req.current_loop_id} 已达上限 ${c.max_loop}（当前 ${c.iteration}），转 BLOCKED 升级用户决策` }
    }
  }
  // 2. blocked_id 命中。
  if (req.target_stage && Array.isArray(ledger.blocked_entries)) {
    for (const e of ledger.blocked_entries) {
      if (e && e.status === 'open' && Array.isArray(e.affected_downstream) && e.affected_downstream.includes(req.target_stage)) {
        return { blocked: true, signal: 'blocked_id', reason: `下游阶段 ${req.target_stage} 受阻于 ${e.blocked_id}（${e.reason}）；解除条件：${e.unblock_condition}` }
      }
    }
  }
  // 3. agent 身份重叠。
  if (req.agent_id && isReviewer(req.agent_type) && Array.isArray(ledger.recent_dispatches)) {
    const overlap = ledger.recent_dispatches.find(d => d && d.agent_id === req.agent_id && isCoder(d.agent_type))
    if (overlap) {
      return { blocked: true, signal: 'agent_overlap', reason: `reviewer 实例 ${req.agent_id} 与既有 coder 派发同 agent_id，违反 reviewer≠coder 红线` }
    }
  }
  return { blocked: false }
}

function main() {
  let payload = {}
  try {
    const raw = readStdin().trim()
    if (raw.length > 0) {
      payload = JSON.parse(raw)
    }
  }
  catch {
    payload = {}
  }

  try {
    const toolName = firstString(payload.tool_name, payload.toolName)
    // 非子代理派发工具 → 放行（不拦普通工具调用）。
    if (toolName && !DISPATCH_TOOL_NAMES.includes(toolName)) {
      process.exit(0)
    }

    const ti = (payload.tool_input && typeof payload.tool_input === 'object') ? payload.tool_input : {}
    const changeId = firstString(payload.change_id, ti.change_id)
    const cwd = firstString(payload.cwd) ?? process.cwd()
    if (!changeId) {
      process.exit(0) // 无账本上下文 → 放行
    }

    const file = path.join(cwd, '.airules', 'runtime', 'loops', `${changeId}.json`)
    let ledger
    try {
      ledger = JSON.parse(readFileSync(file, 'utf8'))
    }
    catch {
      process.exit(0) // 账本不存在/损坏 → 放行（不误伤）
    }

    const req = {
      agent_id: firstString(ti.agent_id, payload.agent_id),
      agent_type: firstString(ti.subagent_type, ti.agent_type, payload.subagent_type, payload.agent_type),
      target_stage: firstString(ti.target_stage, payload.target_stage),
      current_loop_id: firstString(ti.current_loop_id, payload.current_loop_id),
    }

    const decision = decideBlock(ledger, req)
    if (decision.blocked) {
      // PreToolUse 阻断：stderr 写理由，exit 2。
      process.stderr.write(`[loop-guard] BLOCKED (${decision.signal}): ${decision.reason}\n`)
      process.exit(2)
    }
  }
  catch {
    // 决策过程异常 → 保守放行，不误伤正常派发。
    process.exit(0)
  }

  process.exit(0)
}

main()
