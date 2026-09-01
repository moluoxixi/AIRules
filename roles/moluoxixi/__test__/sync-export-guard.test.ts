import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface ExportReadinessOptions {
  branchName: string
  outputVersion: string
  packages: Array<{ outputName: string, upstreamPath: string }>
  rebuildDir: string
  revision: string
}

interface SyncModule {
  assertExportReady: (options: ExportReadinessOptions) => unknown
  expandRebuildBranch: (pattern: string, revision: string) => string
}

interface ExportModule {
  exportPackages: (options: {
    rootDir: string
    sourcePath: string
    finalizedPath: string
    dryRun?: boolean
  }) => { exported: boolean, files: number, hashesMatch?: boolean }
}

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const syncScript = path.join(roleRoot, '.sync', 'scripts', 'sync-moluoxixi-upstream.mjs')
const exportScript = path.join(roleRoot, '.sync', 'scripts', 'export-moluoxixi-upstream.mjs')
const maintenanceDescribe = fs.existsSync(syncScript) && fs.existsSync(exportScript) ? describe : describe.skip
const roots: string[] = []

const packageMappings = [
  { upstreamPath: 'packages/core', outputName: '@moluoxixi/airules-moluoxixi-core' },
  { upstreamPath: 'packages/cli', outputName: '@moluoxixi/airules-moluoxixi-cli' },
]

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function packageManifest(name: string, version: string): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    name,
    version,
    publishConfig: { access: 'public', provenance: true },
    repository: { type: 'git', url: 'https://github.com/moluoxixi/AIRules' },
    scripts: {
      'build': 'tsc',
      'lint:publish': 'publint --strict',
      'prepublishOnly': 'pnpm run test:publish && pnpm run build',
      'test:publish': 'vitest run',
      'typecheck': 'tsc --noEmit',
    },
  }
  if (name.endsWith('-cli')) {
    manifest.bin = {
      moluoxixi: './bin/moluoxixi.js',
      ml: './bin/moluoxixi.js',
    }
    manifest.dependencies = {
      '@moluoxixi/airules-moluoxixi-core': 'workspace:*',
    }
  }
  return manifest
}

function createRebuild(version = '0.6.16'): { branchName: string, rebuildDir: string, revision: string } {
  const rebuildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-sync-guard-'))
  roots.push(rebuildDir)
  git(rebuildDir, 'init')
  git(rebuildDir, 'config', 'user.email', 'test@example.com')
  git(rebuildDir, 'config', 'user.name', 'Moluoxixi Sync Test')
  fs.writeFileSync(path.join(rebuildDir, '.baseline'), '0.6.16\n')
  git(rebuildDir, 'add', '.baseline')
  git(rebuildDir, 'commit', '-m', 'upstream baseline')
  const revision = git(rebuildDir, 'rev-parse', 'HEAD')
  const branchName = `moluoxixi/rebuild-${revision.slice(0, 12)}`
  git(rebuildDir, 'checkout', '-b', branchName)

  writeJson(
    path.join(rebuildDir, 'packages', 'core', 'package.json'),
    packageManifest('@moluoxixi/airules-moluoxixi-core', version),
  )
  writeJson(
    path.join(rebuildDir, 'packages', 'cli', 'package.json'),
    packageManifest('@moluoxixi/airules-moluoxixi-cli', version),
  )
  git(rebuildDir, 'add', 'packages')
  git(rebuildDir, 'commit', '-m', `chore(sync): rebuild ${revision.slice(0, 12)}`)
  return { branchName, rebuildDir, revision }
}

function setPackageVersions(rebuildDir: string, version: string): void {
  for (const mapping of packageMappings) {
    const packageJson = path.join(rebuildDir, ...mapping.upstreamPath.split('/'), 'package.json')
    const manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8'))
    manifest.version = version
    writeJson(packageJson, manifest)
  }
  git(rebuildDir, 'add', 'packages')
  git(rebuildDir, 'commit', '-m', `chore(release): set version ${version}`)
}

async function loadSyncModule(): Promise<SyncModule> {
  return import(pathToFileURL(syncScript).href) as Promise<SyncModule>
}

async function loadExportModule(): Promise<ExportModule> {
  return import(pathToFileURL(exportScript).href) as Promise<ExportModule>
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

maintenanceDescribe('moluoxixi sync export guard', () => {
  it('expands the declared rebuild branch pattern deterministically', async () => {
    const { expandRebuildBranch } = await loadSyncModule()
    expect(expandRebuildBranch('moluoxixi/rebuild-<short-revision>', '88f4834449da9b4f607ec05e322408a0aa66f2ce'))
      .toBe('moluoxixi/rebuild-88f4834449da')
  })

  it('rejects a pure identity transform at the upstream version', async () => {
    const { assertExportReady } = await loadSyncModule()
    const fixture = createRebuild()
    expect(() => assertExportReady({
      ...fixture,
      outputVersion: '0.6.23',
      packages: packageMappings,
    })).toThrow('output version mismatch')
  })

  it('rejects a rebuild checked out on the wrong branch', async () => {
    const { assertExportReady } = await loadSyncModule()
    const fixture = createRebuild('0.6.23')
    git(fixture.rebuildDir, 'branch', '-m', 'unexpected/rebuild')
    expect(() => assertExportReady({
      ...fixture,
      outputVersion: '0.6.23',
      packages: packageMappings,
    })).toThrow('rebuild branch mismatch')
  })

  it('rejects a dirty adapted rebuild', async () => {
    const { assertExportReady } = await loadSyncModule()
    const fixture = createRebuild()
    setPackageVersions(fixture.rebuildDir, '0.6.23')
    fs.appendFileSync(path.join(fixture.rebuildDir, 'packages', 'core', 'package.json'), '\n')
    expect(() => assertExportReady({
      ...fixture,
      outputVersion: '0.6.23',
      packages: packageMappings,
    })).toThrow('rebuild worktree is dirty')
  })

  it('accepts a clean adapted rebuild with the expected branch and contracts', async () => {
    const { assertExportReady } = await loadSyncModule()
    const fixture = createRebuild()
    setPackageVersions(fixture.rebuildDir, '0.6.23')
    expect(assertExportReady({
      ...fixture,
      outputVersion: '0.6.23',
      packages: packageMappings,
    })).toMatchObject({
      branch: fixture.branchName,
      outputVersion: '0.6.23',
    })
  })

  it('clears an existing finalized target without removing its root', async () => {
    const { exportPackages } = await loadExportModule()
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-export-'))
    roots.push(root)
    const source = path.join(root, 'source')
    const target = path.join(root, 'target')
    fs.mkdirSync(path.join(source, 'packages'), { recursive: true })
    fs.writeFileSync(path.join(source, 'packages', 'package.json'), '{"version":"0.6.23"}\n')
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(path.join(target, 'stale.txt'), 'remove me\n')

    const result = exportPackages({
      rootDir: root,
      sourcePath: 'source',
      finalizedPath: 'target',
    })

    expect(result).toMatchObject({ exported: true, files: 1, hashesMatch: true })
    expect(fs.existsSync(target)).toBe(true)
    expect(fs.existsSync(path.join(target, 'stale.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(target, 'packages', 'package.json'), 'utf8'))
      .toBe('{"version":"0.6.23"}\n')
  })

  it('recursively clears a finalized directory whose root cannot be removed', async () => {
    const { exportPackages } = await loadExportModule()
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-export-locked-'))
    roots.push(root)
    const source = path.join(root, 'source')
    const target = path.join(root, 'target')
    const lockedDir = path.join(target, 'cli')
    fs.mkdirSync(path.join(source, 'cli'), { recursive: true })
    fs.writeFileSync(path.join(source, 'cli', 'package.json'), '{"version":"0.6.23"}\n')
    fs.mkdirSync(lockedDir, { recursive: true })
    fs.writeFileSync(path.join(lockedDir, 'stale.txt'), 'remove me\n')

    const originalRmSync = fs.rmSync.bind(fs)
    let injected = false
    vi.spyOn(fs, 'rmSync').mockImplementation((entryPath, options) => {
      if (!injected && path.resolve(String(entryPath)) === lockedDir) {
        injected = true
        throw Object.assign(new Error('simulated locked directory'), { code: 'EPERM' })
      }
      originalRmSync(entryPath, options)
    })

    const result = exportPackages({
      rootDir: root,
      sourcePath: 'source',
      finalizedPath: 'target',
    })

    expect(result).toMatchObject({ exported: true, files: 1, hashesMatch: true })
    expect(injected).toBe(true)
    expect(fs.existsSync(lockedDir)).toBe(true)
    expect(fs.existsSync(path.join(lockedDir, 'stale.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(lockedDir, 'package.json'), 'utf8'))
      .toBe('{"version":"0.6.23"}\n')
  })
})
