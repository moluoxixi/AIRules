import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'

interface InitSummary {
  conflicts: string[]
  created: string[]
  platforms: string[]
  preserved: string[]
  unchanged: string[]
  updated: string[]
}

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const initializer = path.join(skillRoot, 'scripts', 'init-project.mjs')
const assetRoot = path.join(skillRoot, 'assets', 'trellis-v0.6.7')
const roleRuntime = path.join(roleRoot, 'runtime', 'trellis.mjs')
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporaryProject(prefix = 'airules-init-project-'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temporaryRoots.push(root)
  return root
}

function runInitializer(projectRoot: string, args: string[] = []): { status: number, summary?: InitSummary, stderr: string } {
  const result = spawnSync(process.execPath, [
    initializer,
    '--project',
    projectRoot,
    '--python',
    pythonCommand,
    ...args,
  ], { encoding: 'utf8' })
  return {
    status: result.status ?? -1,
    summary: result.stdout ? JSON.parse(result.stdout) as InitSummary : undefined,
    stderr: result.stderr,
  }
}

function runRuntime(entry: string, args: string[], cwd: string): { status: number, stdout: string, stderr: string } {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8' })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}

function walkFiles(root: string): string[] {
  const files: string[] = []
  function visit(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory())
        visit(target)
      else if (entry.isFile())
        files.push(target)
      else throw new Error(`Unsupported test entry: ${target}`)
    }
  }
  visit(root)
  return files.sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

function snapshot(root: string): Record<string, string> {
  return Object.fromEntries(walkFiles(root).map(file => [
    path.relative(root, file).split(path.sep).join('/'),
    createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  ]))
}

function migratedAssetStats(): { bytes: number, files: number, hash: string } {
  const selectedRoots = ['templates', 'legal']
  const relativeFiles = selectedRoots.flatMap((selectedRoot) => {
    const root = path.join(assetRoot, selectedRoot)
    return walkFiles(root).map(file => path.relative(assetRoot, file).split(path.sep).join('/'))
  }).sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
  const hash = createHash('sha256')
  let bytes = 0
  for (const relativeFile of relativeFiles) {
    const content = fs.readFileSync(path.join(assetRoot, ...relativeFile.split('/')))
    bytes += content.byteLength
    hash.update(`${relativeFile}\0${content.byteLength}\0`)
    hash.update(content)
  }
  return { bytes, files: relativeFiles.length, hash: hash.digest('hex') }
}

describe('moluoxixi init-project skill', () => {
  it('pins the migrated Trellis project templates and legal files', () => {
    expect(migratedAssetStats()).toEqual({
      bytes: 1158179,
      files: 201,
      hash: '73304babc368d4283823954607b0926160377d42151402bbc8e62efca42d82cc',
    })
    expect(walkFiles(path.join(assetRoot, 'templates')).some(file => path.basename(file) === 'index.ts')).toBe(false)
    expect(fs.readFileSync(path.join(assetRoot, 'legal', 'LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE')
  })

  it('plans every supported platform without invoking or writing anything', () => {
    const projectRoot = temporaryProject()
    const result = runInitializer(projectRoot, ['--platform', 'all', '--dry-run'])
    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(result.summary?.platforms).toHaveLength(18)
    expect(result.summary?.conflicts).toEqual([])
    expect(result.summary?.created).toEqual(expect.arrayContaining([
      '.trellis/scripts/task.py',
      '.trellis/runtime/trellis.mjs',
      '.trellis/runtime/update/scripts/init-project.mjs',
      '.claude/settings.json',
      '.claude/skills/trellis-channel/scripts/trellis.mjs',
      '.codex/config.toml',
      '.github/copilot/hooks.json',
      '.omp/extensions/trellis/index.ts',
      '.pi/extensions/trellis/index.ts',
    ]))
    expect(fs.readdirSync(projectRoot)).toEqual([])
  })

  it('initializes shared runtime and selected platforms idempotently', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'claude,codex', '--developer', 'tester']
    const first = runInitializer(projectRoot, args)
    expect(first).toMatchObject({ status: 0, stderr: '' })
    expect(first.summary?.conflicts).toEqual([])
    expect(fs.existsSync(path.join(projectRoot, '.trellis', 'scripts', 'task.py'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.trellis', 'runtime', 'source', 'packages', 'core', 'src', 'channel', 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.trellis', 'runtime', 'update', 'assets', 'trellis-v0.6.7', 'templates', 'trellis', 'workflow.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml'))).toBe(true)
    expect(fs.readFileSync(path.join(projectRoot, '.trellis', '.developer'), 'utf8')).toBe('tester\n')
    expect(fs.readFileSync(path.join(projectRoot, '.trellis', 'THIRD_PARTY_NOTICES.md'), 'utf8')).toContain('AIRules replaced the upstream initializer')
    expect(fs.readFileSync(path.join(projectRoot, '.trellis', 'scripts', 'common', 'session_context.py'), 'utf8')).not.toContain('["trellis", "--version"]')
    const launcher = path.join(projectRoot, '.agents', 'skills', 'trellis-channel', 'scripts', 'trellis.mjs')
    expect(runRuntime(launcher, ['--version'], projectRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.6.7-airules.1\n' })
    const initialSnapshot = snapshot(projectRoot)

    const second = runInitializer(projectRoot, args)
    expect(second).toMatchObject({ status: 0, stderr: '' })
    expect(second.summary?.created).toEqual([])
    expect(second.summary?.updated).toEqual([])
    expect(snapshot(projectRoot)).toEqual(initialSnapshot)

    const projectRuntime = path.join(projectRoot, '.trellis', 'runtime', 'trellis.mjs')
    const update = runRuntime(projectRuntime, ['update', '--dry-run'], projectRoot)
    expect(update).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(update.stdout)).toMatchObject({ conflicts: [], created: [], updated: [] })
  })

  it('provides local channel and memory command surfaces without a Trellis package', () => {
    expect(runRuntime(roleRuntime, ['--version'], roleRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.6.7-airules.1\n' })
    expect(runRuntime(roleRuntime, ['mem', 'help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    expect(runRuntime(roleRuntime, ['channel', '--help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    const localSkillFiles = ['trellis-channel', 'trellis-meta', 'trellis-session-insight']
      .flatMap(skill => walkFiles(path.join(roleRoot, 'skills', skill)))
      .filter(file => file.endsWith('.md'))
    for (const file of localSkillFiles) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content).not.toMatch(/npm install -g @mindfoldhq\/trellis/u)
      expect(content).not.toMatch(/(^|[^\w.-])trellis (?:channel|mem|update|workflow|--version)/mu)
    }
  })

  it('merges managed configuration and preserves conflicting user files by default', () => {
    const projectRoot = temporaryProject()
    fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true })
    fs.mkdirSync(path.join(projectRoot, '.trellis'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# User rules\n')
    fs.writeFileSync(path.join(projectRoot, '.claude', 'settings.json'), '{"custom":true}\n')
    fs.writeFileSync(path.join(projectRoot, '.trellis', 'workflow.md'), '# User workflow\n')

    const preserved = runInitializer(projectRoot, ['--platform', 'claude'])
    expect(preserved.status).toBe(2)
    expect(preserved.summary?.conflicts).toContain('.trellis/workflow.md')
    expect(fs.readFileSync(path.join(projectRoot, '.trellis', 'workflow.md'), 'utf8')).toBe('# User workflow\n')
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toContain('# User rules')
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toContain('<!-- TRELLIS:START -->')
    const settings = JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8')) as Record<string, unknown>
    expect(settings.custom).toBe(true)
    expect(settings.hooks).toBeDefined()

    const forced = runInitializer(projectRoot, ['--platform', 'claude', '--force'])
    expect(forced.status).toBe(0)
    expect(fs.readFileSync(path.join(projectRoot, '.trellis', 'workflow.md'), 'utf8')).not.toBe('# User workflow\n')
  })

  it('stages all local skills and the complete role runtime', async () => {
    const root = temporaryProject('airules-init-project-staging-')
    const homeDir = path.join(root, 'home')
    const repository = path.join(homeDir, 'vendor', 'repos', 'moluoxixi')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'moluoxixi'), { recursive: true })
    const manifestPath = path.join(root, 'manifest.mjs')
    fs.writeFileSync(manifestPath, `export const vendors = ${JSON.stringify([{
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [
        { kind: 'role-assets', sourceDir: 'roles/moluoxixi' },
      ],
    }])}\n`)

    const inventory = await rebuildVendorAssets({ homeDir, role: 'moluoxixi', manifestPath })
    expect(inventory.skills).toContain('init-project')
    expect(inventory.skills).toContain('trellis-channel')
    expect(inventory.skills).toContain('trellis-session-insight')
    const staged = path.join(homeDir, 'vendor', 'skills', 'init-project')
    expect(fs.existsSync(path.join(staged, 'scripts', 'init-project.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'references', 'platforms.md'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'assets', 'trellis-v0.6.7', 'templates', 'trellis', 'workflow.md'))).toBe(true)
    const channelLauncher = path.join(homeDir, 'vendor', 'skills', 'trellis-channel', 'scripts', 'trellis.mjs')
    expect(fs.existsSync(channelLauncher)).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'moluoxixi', 'runtime', 'trellis.mjs'))).toBe(true)
    expect(runRuntime(channelLauncher, ['--version'], root)).toMatchObject({ status: 0, stderr: '', stdout: '0.6.7-airules.1\n' })
  })
})
