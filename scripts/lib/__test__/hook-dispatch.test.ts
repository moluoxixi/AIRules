import type { HookHostAdapter } from '../../../constants/hosts.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveHookDispatches } from '../hook-dispatch.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createHooks(manifest?: unknown): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-hook-dispatch-'))
  temporaryRoots.push(root)
  fs.writeFileSync(path.join(root, 'dispatcher.mjs'), 'export {}\n')
  fs.writeFileSync(path.join(root, 'stop.mjs'), 'export {}\n')
  if (manifest !== undefined) {
    fs.writeFileSync(path.join(root, 'hooks.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  return root
}

const claudeAdapter: HookHostAdapter = {
  relDir: '.',
  fileName: 'settings.json',
  format: 'json',
  nesting: 'group',
  includeType: true,
}

describe('role hook dispatch manifest', () => {
  it('returns an empty desired set when no manifest exists', () => {
    const hooksRoot = createHooks()
    expect(resolveHookDispatches(hooksRoot, 'claude', claudeAdapter)).toEqual([])
  })

  it('maps neutral declarations through host filtering and event overrides', () => {
    const hooksRoot = createHooks({
      version: 1,
      hooks: [
        { event: 'PreToolUse', script: 'dispatcher.mjs', hosts: ['claude', 'cursor'], event_by_host: { cursor: 'beforeShellExecution' } },
        { event: 'Stop', script: 'dispatcher.mjs' },
      ],
    })

    expect(resolveHookDispatches(hooksRoot, 'claude', claudeAdapter)).toEqual([
      { relDir: '.', fileName: 'settings.json', format: 'json', nesting: 'group', includeType: true, event: 'PreToolUse', scriptName: 'dispatcher.mjs' },
      { relDir: '.', fileName: 'settings.json', format: 'json', nesting: 'group', includeType: true, event: 'Stop', scriptName: 'dispatcher.mjs' },
    ])

    expect(resolveHookDispatches(hooksRoot, 'qoder', claudeAdapter)).toEqual([
      { relDir: '.', fileName: 'settings.json', format: 'json', nesting: 'group', includeType: true, event: 'Stop', scriptName: 'dispatcher.mjs' },
    ])
  })

  it('returns no dispatches when the host has no hook adapter', () => {
    const hooksRoot = createHooks({ version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }] })
    expect(resolveHookDispatches(hooksRoot, 'unsupported', undefined)).toEqual([])
  })

  it.each([
    {
      name: 'path traversal script',
      manifest: { version: 1, hooks: [{ event: 'Stop', script: '../escape.mjs' }] },
      error: /safe \.mjs file name/i,
    },
    {
      name: 'unknown manifest field',
      manifest: { version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs', command: 'rm -rf' }] },
      error: /unknown fields/i,
    },
    {
      name: 'duplicate dispatch',
      manifest: { version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }, { event: 'Stop', script: 'dispatcher.mjs' }] },
      error: /duplicate dispatch/i,
    },
    {
      name: 'overlapping global and host dispatch',
      manifest: { version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs' }, { event: 'Stop', script: 'dispatcher.mjs', hosts: ['claude'] }] },
      error: /duplicate.*host claude/i,
    },
    {
      name: 'missing script',
      manifest: { version: 1, hooks: [{ event: 'Stop', script: 'missing.mjs' }] },
      error: /does not exist/i,
    },
    {
      name: 'unknown host',
      manifest: { version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs', hosts: ['claud'] }] },
      error: /unknown host.*claud/i,
    },
    {
      name: 'event override outside host filter',
      manifest: { version: 1, hooks: [{ event: 'Stop', script: 'dispatcher.mjs', hosts: ['claude'], event_by_host: { cursor: 'stop' } }] },
      error: /outside hosts.*cursor/i,
    },
  ])('rejects $name', ({ manifest, error }) => {
    const hooksRoot = createHooks(manifest)
    expect(() => resolveHookDispatches(hooksRoot, 'claude', claudeAdapter)).toThrow(error)
  })
})
