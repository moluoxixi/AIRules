import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPersistentBackup, shouldExcludeFromBackup } from '../skills/init-project/scripts/core/backup.mjs'
import { mergeConfig } from '../skills/init-project/scripts/core/migration.mjs'
import { normalizeManifest } from '../skills/init-project/scripts/core/ownership.mjs'
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

const futureReleases = [
  {
    version: '0.2.0',
    configSectionsAdded: [
      {
        file: '.moluoxixi/config.yaml',
        sectionHeading: 'Codex (dispatch behavior)',
        sentinel: 'codex:',
      },
    ],
    migrations: [
      {
        type: 'rename',
        from: '.claude/commands/onboard-developer.md',
        to: '.claude/commands/onboard.md',
      },
    ],
  },
  {
    version: '0.3.0',
    migrations: [
      {
        type: 'rename-dir',
        from: '.moluoxixi/agent-traces',
        to: '.moluoxixi/workspace',
      },
    ],
  },
  {
    version: '0.4.0',
    migrations: [
      { type: 'delete', path: '.claude/commands/retired.md' },
      { type: 'safe-file-delete', path: '.claude/commands/safe-retired.md', allowed_hashes: [hash('known template\n')] },
      { type: 'safe-file-delete', path: '.claude/commands/user-owned.md', allowed_hashes: [hash('known template\n')] },
    ],
  },
  {
    version: '0.5.0',
    breaking: true,
    recommendMigrate: true,
    migrations: [
      { type: 'rename', from: '.moluoxixi/old-layout.md', to: '.moluoxixi/new-layout.md' },
    ],
  },
]

describe('moluoxixi version migrations', () => {
  it('starts with no historical releases and supports future Moluoxixi fixtures', () => {
    const projectRoot = temporaryProject()
    const baseline = runVersionMigrations(projectRoot, manifest(), '0.1.0', '0.2.0', { dryRun: true })
    const result = runVersionMigrations(projectRoot, manifest(), '0.1.0', '0.2.0', { dryRun: true, manifests: futureReleases })

    expect(baseline).toMatchObject({ applied: [], configSections: [], conflicts: [], pending: [], proposed: [], skipped: [] })
    expect(result.configSections).toContainEqual(expect.objectContaining({
      file: '.moluoxixi/config.yaml',
      release: '0.2.0',
      sectionHeading: 'Codex (dispatch behavior)',
      sentinel: 'codex:',
    }))
    expect(compareVersions('0.2.0-beta.18', '0.2.0-beta.6')).toBeGreaterThan(0)
    expect(compareVersions('0.2.0-airules.1', '0.2.0')).toBeLessThan(0)

    const merged = mergeConfig(
      '# User config\ncustom: true\n',
      '# Base\n\n#-------------------------\n# Codex (dispatch behavior)\ncodex:\n  enabled: true\n',
      undefined,
      result.configSections,
    )
    expect(merged).toContain('# User config\ncustom: true')
    expect(merged.match(/# Codex \(dispatch behavior\)/gu)).toHaveLength(1)
  })

  it('keeps the default inline backup when migrating a modified file', () => {
    const projectRoot = temporaryProject()
    const source = '.claude/commands/onboard-developer.md'
    const target = '.claude/commands/onboard.md'
    writeProjectFile(projectRoot, source, 'user edit\n')
    const state = manifest({ [source]: { baselineHash: hash('template\n') } })

    const result = runVersionMigrations(projectRoot, state, '0.1.0', '0.2.0', { manifests: futureReleases, migrate: true })

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

    const result = runVersionMigrations(projectRoot, state, '0.2.0', '0.3.0', { manifests: futureReleases, migrate: true })

    expect(result.applied).toContain(source)
    expect(fs.readFileSync(path.join(projectRoot, ...`${target}/user.md`.split('/')), 'utf8')).toBe('user\n')
    expect(state.entries[`${target}/owned.md`]).toEqual({ baselineHash: hash('owned\n') })
    expect(state.entries[ownedPath]).toBeUndefined()
  })

  it('never force-moves a directory without an ownership record', () => {
    const projectRoot = temporaryProject()
    const source = '.moluoxixi/agent-traces'
    writeProjectFile(projectRoot, `${source}/user.md`, 'user\n')

    const result = runVersionMigrations(projectRoot, manifest(), '0.2.0', '0.3.0', { force: true, manifests: futureReleases, migrate: true })

    expect(result.skipped).toContain(source)
    expect(fs.existsSync(path.join(projectRoot, ...source.split('/')))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'workspace'))).toBe(false)
  })

  it('honors safe-delete allowed hashes without a manifest entry', () => {
    const projectRoot = temporaryProject()
    const relativePath = '.claude/commands/retired.md'
    writeProjectFile(projectRoot, relativePath, 'known template\n')

    expect(isSafeDelete(projectRoot, manifest(), relativePath, [hash('known template\n')])).toBe(true)
    expect(isSafeDelete(projectRoot, manifest(), relativePath, [hash('different\n')])).toBe(false)
  })

  it('executes delete and safe-delete manifests without removing unknown content', () => {
    const projectRoot = temporaryProject()
    const retired = '.claude/commands/retired.md'
    const safeRetired = '.claude/commands/safe-retired.md'
    const userOwned = '.claude/commands/user-owned.md'
    writeProjectFile(projectRoot, retired, 'owned template\n')
    writeProjectFile(projectRoot, safeRetired, 'known template\n')
    writeProjectFile(projectRoot, userOwned, 'user edit\n')
    const state = manifest({ [retired]: { baselineHash: hash('owned template\n') } })

    const result = runVersionMigrations(projectRoot, state, '0.3.0', '0.4.0', { manifests: futureReleases, migrate: true })

    expect(result.applied).toEqual(expect.arrayContaining([retired, safeRetired]))
    expect(fs.existsSync(path.join(projectRoot, ...retired.split('/')))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, ...safeRetired.split('/')))).toBe(false)
    expect(fs.readFileSync(path.join(projectRoot, ...userOwned.split('/')), 'utf8')).toBe('user edit\n')
  })

  it('requires migrate for a breaking release and rejects schema v1 manifests', () => {
    const projectRoot = temporaryProject()
    const source = '.moluoxixi/old-layout.md'
    writeProjectFile(projectRoot, source, 'owned\n')
    const state = manifest({ [source]: { baselineHash: hash('owned\n') } })

    expect(() => runVersionMigrations(projectRoot, state, '0.4.0', '0.5.0', { manifests: futureReleases })).toThrow(/requires --migrate/i)
    const migrated = runVersionMigrations(projectRoot, state, '0.4.0', '0.5.0', { manifests: futureReleases, migrate: true })
    expect(migrated.applied).toContain(source)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'new-layout.md'))).toBe(true)

    expect(() => normalizeManifest({ entries: {}, schemaVersion: 1 }, 'legacy-manifest.json')).toThrow(/unsupported or malformed manifest/i)
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
