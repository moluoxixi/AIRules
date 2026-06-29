// 回路熔断进度账本（loop ledger）的 schema、纯决策函数与校验。
//
// 背景：rules/AGENTS.md 核心门禁第 9 条要求 max_loop/mismatch_loop 由主代理在账本中维护，
// 达上限即转 BLOCKED。本模块是该账本的**单一事实源**（类型 + 纯逻辑 + 校验），被
// scripts/loop-ledger.ts（CLI）与单测消费。hooks/loop-guard.mjs / subagent-trace.mjs 因运行在
// 宿主侧、以 plain node 启动、无法 import 本 TS 模块，故自包含等价最小逻辑，并由契约测试对齐本模块决策，
// 防止 fixture/script 漂移。
//
// 设计要点：
// - 四条回路（rules/AGENTS.md 第 9 条）：三条内层 max_loop=3 + 一条 mismatch 外层 max_loop=2。
//   mismatch_loop 不另设字段——它就是 loops.review_req_mismatch（统一为「回路计数」模型）。
// - 阻断仅限 ADR-0006 三类客观信号：回路超限 / blocked_id 命中 / agent 身份重叠。
// - 纯函数无 I/O：文件读写在 scripts/loop-ledger.ts。本模块只依赖入参，便于红绿测试。

/** 四条受计数回路的稳定标识（与 rules/AGENTS.md 第 9 条一致）。 */
export const LOOP_IDS = ['test_debug_code', 'review_code_quality', 'consist_code', 'review_req_mismatch'] as const
export type LoopId = typeof LOOP_IDS[number]

/** 各回路默认上限：三条内层回路 3 次，mismatch 外层 2 次。 */
export const DEFAULT_MAX_LOOP: Record<LoopId, number> = {
  test_debug_code: 3,
  review_code_quality: 3,
  consist_code: 3,
  review_req_mismatch: 2,
}

/** 子代理派发结局枚举。 */
export const DISPATCH_OUTCOMES = ['success', 'mismatch', 'blocked', 'pending'] as const
export type DispatchOutcome = typeof DISPATCH_OUTCOMES[number]

/** blocked 条目状态。 */
export const BLOCKED_STATUSES = ['open', 'resolved'] as const
export type BlockedStatus = typeof BLOCKED_STATUSES[number]

/** 承担 reviewer 角色的 agent_type（与 coder 身份重叠即违反 reviewer≠coder 红线）。 */
export const REVIEWER_AGENT_TYPES = ['code-reviewer', 'consistency-reviewer'] as const
/** 承担 coder 角色的 agent_type。 */
export const CODER_AGENT_TYPES = ['coder'] as const

export interface LoopCounter {
  iteration: number
  max_loop: number
}

export interface BlockedEntry {
  blocked_id: string
  source_stage: string
  reason: string
  affected_downstream: string[]
  unblock_condition: string
  status: BlockedStatus
  created_at: string
  resolved_at?: string
}

export interface Dispatch {
  timestamp: string
  agent_id: string
  agent_type: string
  target_stage: string
  current_loop_id: LoopId | null
  outcome: DispatchOutcome
}

export interface LoopLedger {
  change_id: string
  created_at: string
  loops: Record<LoopId, LoopCounter>
  blocked_entries: BlockedEntry[]
  recent_dispatches: Dispatch[]
}

/** 阻断决策结果：blocked=true 时 signal/reason 必填，可回溯到 ADR-0006 三类客观信号之一。 */
export interface BlockDecision {
  blocked: boolean
  signal?: 'loop_exceeded' | 'blocked_id' | 'agent_overlap'
  reason?: string
}

/** 派发请求（loop-guard 在派发前据此决策）。 */
export interface DispatchRequest {
  agent_id?: string
  agent_type?: string
  target_stage?: string
  current_loop_id?: LoopId | string | null
}

/** 构造一个空账本（所有回路 iteration=0、默认上限）。 */
export function createLedger(changeId: string, now: string): LoopLedger {
  const loops = {} as Record<LoopId, LoopCounter>
  for (const id of LOOP_IDS) {
    loops[id] = { iteration: 0, max_loop: DEFAULT_MAX_LOOP[id] }
  }
  return { change_id: changeId, created_at: now, loops, blocked_entries: [], recent_dispatches: [] }
}

function isLoopId(v: unknown): v is LoopId {
  return typeof v === 'string' && (LOOP_IDS as readonly string[]).includes(v)
}

function isReviewer(agentType?: string): boolean {
  return !!agentType && (REVIEWER_AGENT_TYPES as readonly string[]).includes(agentType)
}

function isCoder(agentType?: string): boolean {
  return !!agentType && (CODER_AGENT_TYPES as readonly string[]).includes(agentType)
}

/**
 * 据账本与待派发请求做阻断决策（纯函数，loop-guard 的核心逻辑）。
 * 仅依据 ADR-0006 三类客观信号，按优先级返回首个命中：
 *   1. 回路计数 >= max_loop（current_loop_id 指向的回路）
 *   2. blocked_id：存在 open 条目且 target_stage 命中其 affected_downstream
 *   3. agent 身份重叠：待派发的 reviewer 实例与账本中近期 coder 实例同 agent_id
 * 任一不命中返回 { blocked: false }。
 */
export function decideBlock(ledger: LoopLedger, req: DispatchRequest): BlockDecision {
  // 1. 回路计数超限。
  if (isLoopId(req.current_loop_id)) {
    const counter = ledger.loops[req.current_loop_id]
    if (counter && counter.iteration >= counter.max_loop) {
      return {
        blocked: true,
        signal: 'loop_exceeded',
        reason: `回路 ${req.current_loop_id} 已达上限 ${counter.max_loop}（当前 ${counter.iteration}），不再自动回灌，转 BLOCKED 升级用户决策`,
      }
    }
  }

  // 2. blocked_id 命中：当前派发的下游阶段落在某 open 条目的 affected_downstream 内。
  const stage = req.target_stage
  if (stage) {
    for (const entry of ledger.blocked_entries) {
      if (entry.status === 'open' && entry.affected_downstream.includes(stage)) {
        return {
          blocked: true,
          signal: 'blocked_id',
          reason: `下游阶段 ${stage} 受阻于 ${entry.blocked_id}（${entry.reason}）；解除条件：${entry.unblock_condition}`,
        }
      }
    }
  }

  // 3. agent 身份重叠：待派发 reviewer 的 agent_id 与近期某 coder 派发的 agent_id 相同。
  if (req.agent_id && isReviewer(req.agent_type)) {
    const overlap = ledger.recent_dispatches.find(
      d => d.agent_id === req.agent_id && isCoder(d.agent_type),
    )
    if (overlap) {
      return {
        blocked: true,
        signal: 'agent_overlap',
        reason: `reviewer 实例 ${req.agent_id} 与既有 coder 派发同 agent_id，违反 reviewer≠coder 红线`,
      }
    }
  }

  return { blocked: false }
}

/**
 * 据一条 SubagentStop 派发结局把账本推进一格（纯函数，subagent-trace 的核心逻辑）。
 * - recent_dispatches 追加一条；
 * - 若 current_loop_id 合法且 outcome 非 pending，则对应回路 iteration +1。
 * 此处忠实按传入 current_loop_id 计数，不改写回路归属（保持「主代理决定回路归属」契约）。
 * 返回新账本（不可变更新，便于测试）。
 */
export function recordDispatch(ledger: LoopLedger, dispatch: Dispatch): LoopLedger {
  const loops = { ...ledger.loops }
  if (isLoopId(dispatch.current_loop_id) && dispatch.outcome !== 'pending') {
    const prev = loops[dispatch.current_loop_id]
    loops[dispatch.current_loop_id] = { ...prev, iteration: prev.iteration + 1 }
  }
  return {
    ...ledger,
    loops,
    recent_dispatches: [...ledger.recent_dispatches, dispatch],
  }
}

/** 校验账本结构完整性，返回错误清单（空数组 = 合规）。供 CLI validate 与契约测试共用。 */
export function validateLedger(value: unknown): string[] {
  const errors: string[] = []
  if (typeof value !== 'object' || value === null) {
    return ['账本不是对象']
  }
  const l = value as Partial<LoopLedger>
  if (typeof l.change_id !== 'string' || l.change_id.length === 0) {
    errors.push('change_id 缺失或非字符串')
  }
  if (typeof l.created_at !== 'string' || Number.isNaN(Date.parse(l.created_at))) {
    errors.push('created_at 缺失或非法时间戳')
  }
  if (typeof l.loops !== 'object' || l.loops === null) {
    errors.push('loops 缺失')
  }
  else {
    for (const id of LOOP_IDS) {
      const c = (l.loops as Record<string, unknown>)[id]
      if (typeof c !== 'object' || c === null) {
        errors.push(`loops.${id} 缺失`)
        continue
      }
      const counter = c as Partial<LoopCounter>
      if (typeof counter.iteration !== 'number' || counter.iteration < 0) {
        errors.push(`loops.${id}.iteration 非法`)
      }
      if (typeof counter.max_loop !== 'number' || counter.max_loop <= 0) {
        errors.push(`loops.${id}.max_loop 非法`)
      }
    }
  }
  if (!Array.isArray(l.blocked_entries)) {
    errors.push('blocked_entries 非数组')
  }
  else {
    l.blocked_entries.forEach((e, i) => {
      if (typeof e !== 'object' || e === null) {
        errors.push(`blocked_entries[${i}] 非对象`)
        return
      }
      const be = e as Partial<BlockedEntry>
      if (typeof be.blocked_id !== 'string') {
        errors.push(`blocked_entries[${i}].blocked_id 缺失`)
      }
      if (!Array.isArray(be.affected_downstream)) {
        errors.push(`blocked_entries[${i}].affected_downstream 非数组`)
      }
      if (be.status !== 'open' && be.status !== 'resolved') {
        errors.push(`blocked_entries[${i}].status 非法枚举`)
      }
    })
  }
  if (!Array.isArray(l.recent_dispatches)) {
    errors.push('recent_dispatches 非数组')
  }
  return errors
}
