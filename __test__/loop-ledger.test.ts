import type { Dispatch } from '../constants/loop-ledger.js'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import {
  createLedger,
  decideBlock,

  recordDispatch,
  validateLedger,
} from '../constants/loop-ledger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const cliScript = path.join(repoRoot, 'scripts', 'loop-ledger.ts')

const NOW = '2026-06-29T10:00:00+08:00'

function dispatch(over: Partial<Dispatch> = {}): Dispatch {
  return {
    timestamp: NOW,
    agent_id: 'coder-a1',
    agent_type: 'coder',
    target_stage: 'implement',
    current_loop_id: 'test_debug_code',
    outcome: 'success',
    ...over,
  }
}

// ── decideBlock：三类客观信号 ──────────────────────────────

describe('decideBlock · 回路计数超限', () => {
  it('回路 iteration 达 max_loop 时阻断（loop_exceeded）', () => {
    const l = createLedger('c1', NOW)
    l.loops.test_debug_code.iteration = 3 // 达上限 3
    const d = decideBlock(l, { current_loop_id: 'test_debug_code', target_stage: 'implement' })
    assert.equal(d.blocked, true)
    assert.equal(d.signal, 'loop_exceeded')
  })

  it('回路未达上限不阻断', () => {
    const l = createLedger('c1', NOW)
    l.loops.test_debug_code.iteration = 2
    assert.equal(decideBlock(l, { current_loop_id: 'test_debug_code' }).blocked, false)
  })

  it('mismatch 回路上限为 2（低于内层 3）', () => {
    const l = createLedger('c1', NOW)
    l.loops.review_req_mismatch.iteration = 2
    const d = decideBlock(l, { current_loop_id: 'review_req_mismatch' })
    assert.equal(d.blocked, true)
    assert.equal(d.signal, 'loop_exceeded')
  })
})

describe('decideBlock · blocked_id 命中', () => {
  it('open 条目 + target_stage 命中 affected_downstream 时阻断', () => {
    const l = createLedger('c1', NOW)
    l.blocked_entries.push({
      blocked_id: 'bid-001',
      source_stage: 'planner',
      reason: '需求事实源缺失',
      affected_downstream: ['coder', 'consistency-reviewer'],
      unblock_condition: '用户补全角色矩阵',
      status: 'open',
      created_at: NOW,
    })
    const d = decideBlock(l, { target_stage: 'coder' })
    assert.equal(d.blocked, true)
    assert.equal(d.signal, 'blocked_id')
  })

  it('resolved 条目不再阻断', () => {
    const l = createLedger('c1', NOW)
    l.blocked_entries.push({
      blocked_id: 'bid-001',
      source_stage: 'planner',
      reason: 'x',
      affected_downstream: ['coder'],
      unblock_condition: 'y',
      status: 'resolved',
      created_at: NOW,
    })
    assert.equal(decideBlock(l, { target_stage: 'coder' }).blocked, false)
  })

  it('target_stage 不在 affected_downstream 内不阻断', () => {
    const l = createLedger('c1', NOW)
    l.blocked_entries.push({
      blocked_id: 'bid-001',
      source_stage: 'planner',
      reason: 'x',
      affected_downstream: ['coder'],
      unblock_condition: 'y',
      status: 'open',
      created_at: NOW,
    })
    assert.equal(decideBlock(l, { target_stage: 'code-reviewer' }).blocked, false)
  })
})

describe('decideBlock · agent 身份重叠（reviewer≠coder）', () => {
  it('reviewer 实例与近期 coder 派发同 agent_id 时阻断', () => {
    let l = createLedger('c1', NOW)
    l = recordDispatch(l, dispatch({ agent_id: 'shared-x', agent_type: 'coder', outcome: 'success' }))
    const d = decideBlock(l, { agent_id: 'shared-x', agent_type: 'code-reviewer', target_stage: 'review' })
    assert.equal(d.blocked, true)
    assert.equal(d.signal, 'agent_overlap')
  })

  it('不同 agent_id 的 reviewer 不阻断', () => {
    let l = createLedger('c1', NOW)
    l = recordDispatch(l, dispatch({ agent_id: 'coder-x', agent_type: 'coder' }))
    assert.equal(decideBlock(l, { agent_id: 'reviewer-y', agent_type: 'code-reviewer' }).blocked, false)
  })

  it('consistency-reviewer 同样适用身份重叠', () => {
    let l = createLedger('c1', NOW)
    l = recordDispatch(l, dispatch({ agent_id: 'shared-z', agent_type: 'coder' }))
    assert.equal(decideBlock(l, { agent_id: 'shared-z', agent_type: 'consistency-reviewer' }).blocked, true)
  })
})

describe('decideBlock · 干净账本放行', () => {
  it('空账本任何派发都不阻断', () => {
    const l = createLedger('c1', NOW)
    assert.equal(decideBlock(l, { current_loop_id: 'test_debug_code', agent_id: 'x', agent_type: 'coder', target_stage: 'implement' }).blocked, false)
  })
})

// ── recordDispatch：计数推进 ──────────────────────────────

describe('recordDispatch', () => {
  it('非 pending 结局推进对应回路 iteration', () => {
    let l = createLedger('c1', NOW)
    l = recordDispatch(l, dispatch({ current_loop_id: 'test_debug_code', outcome: 'success' }))
    assert.equal(l.loops.test_debug_code.iteration, 1)
    assert.equal(l.recent_dispatches.length, 1)
  })

  it('pending 结局不推进计数', () => {
    let l = createLedger('c1', NOW)
    l = recordDispatch(l, dispatch({ outcome: 'pending' }))
    assert.equal(l.loops.test_debug_code.iteration, 0)
  })

  it('连续 3 次 mismatch 后 review_req_mismatch == 3（触顶可观测）', () => {
    let l = createLedger('c1', NOW)
    for (let i = 0; i < 3; i++) {
      l = recordDispatch(l, dispatch({ current_loop_id: 'review_req_mismatch', agent_type: 'code-reviewer', target_stage: 'review', outcome: 'mismatch' }))
    }
    assert.equal(l.loops.review_req_mismatch.iteration, 3)
  })

  it('不可变更新：原账本不被修改', () => {
    const l0 = createLedger('c1', NOW)
    const l1 = recordDispatch(l0, dispatch())
    assert.equal(l0.loops.test_debug_code.iteration, 0)
    assert.equal(l1.loops.test_debug_code.iteration, 1)
  })
})

// ── validateLedger ────────────────────────────────────────

describe('validateLedger', () => {
  it('createLedger 产物合规（0 错误）', () => {
    assert.deepEqual(validateLedger(createLedger('c1', NOW)), [])
  })

  it('缺 change_id 报错', () => {
    const l = createLedger('c1', NOW) as unknown as Record<string, unknown>
    delete l.change_id
    assert.ok(validateLedger(l).some(e => e.includes('change_id')))
  })

  it('非法 created_at 报错', () => {
    const l = { ...createLedger('c1', NOW), created_at: 'not-a-date' }
    assert.ok(validateLedger(l).some(e => e.includes('created_at')))
  })

  it('缺回路键报错', () => {
    const l = createLedger('c1', NOW) as unknown as { loops: Record<string, unknown> }
    delete l.loops.consist_code
    assert.ok(validateLedger(l).some(e => e.includes('consist_code')))
  })

  it('非对象输入报错', () => {
    assert.ok(validateLedger(null).length > 0)
    assert.ok(validateLedger('x').length > 0)
  })
})

// ── CLI ────────────────────────────────────────────────────

function runCli(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliScript, ...args], { encoding: 'utf8' })
}

function withTempRepo<T>(run: (root: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-ledger-'))
  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

describe('cLI', () => {
  it('list 空目录给出友好提示', () => {
    withTempRepo((root) => {
      const r = runCli(['list', root])
      assert.equal(r.status, 0)
      assert.match(r.stdout, /无账本/)
    })
  })

  it('reset 创建合规账本，validate 通过，list 显示', () => {
    withTempRepo((root) => {
      const reset = runCli(['reset', 'feat-x', root])
      assert.equal(reset.status, 0)
      const file = path.join(root, '.airules', 'runtime', 'loops', 'feat-x.json')
      assert.ok(fs.existsSync(file), '账本文件应被创建')
      assert.deepEqual(validateLedger(JSON.parse(fs.readFileSync(file, 'utf8'))), [])

      const val = runCli(['validate', root])
      assert.equal(val.status, 0)
      assert.match(val.stdout, /PASS/)

      const list = runCli(['list', root])
      assert.match(list.stdout, /feat-x/)
    })
  })

  it('validate 对损坏 JSON exit 1', () => {
    withTempRepo((root) => {
      const dir = path.join(root, '.airules', 'runtime', 'loops')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'broken.json'), '{ not valid', 'utf8')
      const r = runCli(['validate', root])
      assert.equal(r.status, 1)
      assert.match(r.stdout, /FAIL/)
    })
  })
})
