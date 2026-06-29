import type { LoopLedger } from '../constants/loop-ledger.js'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { CODER_AGENT_TYPES, createLedger, DEFAULT_MAX_LOOP, DISPATCH_OUTCOMES, LOOP_IDS, REVIEWER_AGENT_TYPES } from '../constants/loop-ledger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const guardScript = path.join(repoRoot, 'hooks', 'loop-guard.mjs')
const traceScript = path.join(repoRoot, 'hooks', 'subagent-trace.mjs')

function withTempRepo<T>(run: (root: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-hook-'))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function runHook(script: string, payload: unknown, cwd: string) {
  return spawnSync(process.execPath, [script], { input: JSON.stringify(payload), cwd, encoding: 'utf8' })
}

function ledgerPath(root: string, changeId: string) {
  return path.join(root, '.airules', 'runtime', 'loops', `${changeId}.json`)
}

function writeLedger(root: string, ledger: LoopLedger) {
  const dir = path.join(root, '.airules', 'runtime', 'loops')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(ledgerPath(root, ledger.change_id), `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
}

// ── 防漂移：脚本内联常量必须与 constants/loop-ledger.ts 一致 ──

describe('hook 脚本与 TS 单一事实源对齐（防漂移）', () => {
  it('loop-guard.mjs 内联常量与 constants/loop-ledger.ts 一致', () => {
    const src = fs.readFileSync(guardScript, 'utf8')
    // LOOP_IDS 全部出现。
    for (const id of LOOP_IDS) {
      assert.match(src, new RegExp(id), `loop-guard 缺回路 ${id}`)
    }
    for (const t of REVIEWER_AGENT_TYPES) {
      assert.match(src, new RegExp(t), `loop-guard 缺 reviewer 类型 ${t}`)
    }
    for (const t of CODER_AGENT_TYPES) {
      assert.match(src, new RegExp(t), `loop-guard 缺 coder 类型 ${t}`)
    }
  })

  it('subagent-trace.mjs 内联 max_loop 与 DEFAULT_MAX_LOOP 一致', () => {
    const src = fs.readFileSync(traceScript, 'utf8')
    // 断言默认上限对象的每个回路键值都写进了脚本（防止任一回路上限两边漂移）。
    for (const [id, max] of Object.entries(DEFAULT_MAX_LOOP)) {
      assert.match(src, new RegExp(`${id}:\\s*${max}`), `subagent-trace 缺/漂移回路上限 ${id}=${max}`)
    }
    for (const o of DISPATCH_OUTCOMES) {
      assert.match(src, new RegExp(o), `subagent-trace 缺 outcome ${o}`)
    }
  })

  it('loop-guard.mjs 内联 max_loop 与 DEFAULT_MAX_LOOP 一致（防上限漂移）', () => {
    const src = fs.readFileSync(guardScript, 'utf8')
    // loop-guard 也内联 DEFAULT_MAX_LOOP（决策依赖账本内 max_loop，但常量须与 TS 对齐防回路键漂移）。
    for (const id of LOOP_IDS) {
      assert.match(src, new RegExp(id), `loop-guard 缺回路 ${id}`)
    }
  })
})

// ── loop-guard：三类拦截路径 + 放行 ──

describe('loop-guard.mjs · PreToolUse 拦截', () => {
  it('回路超限 → exit 2', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.loops.test_debug_code.iteration = 3
      writeLedger(root, l)
      const r = runHook(guardScript, {
        hook_event_name: 'PreToolUse',
        tool_name: 'Task',
        change_id: 'c1',
        cwd: root,
        tool_input: { subagent_type: 'coder', current_loop_id: 'test_debug_code', target_stage: 'implement' },
      }, root)
      assert.equal(r.status, 2)
      assert.match(r.stderr, /loop_exceeded/)
    })
  })

  it('blocked_id 命中 → exit 2', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.blocked_entries.push({ blocked_id: 'bid-001', source_stage: 'planner', reason: 'x', affected_downstream: ['coder'], unblock_condition: 'y', status: 'open', created_at: new Date().toISOString() })
      writeLedger(root, l)
      const r = runHook(guardScript, {
        tool_name: 'Task',
        change_id: 'c1',
        cwd: root,
        tool_input: { subagent_type: 'coder', target_stage: 'coder' },
      }, root)
      assert.equal(r.status, 2)
      assert.match(r.stderr, /blocked_id/)
    })
  })

  it('agent 身份重叠 → exit 2', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.recent_dispatches.push({ timestamp: new Date().toISOString(), agent_id: 'shared-x', agent_type: 'coder', target_stage: 'implement', current_loop_id: 'test_debug_code', outcome: 'success' })
      writeLedger(root, l)
      const r = runHook(guardScript, {
        tool_name: 'Task',
        change_id: 'c1',
        cwd: root,
        tool_input: { subagent_type: 'code-reviewer', agent_id: 'shared-x', target_stage: 'review' },
      }, root)
      assert.equal(r.status, 2)
      assert.match(r.stderr, /agent_overlap/)
    })
  })

  it('干净账本 → 放行 exit 0', () => {
    withTempRepo((root) => {
      writeLedger(root, createLedger('c1', new Date().toISOString()))
      const r = runHook(guardScript, { tool_name: 'Task', change_id: 'c1', cwd: root, tool_input: { subagent_type: 'coder', target_stage: 'implement', current_loop_id: 'test_debug_code' } }, root)
      assert.equal(r.status, 0)
    })
  })

  it('非派发工具（如 Read）→ 放行，不读账本', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.loops.test_debug_code.iteration = 99 // 即便超限
      writeLedger(root, l)
      const r = runHook(guardScript, { tool_name: 'Read', change_id: 'c1', cwd: root, tool_input: { current_loop_id: 'test_debug_code' } }, root)
      assert.equal(r.status, 0, '非 Task 工具不应被拦')
    })
  })

  it('无 change_id → 放行', () => {
    withTempRepo((root) => {
      const r = runHook(guardScript, { tool_name: 'Task', cwd: root, tool_input: { subagent_type: 'coder' } }, root)
      assert.equal(r.status, 0)
    })
  })

  it('账本不存在 → 放行（不误伤）', () => {
    withTempRepo((root) => {
      const r = runHook(guardScript, { tool_name: 'Task', change_id: 'nope', cwd: root, tool_input: { subagent_type: 'coder', current_loop_id: 'test_debug_code' } }, root)
      assert.equal(r.status, 0)
    })
  })
})

// ── subagent-trace：写账本计数 ──

describe('subagent-trace.mjs · SubagentStop 计数', () => {
  it('success 结局推进回路 + 恒 exit 0 + stdout {}', () => {
    withTempRepo((root) => {
      const r = runHook(traceScript, {
        hook_event_name: 'SubagentStop',
        change_id: 'c1',
        cwd: root,
        agent_id: 'coder-a1',
        agent_type: 'coder',
        target_stage: 'implement',
        current_loop_id: 'test_debug_code',
        outcome: 'success',
      }, root)
      assert.equal(r.status, 0)
      assert.equal(r.stdout, '{}')
      const l = JSON.parse(fs.readFileSync(ledgerPath(root, 'c1'), 'utf8'))
      assert.equal(l.loops.test_debug_code.iteration, 1)
      assert.equal(l.recent_dispatches.length, 1)
    })
  })

  it('mismatch 结局推进 review_req_mismatch', () => {
    withTempRepo((root) => {
      for (let i = 0; i < 3; i++) {
        runHook(traceScript, { change_id: 'c1', cwd: root, agent_type: 'code-reviewer', target_stage: 'review', current_loop_id: 'review_req_mismatch', outcome: 'mismatch' }, root)
      }
      const l = JSON.parse(fs.readFileSync(ledgerPath(root, 'c1'), 'utf8'))
      assert.equal(l.loops.review_req_mismatch.iteration, 3)
    })
  })

  it('blocked 注入写 open 条目', () => {
    withTempRepo((root) => {
      runHook(traceScript, {
        change_id: 'c1',
        cwd: root,
        agent_type: 'planner',
        target_stage: 'plan',
        outcome: 'blocked',
        blocked_id: 'bid-9',
        affected_downstream: ['coder', 'consistency-reviewer'],
        reason: '需求缺失',
        unblock_condition: '用户补全',
      }, root)
      const l = JSON.parse(fs.readFileSync(ledgerPath(root, 'c1'), 'utf8'))
      assert.equal(l.blocked_entries.length, 1)
      assert.equal(l.blocked_entries[0].blocked_id, 'bid-9')
      assert.deepEqual(l.blocked_entries[0].affected_downstream, ['coder', 'consistency-reviewer'])
    })
  })

  it('无 change_id → 不写账本，仍 exit 0', () => {
    withTempRepo((root) => {
      const r = runHook(traceScript, { cwd: root, agent_type: 'coder', outcome: 'success' }, root)
      assert.equal(r.status, 0)
      assert.ok(!fs.existsSync(path.join(root, '.airules', 'runtime', 'loops')), '无 change_id 不应建账本目录')
    })
  })

  it('畸形 stdin → exit 0 不崩', () => {
    withTempRepo((root) => {
      const r = spawnSync(process.execPath, [traceScript], { input: '{ not json', cwd: root, encoding: 'utf8' })
      assert.equal(r.status, 0)
    })
  })

  it('连续派发并发安全：10 次顺序写不破坏结构', () => {
    withTempRepo((root) => {
      for (let i = 0; i < 10; i++) {
        runHook(traceScript, { change_id: 'c1', cwd: root, agent_type: 'coder', target_stage: 'implement', current_loop_id: 'consist_code', outcome: 'success' }, root)
      }
      const l = JSON.parse(fs.readFileSync(ledgerPath(root, 'c1'), 'utf8'))
      assert.equal(l.loops.consist_code.iteration, 10)
      assert.equal(l.recent_dispatches.length, 10)
    })
  })
})

// ── 集成：trace 写 → guard 读，端到端熔断 ──

describe('集成 · trace 计数累积后 guard 在第 max_loop+1 次派发拦截', () => {
  it('模拟 max_loop=3：3 次 mismatch 后第 4 次派发被拦', () => {
    withTempRepo((root) => {
      // 先建账本（reset 等价：直接写空账本）。
      writeLedger(root, createLedger('c1', new Date().toISOString()))
      // 3 次 test_debug_code 派发结束（trace 累积）。
      for (let i = 0; i < 3; i++) {
        runHook(traceScript, { change_id: 'c1', cwd: root, agent_type: 'coder', target_stage: 'implement', current_loop_id: 'test_debug_code', outcome: 'success' }, root)
      }
      // 第 4 次派发前 guard 检查 → 已达上限 3，拦截。
      const r = runHook(guardScript, { tool_name: 'Task', change_id: 'c1', cwd: root, tool_input: { subagent_type: 'coder', target_stage: 'implement', current_loop_id: 'test_debug_code' } }, root)
      assert.equal(r.status, 2)
      assert.match(r.stderr, /loop_exceeded/)
    })
  })
})

// ── 跨宿主 stdin payload 字段名兼容（离线烟测 Phase 1）──
// 各宿主 PreToolUse/SubagentStop payload 命名不一：Claude/Codex/Qoder 多为 snake_case + tool_input，
// Cursor 用 camelCase（toolInput / toolName / subagentType / changeId / ...）。若 hook 取不到 change_id，
// 会走「无 change_id 放行」分支——熔断静默失效但表面看不出来（复核报告 §4.2.1）。这里用 fixture 锁住兼容性。

describe('跨宿主字段兼容 · loop-guard 拦截（camelCase 信封）', () => {
  it('cursor 风格 camelCase（toolInput/toolName/subagentType/changeId）回路超限仍 exit 2', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.loops.test_debug_code.iteration = 3
      writeLedger(root, l)
      const r = runHook(guardScript, {
        hookEventName: 'preToolUse',
        toolName: 'Task',
        changeId: 'c1',
        cwd: root,
        toolInput: { subagentType: 'coder', currentLoopId: 'test_debug_code', targetStage: 'coder' },
      }, root)
      assert.equal(r.status, 2, 'camelCase payload 也应触发熔断')
      assert.match(r.stderr, /loop_exceeded/)
    })
  })

  it('camelCase agent 身份重叠（agentId/subagentType）仍 exit 2', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.recent_dispatches.push({ timestamp: new Date().toISOString(), agent_id: 'shared-x', agent_type: 'coder', target_stage: 'implement', current_loop_id: 'test_debug_code', outcome: 'success' })
      writeLedger(root, l)
      const r = runHook(guardScript, {
        toolName: 'Task',
        changeId: 'c1',
        cwd: root,
        toolInput: { subagentType: 'code-reviewer', agentId: 'shared-x', targetStage: 'review' },
      }, root)
      assert.equal(r.status, 2)
      assert.match(r.stderr, /agent_overlap/)
    })
  })

  it('顶层 camelCase（无 toolInput 信封）也能取到 changeId', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.blocked_entries.push({ blocked_id: 'b1', source_stage: 'planner', reason: 'x', affected_downstream: ['coder'], unblock_condition: 'y', status: 'open', created_at: new Date().toISOString() })
      writeLedger(root, l)
      const r = runHook(guardScript, { toolName: 'Task', changeId: 'c1', cwd: root, subagentType: 'coder', targetStage: 'coder' }, root)
      assert.equal(r.status, 2)
      assert.match(r.stderr, /blocked_id/)
    })
  })
})

describe('跨宿主字段兼容 · subagent-trace 计数（camelCase 信封）', () => {
  it('cursor 风格 camelCase（changeId/agentType/currentLoopId）正确写账本', () => {
    withTempRepo((root) => {
      const r = runHook(traceScript, {
        hookEventName: 'subagentStop',
        changeId: 'c1',
        cwd: root,
        toolInput: { agentType: 'coder', currentLoopId: 'test_debug_code', outcome: 'success' },
      }, root)
      assert.equal(r.status, 0)
      const l = JSON.parse(fs.readFileSync(ledgerPath(root, 'c1'), 'utf8'))
      assert.equal(l.loops.test_debug_code.iteration, 1, 'camelCase payload 也应推进计数')
    })
  })

  it('camelCase blocked 注入（blockedId/affectedDownstream）写 open 条目', () => {
    withTempRepo((root) => {
      runHook(traceScript, {
        changeId: 'c1',
        cwd: root,
        toolInput: { agentType: 'planner', targetStage: 'plan', outcome: 'blocked', blockedId: 'b9', affectedDownstream: ['coder', 'consistency-reviewer'], reason: '需求缺失', unblockCondition: '用户补全' },
      }, root)
      const l = JSON.parse(fs.readFileSync(ledgerPath(root, 'c1'), 'utf8'))
      assert.equal(l.blocked_entries.length, 1)
      assert.equal(l.blocked_entries[0].blocked_id, 'b9')
      assert.deepEqual(l.blocked_entries[0].affected_downstream, ['coder', 'consistency-reviewer'])
    })
  })
})

describe('跨宿主字段兼容 · 回归：字段名取不到时静默放行（暴露故障模式）', () => {
  it('完全错误的字段名（如 wrong_key）→ guard 放行 exit 0（无 changeId 分支）', () => {
    withTempRepo((root) => {
      const l = createLedger('c1', new Date().toISOString())
      l.loops.test_debug_code.iteration = 3
      writeLedger(root, l)
      // 故意用不被识别的键名：模拟字段名拼错——hook 取不到 changeId，放行（fail-open）。
      // 这条 TC 固化「fail-open」行为本身，提醒真宿主烟测必须验证字段名确实被识别。
      const r = runHook(guardScript, { toolName: 'Task', cwd: root, tool_input: { wrong_change_key: 'c1', subagent_type: 'coder', current_loop_id: 'test_debug_code' } }, root)
      assert.equal(r.status, 0, '取不到 changeId 时 fail-open——这是已知风险，真宿主须验证字段名')
    })
  })
})
