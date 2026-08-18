import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCodexThreadStartParams,
  createCodexCtx,
  encodeCodexUserMessage,
  parseCodexLine,
  parseCodexSandboxMode,
} from '../packages/cli/src/commands/channel/adapters/codex.js'
import { assembleContext } from '../packages/cli/src/commands/channel/context-loader.js'
import { parseChannelTrustSection } from '../packages/cli/src/commands/channel/context-trust.js'
import { scheduleSupervisorIdleTimer } from '../packages/cli/src/commands/channel/supervisor/idle.js'
import { claudeExtractDialogue, claudeSearch } from '../packages/core/src/mem/adapters/claude.js'
import { codexExtractDialogue } from '../packages/core/src/mem/adapters/codex.js'

const roots: string[] = []

afterEach(() => {
  vi.useRealTimers()
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

describe('moluoxixi runtime adaptations', () => {
  it('parses Moluoxixi trusted context configuration and enforces realpath roots', () => {
    expect(parseChannelTrustSection(`channel:\n  trusted_context_dirs:\n    - ../shared\n  auto_trust_moluoxixi_symlinks: false\n`)).toEqual({
      trustedDirs: ['../shared'],
      autoTrustSymlinks: false,
    })

    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-runtime-project-'))
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-runtime-external-'))
    roots.push(project, external)
    const evidence = path.join(external, 'evidence.md')
    fs.writeFileSync(evidence, '# trusted evidence\n')

    expect(assembleContext(project, [evidence]).paths).toEqual([])
    expect(assembleContext(project, [evidence], [], [fs.realpathSync(external)])).toMatchObject({
      paths: [path.relative(project, evidence)],
    })
  })

  it('validates Codex sandbox values and passes them to thread/start', () => {
    expect(parseCodexSandboxMode(undefined)).toBeUndefined()
    expect(parseCodexSandboxMode('danger-full-access')).toBe('danger-full-access')
    expect(() => parseCodexSandboxMode('unsafe')).toThrow('Invalid --sandbox')
    expect(buildCodexThreadStartParams('repo', undefined, 'read-only')).toMatchObject({ sandbox: 'read-only' })
  })

  it('surfaces Codex terminal failures once and resets for the next turn', () => {
    const ctx = createCodexCtx()
    const topLevel = JSON.stringify({ method: 'error', params: { error: { message: 'boom' } } })
    const failedTurn = JSON.stringify({ method: 'turn/completed', params: { turn: { status: 'failed', error: { message: 'boom again' } } } })
    expect(parseCodexLine(topLevel, ctx).events).toEqual([{ kind: 'error', payload: { message: 'boom' } }])
    expect(parseCodexLine(failedTurn, ctx).events).toEqual([])

    ctx.threadId = 'thread-1'
    encodeCodexUserMessage(ctx, 'retry')
    expect(parseCodexLine(failedTurn, ctx).events).toEqual([{ kind: 'error', payload: { message: 'boom again' } }])
    expect(parseCodexLine(JSON.stringify({ method: 'error', params: { error: 'temporary', willRetry: true } }), ctx).events).toEqual([
      { kind: 'progress', payload: { detail: { kind: 'warning', message: 'temporary' } } },
    ])
  })

  it('shuts down idle workers even after a terminal event was emitted', async () => {
    vi.useFakeTimers()
    const request = vi.fn(async () => undefined)
    scheduleSupervisorIdleTimer({
      idleTimeoutMs: 100,
      shutdown: {
        isShuttingDown: () => false,
        request,
      } as never,
      isChildExited: () => false,
      log: { write: vi.fn() },
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(request).toHaveBeenCalledWith('SIGTERM', 'idle-timeout')
  })

  it('recovers Codex retained history across compaction without duplicating turns', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-codex-memory-'))
    roots.push(root)
    const filePath = path.join(root, 'rollout.jsonl')
    const message = (text: string) => ({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text }],
    })
    const rows = [
      { timestamp: '2026-08-14T00:00:00Z', payload: { id: 'session', cwd: root } },
      { timestamp: '2026-08-14T00:00:01Z', payload: message('pre-compact') },
      {
        timestamp: '2026-08-14T00:00:02Z',
        type: 'compacted',
        payload: { replacement_history: [message('retained-only'), message('pre-compact')] },
      },
      { timestamp: '2026-08-14T00:00:03Z', payload: message('post-compact') },
    ]
    fs.writeFileSync(filePath, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`)
    const warnings: { code: string, message: string }[] = []
    const turns = codexExtractDialogue({ platform: 'codex', id: 'session', filePath }, warnings)
    expect(turns.filter(turn => turn.kind !== 'marker').map(turn => turn.text)).toEqual([
      'retained-only',
      'pre-compact',
      'post-compact',
    ])
    expect(turns.find(turn => turn.kind === 'marker')?.text).toContain('[compaction boundary]')
    expect(warnings.map(warning => warning.code)).toContain('codex-compaction-assistant-dropped')
  })

  it('keeps Claude pre-compaction dialogue while excluding its marker from search', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-claude-memory-'))
    roots.push(root)
    const filePath = path.join(root, 'conversation.jsonl')
    const rows = [
      { type: 'user', message: { role: 'user', content: 'widgets before compact' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'answer' }] } },
      { type: 'user', isCompactSummary: true, message: { role: 'user', content: 'widgets summary' } },
      { type: 'user', message: { role: 'user', content: 'after compact' } },
    ]
    fs.writeFileSync(filePath, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`)
    const session = { platform: 'claude' as const, id: 'session', filePath }
    const turns = claudeExtractDialogue(session)
    expect(turns.map(turn => turn.kind ?? 'dialogue')).toEqual(['dialogue', 'dialogue', 'marker', 'dialogue'])
    expect(claudeSearch(session, 'widgets')).toMatchObject({ count: 1, totalTurns: 3 })
  })
})
