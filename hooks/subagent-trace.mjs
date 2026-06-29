#!/usr/bin/env node
// AIRules 回路计数 SubagentStop hook（跨宿主：Claude / Cursor / Codex / Qoder；Trae 缺 SubagentStop 不部署）。
//
// 子代理结束时由宿主调用，往进度账本 .airules/runtime/loops/<change-id>.json 追加一条派发记录并
// 推进对应回路计数，作为 loop-guard.mjs 的数据源。schema 与等价决策逻辑的单一事实源是
// constants/loop-ledger.ts；本脚本运行在宿主侧、以 plain node 启动、无法 import TS，故内联等价逻辑，
// 由 __test__/hook-contract.test.ts 对齐两边、防漂移。
//
// 设计红线（ADR-0005「Stop/SubagentStop 永不阻断对话」）：
// - 恒 exit 0，任何异常吞掉，绝不返回 decision:block。
// - stdout 必须合法 JSON（Codex/Cursor 要求），统一打 {}。
// - transcript 路径只记不读正文（隐私边界，与 session-log 一致）。
// - 字段依赖主代理派发时注入（change_id / current_loop_id / outcome / agent_type 等）；缺 change_id
//   则无账本可写，直接跳过（不猜测、不新建无主账本）。

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// ── 与 constants/loop-ledger.ts 对齐的常量（契约测试断言一致）──
const LOOP_IDS = ['test_debug_code', 'review_code_quality', 'consist_code', 'review_req_mismatch']
const DEFAULT_MAX_LOOP = { test_debug_code: 3, review_code_quality: 3, consist_code: 3, review_req_mismatch: 2 }
const DISPATCH_OUTCOMES = ['success', 'mismatch', 'blocked', 'pending']

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

/** 构造空账本（与 constants/loop-ledger.ts createLedger 等价）。 */
function createLedger(changeId, now) {
  const loops = {}
  for (const id of LOOP_IDS) {
    loops[id] = { iteration: 0, max_loop: DEFAULT_MAX_LOOP[id] }
  }
  return { change_id: changeId, created_at: now, loops, blocked_entries: [], recent_dispatches: [] }
}

/** 读账本；不存在或损坏则返回新空账本（subagent-trace 永不因 I/O 失败阻断）。 */
function loadLedger(file, changeId, now) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.loops && Array.isArray(parsed.recent_dispatches)) {
      // 防御：旧账本/手改账本可能缺 blocked_entries，补默认空数组避免后续 .some 抛错丢 dispatch。
      if (!Array.isArray(parsed.blocked_entries)) {
        parsed.blocked_entries = []
      }
      return parsed
    }
  }
  catch {
    // 落到新建
  }
  return createLedger(changeId, now)
}

/** 原子写：写 .tmp 再 rename，降低并发写损坏概率。 */
function atomicWrite(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, data, 'utf8')
  renameSync(tmp, file)
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
    // 字段兜底：主代理派发时把这些塞进 tool_input，SubagentStop 时回传到顶层或 tool_input。
    const ti = (payload.tool_input && typeof payload.tool_input === 'object') ? payload.tool_input : {}
    const changeId = firstString(payload.change_id, ti.change_id)
    // 无 change_id 无账本可写——直接跳过（不新建无主账本）。
    if (!changeId) {
      throw new Error('no change_id')
    }
    const cwd = firstString(payload.cwd) ?? process.cwd()
    const agentId = firstString(payload.agent_id, ti.agent_id) ?? '(unknown)'
    const agentType = firstString(payload.agent_type, payload.subagent_type, ti.subagent_type, ti.agent_type) ?? '(unknown)'
    const targetStage = firstString(payload.target_stage, ti.target_stage) ?? '(unknown)'
    const loopIdRaw = firstString(payload.current_loop_id, ti.current_loop_id)
    const currentLoopId = LOOP_IDS.includes(loopIdRaw) ? loopIdRaw : null
    const outcomeRaw = firstString(payload.outcome, ti.outcome)
    const outcome = DISPATCH_OUTCOMES.includes(outcomeRaw) ? outcomeRaw : 'pending'

    const now = new Date().toISOString()
    const runtimeDir = path.join(cwd, '.airules', 'runtime')
    const dir = path.join(runtimeDir, 'loops')
    mkdirSync(dir, { recursive: true })
    // 首次建 runtime 目录时落 .gitignore：账本是运行时态，默认不入库（与 session-log 自动日志同策略）。
    const gitignore = path.join(runtimeDir, '.gitignore')
    if (!existsSync(gitignore)) {
      writeFileSync(gitignore, '# AIRules 运行时账本，默认不入库\n*\n', 'utf8')
    }
    const file = path.join(dir, `${changeId}.json`)
    const ledger = loadLedger(file, changeId, now)

    // recordDispatch 等价：追加 dispatch + 非 pending 推进回路。
    ledger.recent_dispatches.push({
      timestamp: now,
      agent_id: agentId,
      agent_type: agentType,
      target_stage: targetStage,
      current_loop_id: currentLoopId,
      outcome,
    })
    if (currentLoopId && outcome !== 'pending' && ledger.loops[currentLoopId]) {
      ledger.loops[currentLoopId].iteration += 1
    }

    // blocked_id 注入（可选）：主代理标 MISSING/BLOCKED 时塞入，写一条 open 条目。
    const blockedId = firstString(payload.blocked_id, ti.blocked_id)
    if (blockedId && !ledger.blocked_entries.some(e => e.blocked_id === blockedId)) {
      const affected = Array.isArray(ti.affected_downstream) ? ti.affected_downstream : (Array.isArray(payload.affected_downstream) ? payload.affected_downstream : [])
      ledger.blocked_entries.push({
        blocked_id: blockedId,
        source_stage: firstString(payload.source_stage, ti.source_stage) ?? targetStage,
        reason: firstString(payload.reason, ti.reason) ?? '(unspecified)',
        affected_downstream: affected.filter(s => typeof s === 'string'),
        unblock_condition: firstString(payload.unblock_condition, ti.unblock_condition) ?? '(unspecified)',
        status: 'open',
        created_at: now,
      })
    }

    atomicWrite(file, `${JSON.stringify(ledger, null, 2)}\n`)
  }
  catch {
    // 任何异常都不阻断（ADR-0005）。
  }

  try {
    process.stdout.write('{}')
  }
  catch {
    // 忽略 stdout 写失败。
  }
  process.exit(0)
}

main()
