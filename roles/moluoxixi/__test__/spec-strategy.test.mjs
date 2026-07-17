import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { prepareOperations } from '../skills/init-project/scripts/core/operations.mjs'
import { buildPlan } from '../skills/init-project/scripts/plan.mjs'

const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-spec-strategy-'))
  temporaryRoots.push(root)
  return root
}

function write(root, relativePath, content) {
  const target = path.join(root, ...relativePath.split('/'))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function plan(root, strategy, packages = []) {
  return buildPlan([], 'python3', false, packages, packages[0]?.name, 'fullstack', {
    projectRoot: root,
    spec: {
      files: new Map([
        ['backend/index.md', Buffer.from('# Remote backend\n')],
        ['binary/data.bin', Buffer.from([0xFF, 0x00, 0xFE])],
      ]),
      strategy,
    },
  })
}

function manifest() {
  return { entries: {}, features: {}, platforms: [], project: {}, schemaVersion: 2 }
}

describe('remote spec directory strategies', () => {
  it('does not mix bundled specs into a remote single-project template', () => {
    const root = project()
    const result = plan(root, 'skip')

    expect(result.has('.moluoxixi/spec/backend/index.md')).toBe(true)
    expect(result.has('.moluoxixi/spec/frontend/index.md')).toBe(false)
    expect(result.has('.moluoxixi/spec/guides/index.md')).toBe(false)
    expect(result.get('.moluoxixi/spec/binary/data.bin').content).toEqual(Buffer.from([0xFF, 0x00, 0xFE]))
  })

  it('projects one requested template into every monorepo package scope', () => {
    const root = project()
    const result = plan(root, 'skip', [
      { name: '@scope/web', path: 'apps/web', type: 'frontend' },
      { name: 'api', path: 'apps/api', type: 'backend' },
    ])

    expect(result.has('.moluoxixi/spec/web/backend/index.md')).toBe(true)
    expect(result.has('.moluoxixi/spec/api/backend/index.md')).toBe(true)
    expect(result.has('.moluoxixi/spec/backend/index.md')).toBe(false)
  })

  it('skips the complete destination when the directory already exists', () => {
    const root = project()
    write(root, '.moluoxixi/spec/user.md', '# User\n')

    const result = plan(root, 'skip')

    expect([...result.keys()].some(key => key.startsWith('.moluoxixi/spec/'))).toBe(false)
  })

  it('appends only missing files and never updates existing files', () => {
    const root = project()
    write(root, '.moluoxixi/spec/backend/index.md', '# User backend\n')

    const prepared = prepareOperations(root, plan(root, 'append'), manifest(), false)

    expect(prepared.result.preserved).toContain('.moluoxixi/spec/backend/index.md')
    expect(prepared.result.created).toContain('.moluoxixi/spec/binary/data.bin')
    expect(prepared.result.updated).toEqual([])
  })

  it('overwrites the complete destination after the remote plan is available', () => {
    const root = project()
    write(root, '.moluoxixi/spec/backend/index.md', '# Old backend\n')
    write(root, '.moluoxixi/spec/retired.md', '# Retired\n')

    const prepared = prepareOperations(root, plan(root, 'overwrite'), manifest(), false)

    expect(prepared.result.updated).toContain('.moluoxixi/spec/backend/index.md')
    expect(prepared.result.removed).toContain('.moluoxixi/spec/retired.md')
    expect(prepared.result.conflicts).toEqual([])
  })
})
