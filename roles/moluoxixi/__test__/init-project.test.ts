import { Buffer } from 'node:buffer'
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
  manifest: string
  packages: Array<{ name: string, path: string, type: string }>
  platforms: string[]
  preserved: string[]
  proposed: string[]
  removed: string[]
  restored: string[]
  unchanged: string[]
  updated: string[]
  warnings: string[]
}

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const initializer = path.join(skillRoot, 'scripts', 'init-project.mjs')
const assetRoot = path.join(skillRoot, 'assets')
const roleRuntime = path.join(skillRoot, 'assets', 'runtime', 'moluoxixi.mjs')
const legacyBrand = ['tre', 'llis'].join('')
const legacyProjectRoot = `.${legacyBrand}`
const projectSkillNames = [
  'before-dev',
  'brainstorm',
  'break-loop',
  'channel',
  'check',
  'continue',
  'finish-work',
  'first-principles-thinking',
  'meta',
  'python-design',
  'session-insight',
  'spec-bootstrap',
  'start',
  'ts-sdk-author',
  'update-spec',
]
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

function runInitializer(projectRoot: string, args: string[] = [], entry = initializer): { status: number, summary?: InitSummary, stderr: string } {
  const result = spawnSync(process.execPath, [
    entry,
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

function contentHash(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex')
}

function migratedAssetStats(): { bytes: number, files: number, hash: string } {
  const selectedRoots = ['hosts', 'project', 'shared']
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

describe('init-project skill', () => {
  it('pins the migrated Moluoxixi project templates', () => {
    expect(migratedAssetStats()).toEqual({
      bytes: 1618041,
      files: 242,
      hash: '93b43ceea56837f1a08cd15ee499de307de9de8028f725c18e5b1ab92f80e17e',
    })
    expect(fs.existsSync(path.join(assetRoot, 'moluoxixi-v0.6.7'))).toBe(false)
    expect(fs.existsSync(path.join(assetRoot, 'legal', 'LICENSE'))).toBe(false)
    expect(fs.existsSync(path.join(assetRoot, 'legal', 'COPYRIGHT'))).toBe(false)
  })

  it('plans every supported platform without invoking or writing anything', () => {
    const projectRoot = temporaryProject()
    const result = runInitializer(projectRoot, ['--platform', 'all', '--dry-run'])
    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(result.summary?.platforms).toHaveLength(18)
    expect(result.summary?.conflicts).toEqual([])
    expect(result.summary?.manifest).toBe('.moluoxixi/airules-init-manifest.json')
    expect(result.summary?.warnings).toContain('Codex hooks require [features].hooks = true and one-time /hooks approval in the project.')
    expect(result.summary?.created).toEqual(expect.arrayContaining([
      '.moluoxixi/scripts/task.py',
      '.moluoxixi/runtime/moluoxixi.mjs',
      '.moluoxixi/runtime/update/init-project/scripts/init-project.mjs',
      '.claude/settings.json',
      '.claude/skills/channel/scripts/moluoxixi.mjs',
      '.codex/config.toml',
      '.gemini/commands/moluoxixi/continue.toml',
      '.gemini/commands/moluoxixi/finish-work.toml',
      '.github/copilot/hooks.json',
      '.omp/extensions/moluoxixi/index.ts',
      '.pi/extensions/moluoxixi/index.ts',
    ]))
    const plannedSkillNames = result.summary?.created
      .filter(relativePath => !relativePath.startsWith('.moluoxixi/runtime/update/'))
      .filter(relativePath => !relativePath.startsWith('.reasonix/skills/moluoxixi-'))
      .map(relativePath => relativePath.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/u)?.[1])
      .filter((name): name is string => name !== undefined) ?? []
    expect([...new Set(plannedSkillNames)]).toEqual(expect.arrayContaining(projectSkillNames))
    expect(plannedSkillNames.every(name => !name.startsWith('moluoxixi-'))).toBe(true)
    expect(result.summary?.created).not.toContain('.claude/hooks/statusline.py')
    const updaterBundledSkillPrefix = '.moluoxixi/runtime/update/init-project/assets/shared/skills/'
    const updaterBundledSkillNames = result.summary?.created
      .filter(relativePath => relativePath.startsWith(updaterBundledSkillPrefix) && relativePath.endsWith('/SKILL.md'))
      .map(relativePath => relativePath.slice(updaterBundledSkillPrefix.length).split('/')[0])
      .sort() ?? []
    expect(updaterBundledSkillNames).toEqual(projectSkillNames)
    expect(fs.readdirSync(projectRoot)).toEqual([])

    const statusline = runInitializer(projectRoot, ['--platform', 'claude', '--with-statusline'])
    expect(statusline).toMatchObject({ status: 0, stderr: '' })
    expect(statusline.summary?.created).toContain('.claude/hooks/statusline.py')
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8'))).toMatchObject({
      statusLine: {
        type: 'command',
        command: `${pythonCommand} .claude/hooks/statusline.py`,
      },
    })

    const aliasRoot = temporaryProject()
    const alias = runInitializer(aliasRoot, ['--platform', 'windsurf', '--dry-run'])
    expect(alias).toMatchObject({ status: 0, stderr: '' })
    expect(alias.summary?.platforms).toEqual(['devin'])
  })

  it('initializes shared runtime and selected platforms idempotently', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'claude,codex', '--developer', 'tester']
    const first = runInitializer(projectRoot, args)
    expect(first).toMatchObject({ status: 0, stderr: '' })
    expect(first.summary?.conflicts).toEqual([])
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'scripts', 'task.py'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'runtime', 'source', 'packages', 'core', 'src', 'channel', 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'runtime', 'update', 'init-project', 'assets', 'project', 'workflow.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, legacyProjectRoot))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8'))).not.toHaveProperty('statusLine')
    expect(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml'))).toBe(true)
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', '.developer'), 'utf8')).toMatch(/^name=tester\ninitialized_at=/u)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'tasks', '00-bootstrap-guidelines', 'task.json'))).toBe(true)
    const developerProbe = spawnSync(pythonCommand, [path.join(projectRoot, '.moluoxixi', 'scripts', 'get_developer.py')], { cwd: projectRoot, encoding: 'utf8' })
    expect(developerProbe).toMatchObject({ status: 0, stderr: '' })
    expect(developerProbe.stdout).toContain('tester')
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'LICENSE'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'COPYRIGHT'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'THIRD_PARTY_NOTICES.md'))).toBe(false)
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'scripts', 'common', 'session_context.py'), 'utf8')).not.toContain('["moluoxixi", "--version"]')
    const updaterBundledSkillsRoot = path.join(projectRoot, '.moluoxixi', 'runtime', 'update', 'init-project', 'assets', 'shared', 'skills')
    const updaterBundledSkillNames = fs.readdirSync(updaterBundledSkillsRoot).sort()
    expect(updaterBundledSkillNames).toEqual(projectSkillNames)
    for (const skillName of updaterBundledSkillNames) {
      const content = fs.readFileSync(path.join(updaterBundledSkillsRoot, skillName, 'SKILL.md'), 'utf8')
      expect(content).toMatch(new RegExp(`^name: ${skillName}$`, 'mu'))
    }
    const projectedRoots = [
      path.join(projectRoot, '.moluoxixi', 'scripts'),
      path.join(projectRoot, '.moluoxixi', 'agents'),
      path.join(projectRoot, '.moluoxixi', 'spec'),
      path.join(projectRoot, '.moluoxixi', 'workspace'),
      path.join(projectRoot, '.agents'),
      path.join(projectRoot, '.claude'),
      path.join(projectRoot, '.codex'),
    ]
    const projectedFiles = projectedRoots.flatMap(root => walkFiles(root))
    projectedFiles.push(path.join(projectRoot, '.moluoxixi', 'workflow.md'))
    projectedFiles.push(path.join(projectRoot, '.moluoxixi', 'config.yaml'))
    projectedFiles.push(path.join(projectRoot, 'AGENTS.md'))
    expect(projectedFiles.filter(file => fs.readFileSync(file, 'utf8').includes(legacyProjectRoot))).toEqual([])
    const projectedSkillFiles = walkFiles(projectRoot).filter((file) => {
      const relativePath = path.relative(projectRoot, file).split(path.sep).join('/')
      return !relativePath.startsWith('.moluoxixi/runtime/update/')
        && /(?:^|\/)skills\/[^/]+\/SKILL\.md$/u.test(relativePath)
    })
    expect(projectedSkillFiles.length).toBeGreaterThan(0)
    for (const file of projectedSkillFiles) {
      const relativePath = path.relative(projectRoot, file).split(path.sep).join('/')
      const name = relativePath.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/u)?.[1]
      expect(name).not.toMatch(/^moluoxixi-/u)
      expect(fs.readFileSync(file, 'utf8')).toMatch(new RegExp(`^name: ${name}$`, 'mu'))
    }
    expect([...new Set(projectedSkillFiles.map(file => path.basename(path.dirname(file))))]).toEqual(expect.arrayContaining(projectSkillNames))
    const launcher = path.join(projectRoot, '.agents', 'skills', 'channel', 'scripts', 'moluoxixi.mjs')
    expect(runRuntime(launcher, ['--version'], projectRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.6.7-airules.1\n' })
    const initialSnapshot = snapshot(projectRoot)

    const second = runInitializer(projectRoot, args)
    expect(second).toMatchObject({ status: 0, stderr: '' })
    expect(second.summary?.created).toEqual([])
    expect(second.summary?.updated).toEqual([])
    expect(snapshot(projectRoot)).toEqual(initialSnapshot)

    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const update = runRuntime(projectRuntime, ['update', '--dry-run'], projectRoot)
    expect(update).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(update.stdout)).toMatchObject({ conflicts: [], created: [], updated: [] })
    const workflow = runRuntime(projectRuntime, ['workflow', '--force'], projectRoot)
    expect(workflow).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).not.toContain(legacyProjectRoot)
  })

  it('adapts pull-based agents for every host that cannot inject sub-agent context', () => {
    const projectRoot = temporaryProject()
    const initialized = runInitializer(projectRoot, ['--platform', 'all'])
    expect(initialized).toMatchObject({ status: 0, stderr: '' })

    const agentRoots = [
      ['.codex/agents', '.toml'],
      ['.gemini/agents', '.md'],
      ['.qoder/agents', '.md'],
      ['.github/agents', '.agent.md'],
      ['.pi/agents', '.md'],
      ['.zcode/agents', '.md'],
      ['.trae/agents', '.md'],
    ] as const
    for (const [agentRoot, extension] of agentRoots) {
      for (const agentType of ['implement', 'check']) {
        const content = fs.readFileSync(path.join(projectRoot, ...agentRoot.split('/'), `moluoxixi-${agentType}${extension}`), 'utf8')
        expect(content).toContain('## Required: Load Moluoxixi Context First')
        expect(content).toContain('Active task: <path>')
        expect(content).toContain(`/${agentType}.jsonl`)
      }
      const research = fs.readFileSync(path.join(projectRoot, ...agentRoot.split('/'), `moluoxixi-research${extension}`), 'utf8')
      expect(research).not.toContain('## Required: Load Moluoxixi Context First')
    }

    const copilotAgent = fs.readFileSync(path.join(projectRoot, '.github', 'agents', 'moluoxixi-implement.agent.md'), 'utf8')
    expect(copilotAgent).toMatch(/^tools:\n(?: {2}- (?:read|edit|execute|search)\n)+/mu)
    expect(copilotAgent).not.toMatch(/^tools:\s*Read/mu)
  })

  it('projects reviewed monorepo packages and preserves them during local updates', () => {
    const projectRoot = temporaryProject()
    const args = [
      '--platform',
      'codex',
      '--package',
      'web=packages/web:frontend',
      '--package',
      'api=services/api:backend',
      '--default-package',
      'web',
    ]
    const initialized = runInitializer(projectRoot, args)
    expect(initialized).toMatchObject({ status: 0, stderr: '' })
    expect(initialized.summary?.packages).toEqual([
      { name: 'api', path: 'services/api', type: 'backend' },
      { name: 'web', path: 'packages/web', type: 'frontend' },
    ])
    const config = fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'config.yaml'), 'utf8')
    expect(config).toContain('"api":\n    path: "services/api"')
    expect(config).toContain('default_package: "web"')
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'api', 'backend', 'index.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'api', 'frontend'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'web', 'frontend', 'index.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'web', 'backend'))).toBe(false)

    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const updated = runRuntime(projectRuntime, ['update', '--dry-run'], projectRoot)
    expect(updated).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(updated.stdout)).toMatchObject({ conflicts: [], created: [], updated: [] })
  })

  it('treats explicit monorepo mode switches as authoritative', () => {
    const projectRoot = temporaryProject()
    const missing = runInitializer(projectRoot, ['--platform', 'codex', '--monorepo'])
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('no workspace packages were detected')

    const emptyWorkspaceRoot = temporaryProject()
    fs.writeFileSync(path.join(emptyWorkspaceRoot, 'package.json'), '{"workspaces":["packages/*"]}\n')
    const emptyWorkspace = runInitializer(emptyWorkspaceRoot, ['--platform', 'codex', '--monorepo'])
    expect(emptyWorkspace.status).toBe(1)
    expect(emptyWorkspace.stderr).toContain('no workspace packages were detected')

    expect(runInitializer(projectRoot, [
      '--platform',
      'codex',
      '--package',
      'web=packages/web:frontend',
    ])).toMatchObject({ status: 0, stderr: '' })
    const single = runInitializer(projectRoot, ['--platform', 'codex', '--no-monorepo'])
    expect(single).toMatchObject({ status: 0, stderr: '' })
    expect(single.summary?.packages).toEqual([])
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'), 'utf8')) as {
      project: { defaultPackage?: string, packages: unknown[] }
    }
    expect(manifest.project.packages).toEqual([])
    expect(manifest.project.defaultPackage).toBeUndefined()
  })

  it('re-detects project type and permits an explicit override', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'codex'])).toMatchObject({ status: 0, stderr: '' })
    fs.writeFileSync(path.join(projectRoot, 'package.json'), '{"dependencies":{"react":"latest"}}\n')

    const detected = runInitializer(projectRoot, ['--platform', 'codex'])
    expect(detected).toMatchObject({ status: 0, stderr: '' })
    expect(detected.summary).toMatchObject({ projectType: 'frontend' })
    const overridden = runInitializer(projectRoot, ['--platform', 'codex', '--project-type', 'backend'])
    expect(overridden).toMatchObject({ status: 0, stderr: '' })
    expect(overridden.summary).toMatchObject({ projectType: 'backend' })
  })

  it('reuses an existing developer workspace without overwriting journals', () => {
    const projectRoot = temporaryProject()
    const workspace = path.join(projectRoot, '.moluoxixi', 'workspace', 'tester')
    fs.mkdirSync(workspace, { recursive: true })
    fs.writeFileSync(path.join(workspace, 'journal-1.md'), '# Existing journal\n')
    fs.writeFileSync(path.join(workspace, 'index.md'), '# Existing index\n')

    const initialized = runInitializer(projectRoot, ['--platform', 'codex', '--developer', 'tester'])

    expect(initialized).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(workspace, 'journal-1.md'), 'utf8')).toBe('# Existing journal\n')
    expect(fs.readFileSync(path.join(workspace, 'index.md'), 'utf8')).toBe('# Existing index\n')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', '.developer'), 'utf8')).toContain('name=tester')
  })

  it('migrates pristine legacy managed paths, JSON entries, and managed blocks', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'claude,opencode,pi']
    expect(runInitializer(projectRoot, args)).toMatchObject({ status: 0, stderr: '' })

    const manifestPath = path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      entries: Record<string, { baselineHash: string, mode: string, platform: string, templateHash: string }>
      schemaVersion: number
      [key: string]: unknown
    }
    const legacyTitle = `${legacyBrand[0].toUpperCase()}${legacyBrand.slice(1)}`
    const legacyUpper = legacyBrand.toUpperCase()
    const legacyize = (content: string): string => content
      .replaceAll('MOLUOXIXI', legacyUpper)
      .replaceAll('Moluoxixi', legacyTitle)
      .replaceAll('moluoxixi', legacyBrand)
    const renames = [
      ['.claude/commands/moluoxixi/continue.md', `.claude/commands/${legacyBrand}/continue.md`],
      ['.opencode/lib/moluoxixi-context.js', `.opencode/lib/${legacyBrand}-context.js`],
      ['.pi/extensions/moluoxixi/index.ts', `.pi/extensions/${legacyBrand}/index.ts`],
      ['.moluoxixi/runtime/moluoxixi.mjs', `.moluoxixi/runtime/${legacyBrand}.mjs`],
    ] as const

    for (const [currentPath, legacyPath] of renames) {
      const currentTarget = path.join(projectRoot, ...currentPath.split('/'))
      const legacyTarget = path.join(projectRoot, ...legacyPath.split('/'))
      const legacyContent = legacyize(fs.readFileSync(currentTarget, 'utf8'))
      fs.mkdirSync(path.dirname(legacyTarget), { recursive: true })
      fs.writeFileSync(legacyTarget, legacyContent)
      fs.rmSync(currentTarget)
      manifest.entries[legacyPath] = {
        ...manifest.entries[currentPath],
        baselineHash: contentHash(legacyContent),
      }
      delete manifest.entries[currentPath]
    }

    for (const relativePath of ['.pi/settings.json', 'AGENTS.md']) {
      const target = path.join(projectRoot, ...relativePath.split('/'))
      const legacyContent = legacyize(fs.readFileSync(target, 'utf8'))
      fs.writeFileSync(target, legacyContent)
      manifest.entries[relativePath].baselineHash = contentHash(legacyContent)
    }
    manifest[`${legacyBrand}Revision`] = manifest.upstreamRevision
    delete manifest.upstreamRevision
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const migrated = runInitializer(projectRoot, args)
    expect(migrated).toMatchObject({ status: 0, stderr: '' })
    expect(migrated.summary?.conflicts).toEqual([])
    expect(migrated.summary?.removed).toEqual(expect.arrayContaining(renames.map(([, legacyPath]) => legacyPath)))
    for (const [currentPath, legacyPath] of renames) {
      expect(fs.existsSync(path.join(projectRoot, ...currentPath.split('/')))).toBe(true)
      expect(fs.existsSync(path.join(projectRoot, ...legacyPath.split('/')))).toBe(false)
    }
    expect(fs.readFileSync(path.join(projectRoot, '.pi', 'settings.json'), 'utf8')).not.toContain(legacyBrand)
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).not.toContain(legacyUpper)
    const nextManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { entries: Record<string, unknown>, upstreamRevision?: string, [key: string]: unknown }
    expect(nextManifest.upstreamRevision).toBe('e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a')
    expect(nextManifest[`${legacyBrand}Revision`]).toBeUndefined()
    expect(Object.keys(nextManifest.entries).filter(relativePath => relativePath.toLowerCase().includes(legacyBrand))).toEqual([])
  })

  it('preserves user-modified legacy managed files until force is explicit', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'pi']
    expect(runInitializer(projectRoot, args)).toMatchObject({ status: 0, stderr: '' })

    const manifestPath = path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      entries: Record<string, { baselineHash: string, mode: string, platform: string, templateHash: string }>
      schemaVersion: number
    }
    const currentPath = '.pi/extensions/moluoxixi/index.ts'
    const legacyPath = `.pi/extensions/${legacyBrand}/index.ts`
    const currentTarget = path.join(projectRoot, ...currentPath.split('/'))
    const legacyTarget = path.join(projectRoot, ...legacyPath.split('/'))
    const legacyContent = fs.readFileSync(currentTarget, 'utf8').replaceAll('moluoxixi', legacyBrand)
    fs.mkdirSync(path.dirname(legacyTarget), { recursive: true })
    fs.writeFileSync(legacyTarget, `${legacyContent}\n// user edit\n`)
    fs.rmSync(currentTarget)
    manifest.entries[legacyPath] = {
      ...manifest.entries[currentPath],
      baselineHash: contentHash(legacyContent),
    }
    delete manifest.entries[currentPath]
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const preserved = runInitializer(projectRoot, args)
    expect(preserved.status).toBe(2)
    expect(preserved.summary?.conflicts).toContain(legacyPath)
    expect(fs.existsSync(legacyTarget)).toBe(true)
    expect(fs.existsSync(currentTarget)).toBe(true)

    const forced = runInitializer(projectRoot, [...args, '--force'])
    expect(forced).toMatchObject({ status: 0, stderr: '' })
    expect(fs.existsSync(legacyTarget)).toBe(false)
    expect(fs.existsSync(currentTarget)).toBe(true)
  })

  it('retires obsolete owned files while preserving installed hosts and modified retired files', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'codex'])).toMatchObject({ status: 0, stderr: '' })
    const manifestPath = path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      entries: Record<string, { baselineHash: string, mode: string, platform: string, templateHash: string }>
      schemaVersion: number
    }
    const pristinePath = '.codex/retired-pristine.txt'
    const modifiedPath = '.codex/retired-modified.txt'
    const baseline = 'retired baseline\n'
    manifest.schemaVersion = 1
    for (const relativePath of [pristinePath, modifiedPath]) {
      fs.writeFileSync(path.join(projectRoot, ...relativePath.split('/')), baseline)
      manifest.entries[relativePath] = {
        baselineHash: contentHash(baseline),
        mode: 'replace',
        platform: 'codex',
        templateHash: contentHash(baseline),
      }
    }
    fs.appendFileSync(path.join(projectRoot, ...modifiedPath.split('/')), 'user edit\n')
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const migrated = runInitializer(projectRoot, ['--platform', 'claude'])
    expect(migrated.status).toBe(2)
    expect(migrated.summary?.platforms).toEqual(expect.arrayContaining(['claude', 'codex']))
    expect(migrated.summary?.removed).toContain(pristinePath)
    expect(migrated.summary?.conflicts).toContain(modifiedPath)
    expect(fs.existsSync(path.join(projectRoot, ...pristinePath.split('/')))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, ...modifiedPath.split('/')))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml'))).toBe(true)
  })

  it('uninstalls only manifest-owned files and preserves unknown project data', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'claude'])).toMatchObject({ status: 0, stderr: '' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const unknown = path.join(projectRoot, '.moluoxixi', 'tasks', 'user-note.md')
    fs.writeFileSync(unknown, '# Keep me\n')

    const preview = runRuntime(projectRuntime, ['uninstall', '--dry-run'], projectRoot)
    expect(preview).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(preview.stdout)).toMatchObject({ conflicts: [], dryRun: true })
    expect(fs.existsSync(projectRuntime)).toBe(true)

    const removed = runRuntime(projectRuntime, ['uninstall', '--yes'], projectRoot)
    expect(removed).toMatchObject({ status: 0, stderr: '' })
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'))).toBe(false)
    expect(fs.readFileSync(unknown, 'utf8')).toBe('# Keep me\n')
    expect(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json'))).toBe(false)
  })

  it('restores pre-existing JSON and managed-block files during uninstall', () => {
    const projectRoot = temporaryProject()
    const agents = '# User rules\n'
    const settings = '{"custom":true}\n'
    const codex = 'model = "gpt-test"\n'
    fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true })
    fs.mkdirSync(path.join(projectRoot, '.codex'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), agents)
    fs.writeFileSync(path.join(projectRoot, '.claude', 'settings.json'), settings)
    fs.writeFileSync(path.join(projectRoot, '.codex', 'config.toml'), codex)

    expect(runInitializer(projectRoot, ['--platform', 'claude,codex'])).toMatchObject({ status: 0, stderr: '' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const removed = runRuntime(projectRuntime, ['uninstall', '--yes'], projectRoot)
    expect(removed).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toBe(agents)
    expect(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8')).toBe(settings)
    expect(fs.readFileSync(path.join(projectRoot, '.codex', 'config.toml'), 'utf8')).toBe(codex)
  })

  it('reports modified owned files as uninstall conflicts without deleting during review', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'claude'])).toMatchObject({ status: 0, stderr: '' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const workflow = path.join(projectRoot, '.moluoxixi', 'workflow.md')
    fs.appendFileSync(workflow, '\n# User edit\n')

    const preview = runRuntime(projectRuntime, ['uninstall', '--dry-run'], projectRoot)
    expect(preview.status).toBe(2)
    expect(JSON.parse(preview.stdout).conflicts).toContain('.moluoxixi/workflow.md')
    expect(fs.readFileSync(workflow, 'utf8')).toContain('# User edit')
    expect(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json'))).toBe(true)
  })

  it('keeps uninstall confirmation separate from force replacement', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'claude'])).toMatchObject({ status: 0, stderr: '' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const workflow = path.join(projectRoot, '.moluoxixi', 'workflow.md')
    fs.appendFileSync(workflow, '\n# User edit\n')

    const refused = runRuntime(projectRuntime, ['uninstall'], projectRoot)
    expect(refused.status).toBe(1)
    expect(refused.stderr).toContain('requires --yes')
    const confirmed = runRuntime(projectRuntime, ['uninstall', '-y'], projectRoot)
    expect(confirmed.status).toBe(2)
    expect(JSON.parse(confirmed.stdout).conflicts).toContain('.moluoxixi/workflow.md')
    expect(fs.readFileSync(workflow, 'utf8')).toContain('# User edit')
  })

  it('provides local channel and memory command surfaces without an upstream package install', () => {
    expect(runRuntime(roleRuntime, ['--version'], roleRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.6.7-airules.1\n' })
    expect(runRuntime(roleRuntime, ['-v'], roleRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.6.7-airules.1\n' })
    expect(runRuntime(roleRuntime, ['update', '--help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    expect(runRuntime(roleRuntime, ['workflow', '--help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    expect(runRuntime(roleRuntime, ['mem', 'help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    expect(runRuntime(roleRuntime, ['channel', '--help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    const localSkillFiles = ['channel', 'meta', 'session-insight']
      .flatMap(skill => walkFiles(path.join(skillRoot, 'assets', 'shared', 'skills', skill)))
      .filter(file => file.endsWith('.md'))
    for (const file of localSkillFiles) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content).not.toContain(`npm install -g @mindfoldhq/${legacyBrand}`)
      expect(content).not.toMatch(/(^|[^\w.-])moluoxixi (?:channel|mem|update|workflow|--version)/mu)
    }
  })

  it('merges managed configuration and preserves conflicting user files by default', () => {
    const projectRoot = temporaryProject()
    fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true })
    fs.mkdirSync(path.join(projectRoot, '.moluoxixi'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# User rules\n')
    fs.writeFileSync(path.join(projectRoot, '.claude', 'settings.json'), '{"custom":true}\n')
    fs.writeFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), '# User workflow\n')

    const preserved = runInitializer(projectRoot, ['--platform', 'claude'])
    expect(preserved.status).toBe(2)
    expect(preserved.summary?.conflicts).toContain('.moluoxixi/workflow.md')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).toBe('# User workflow\n')
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toContain('# User rules')
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toContain('<!-- MOLUOXIXI:START -->')
    const settings = JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8')) as Record<string, unknown>
    expect(settings.custom).toBe(true)
    expect(settings.hooks).toBeDefined()

    const proposed = runInitializer(projectRoot, ['--platform', 'claude', '--create-new'])
    expect(proposed.status).toBe(2)
    expect(proposed.summary?.proposed).toContain('.moluoxixi/workflow.md.new')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).toBe('# User workflow\n')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md.new'), 'utf8')).not.toBe('# User workflow\n')

    const forced = runInitializer(projectRoot, ['--platform', 'claude', '--force'])
    expect(forced.status).toBe(0)
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).not.toBe('# User workflow\n')
  })

  it('upgrades pristine owned JSON exactly and keeps user JSON overrides outside the baseline', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'pi']
    expect(runInitializer(projectRoot, args)).toMatchObject({ status: 0, stderr: '' })

    const settingsPath = path.join(projectRoot, '.pi', 'settings.json')
    const manifestPath = path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      entries: Record<string, { baselineContent?: string, baselineHash: string, templateContent?: string }>
    }
    const oldSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>
    oldSettings.enableSkillCommands = false
    const oldContent = `${JSON.stringify(oldSettings, null, 2)}\n`
    fs.writeFileSync(settingsPath, oldContent)
    manifest.entries['.pi/settings.json'].baselineHash = contentHash(oldContent)
    manifest.entries['.pi/settings.json'].baselineContent = Buffer.from(oldContent).toString('base64')
    manifest.entries['.pi/settings.json'].templateContent = Buffer.from(oldContent).toString('base64')
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const upgraded = runInitializer(projectRoot, args)
    expect(upgraded).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))).toMatchObject({ enableSkillCommands: true })

    const userSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>
    userSettings.enableSkillCommands = false
    fs.writeFileSync(settingsPath, `${JSON.stringify(userSettings, null, 2)}\n`)
    const preserved = runInitializer(projectRoot, args)
    expect(preserved).toMatchObject({ status: 0, stderr: '' })
    expect(preserved.summary?.preserved).toContain('.pi/settings.json')
    expect(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))).toMatchObject({ enableSkillCommands: false })
    const finalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { entries: Record<string, { baselineHash: string }> }
    expect(finalManifest.entries['.pi/settings.json'].baselineHash).not.toBe(contentHash(fs.readFileSync(settingsPath)))
  })

  it('appends versioned config sections without replacing user edits', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'codex']
    expect(runInitializer(projectRoot, args)).toMatchObject({ status: 0, stderr: '' })

    const configPath = path.join(projectRoot, '.moluoxixi', 'config.yaml')
    const manifestPath = path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json')
    const versionPath = path.join(projectRoot, '.moluoxixi', '.version')
    const current = fs.readFileSync(configPath, 'utf8')
    const oldTemplate = current.replace(/#-+\n# Codex \(dispatch behavior\)[\s\S]*$/u, '').replace(/\s*$/u, '\n')
    const userConfig = `${oldTemplate}\n# user setting\ncustom_value: true\n`
    fs.writeFileSync(configPath, userConfig)
    fs.writeFileSync(versionPath, '0.5.6\n')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      entries: Record<string, { baselineContent?: string, baselineHash: string, templateContent?: string }>
    }
    manifest.entries['.moluoxixi/config.yaml'].baselineHash = contentHash(oldTemplate)
    manifest.entries['.moluoxixi/config.yaml'].baselineContent = Buffer.from(oldTemplate).toString('base64')
    manifest.entries['.moluoxixi/config.yaml'].templateContent = Buffer.from(oldTemplate).toString('base64')
    manifest.entries['.moluoxixi/.version'].baselineHash = contentHash('0.5.6\n')
    manifest.entries['.moluoxixi/.version'].baselineContent = Buffer.from('0.5.6\n').toString('base64')
    manifest.entries['.moluoxixi/.version'].templateContent = Buffer.from('0.5.6\n').toString('base64')
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const upgraded = runInitializer(projectRoot, args)

    expect(upgraded.summary?.conflicts).toEqual([])
    expect(upgraded).toMatchObject({ status: 0, stderr: '' })
    expect(upgraded.summary?.updated).toContain('.moluoxixi/config.yaml')
    const next = fs.readFileSync(configPath, 'utf8')
    expect(next).toContain('# user setting\ncustom_value: true')
    expect(next).toContain('# Codex (dispatch behavior)')
    expect(next.match(/# Codex \(dispatch behavior\)/gu)).toHaveLength(1)
  })

  it('distributes only the self-contained initializer and runs it without the installed role', async () => {
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
    expect(inventory.skills).toEqual(['init-project'])
    const staged = path.join(homeDir, 'vendor', 'skills', 'init-project')
    expect(fs.existsSync(path.join(staged, 'scripts', 'init-project.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'references', 'platforms.md'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'assets', 'project', 'workflow.md'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'assets', 'runtime', 'moluoxixi.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'assets', 'shared', 'skills', 'channel', 'scripts', 'moluoxixi.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'AGENTS.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'moluoxixi', 'runtime'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'moluoxixi', 'agents'))).toBe(false)

    const standalone = path.join(root, 'standalone-init-project')
    fs.cpSync(staged, standalone, { recursive: true, dereference: true })
    fs.rmSync(path.join(homeDir, 'roles'), { recursive: true, force: true })
    fs.rmSync(repository, { recursive: true, force: true })
    const projectRoot = path.join(root, 'project')
    fs.mkdirSync(projectRoot)
    const installed = runInitializer(projectRoot, ['--platform', 'claude,codex'], path.join(standalone, 'scripts', 'init-project.mjs'))
    expect(installed).toMatchObject({ status: 0, stderr: '' })
    const channelLauncher = path.join(projectRoot, '.agents', 'skills', 'channel', 'scripts', 'moluoxixi.mjs')
    expect(runRuntime(channelLauncher, ['--version'], projectRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.6.7-airules.1\n' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    expect(runRuntime(projectRuntime, ['update', '--dry-run'], projectRoot)).toMatchObject({ status: 0, stderr: '' })
  }, 30_000)
})
