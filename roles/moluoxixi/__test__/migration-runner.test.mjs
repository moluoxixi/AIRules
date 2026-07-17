import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPersistentBackup, shouldExcludeFromBackup } from '../skills/init-project/scripts/core/backup.mjs'
import { compareVersions, isSafeDelete, runVersionMigrations } from '../skills/init-project/scripts/migrations/runner.mjs'

const temporaryRoots = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function temporaryProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-migration-'))
  temporaryRoots.push(root)
  return root
}

function writeProjectFile(root, relativePath, content) {
  const target = path.join(root, ...relativePath.split('/'))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
  return target
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex')
}

function manifest(entries = {}) {
  return { entries, platforms: [], project: {}, schemaVersion: 2 }
}

describe('moluoxixi version migrations', () => {
  it('loads bundled manifests and selects config additions by version', () => {
    const projectRoot = temporaryProject()
    const result = runVersionMigrations(projectRoot, manifest(), '0.5.6', '0.5.7', { dryRun: true })

    expect(result.configSections).toContainEqual(expect.objectContaining({
      file: '.moluoxixi/config.yaml',
      release: '0.5.7',
      sectionHeading: 'Codex (dispatch behavior)',
      sentinel: 'codex:',
    }))
    expect(compareVersions('0.6.0-beta.18', '0.6.0-beta.6')).toBeGreaterThan(0)
    expect(compareVersions('0.6.7-airules.1', '0.6.7')).toBe(0)
  })

  it('keeps the default inline backup when migrating a modified file', () => {
    const projectRoot = temporaryProject()
    const source = '.claude/commands/onboard-developer.md'
    const target = '.claude/commands/onboard.md'
    writeProjectFile(projectRoot, source, 'user edit\n')
    const state = manifest({ [source]: { baselineHash: hash('template\n') } })

    const result = runVersionMigrations(projectRoot, state, '0.1.8', '0.1.9', { migrate: true })

    expect(result.applied).toContain(source)
    expect(fs.existsSync(path.join(projectRoot, ...source.split('/')))).toBe(false)
    expect(fs.readFileSync(path.join(projectRoot, ...target.split('/')), 'utf8')).toBe('user edit\n')
    expect(fs.readFileSync(path.join(projectRoot, ...`${target}.backup`.split('/')), 'utf8')).toBe('user edit\n')
    expect(state.entries[target]).toEqual({ baselineHash: hash('template\n') })
  })

  it('moves an owned directory with user files and transfers descendant entries', () => {
    const projectRoot = temporaryProject()
    const source = '.moluoxixi/agent-traces'
    const target = '.moluoxixi/workspace'
    const ownedPath = `${source}/owned.md`
    writeProjectFile(projectRoot, ownedPath, 'owned\n')
    writeProjectFile(projectRoot, `${source}/user.md`, 'user\n')
    const state = manifest({ [ownedPath]: { baselineHash: hash('owned\n') } })

    const result = runVersionMigrations(projectRoot, state, '0.1.9', '0.2.0', { migrate: true })

    expect(result.applied).toContain(source)
    expect(fs.readFileSync(path.join(projectRoot, ...`${target}/user.md`.split('/')), 'utf8')).toBe('user\n')
    expect(state.entries[`${target}/owned.md`]).toEqual({ baselineHash: hash('owned\n') })
    expect(state.entries[ownedPath]).toBeUndefined()
  })

  it('never force-moves a directory without an ownership record', () => {
    const projectRoot = temporaryProject()
    const source = '.moluoxixi/agent-traces'
    writeProjectFile(projectRoot, `${source}/user.md`, 'user\n')

    const result = runVersionMigrations(projectRoot, manifest(), '0.1.9', '0.2.0', { force: true, migrate: true })

    expect(result.skipped).toContain(source)
    expect(fs.existsSync(path.join(projectRoot, ...source.split('/')))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'workspace'))).toBe(false)
  })

  it('honors safe-delete allowed hashes without a manifest entry', () => {
    const projectRoot = temporaryProject()
    const relativePath = '.claude/commands/retired.md'
    writeProjectFile(projectRoot, relativePath, 'known template\n')

    expect(isSafeDelete(projectRoot, manifest(), {}, relativePath, [hash('known template\n')])).toBe(true)
    expect(isSafeDelete(projectRoot, manifest(), {}, relativePath, [hash('different\n')])).toBe(false)
  })
})

describe('moluoxixi persistent update backup', () => {
  it('snapshots all managed roots while excluding user data and worktrees', () => {
    const projectRoot = temporaryProject()
    writeProjectFile(projectRoot, '.moluoxixi/config.yaml', 'config\n')
    writeProjectFile(projectRoot, '.moluoxixi/workspace/alice/journal.md', 'journal\n')
    writeProjectFile(projectRoot, '.claude/settings.json', '{}\n')
    writeProjectFile(projectRoot, '.claude/worktrees/task/source.ts', 'source\n')
    writeProjectFile(projectRoot, 'AGENTS.md', 'agents\n')

    const relativeBackup = createPersistentBackup(projectRoot)
    const backup = path.join(projectRoot, ...relativeBackup.split('/'))

    expect(fs.readFileSync(path.join(backup, '.moluoxixi', 'config.yaml'), 'utf8')).toBe('config\n')
    expect(fs.readFileSync(path.join(backup, '.claude', 'settings.json'), 'utf8')).toBe('{}\n')
    expect(fs.readFileSync(path.join(backup, 'AGENTS.md'), 'utf8')).toBe('agents\n')
    expect(fs.existsSync(path.join(backup, '.moluoxixi', 'workspace'))).toBe(false)
    expect(fs.existsSync(path.join(backup, '.claude', 'worktrees'))).toBe(false)
  })

  it('normalizes Windows separators in backup exclusions', () => {
    expect(shouldExcludeFromBackup('.claude\\worktrees\\task\\file.ts')).toBe(true)
    expect(shouldExcludeFromBackup('.moluoxixi\\tasks\\task.json')).toBe(true)
  })
})
