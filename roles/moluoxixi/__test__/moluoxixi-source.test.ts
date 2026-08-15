import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { extendsRoles, hosts, vendors } from '../constants/skills.js'

interface RoleManifest {
  assets: {
    mcp: string
    skills: string
  }
  canonical_root: string
  distribution: {
    bootstrap_manifest: string
    full_role_path_required: boolean
    npm_embedded_source: boolean
  }
  entrypoints: {
    initialize_project_script: string
    initialize_project_skill: string
    moluoxixi_runtime: string
  }
  role_id: string
  role_version: string
  third_party: {
    productivity_skills: {
      category: string
      name: string
      revision: string
      source: string
    }
    upstream: {
      name: string
      paths: string[]
      reconciliation: string
      revision: string
      source: string
      version: string
    }
  }
}

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const legacyBrand = ['tre', 'llis'].join('')
const legacyProjectRoot = `.${legacyBrand}`
const workspaceFolderPlaceholder = '$' + '{workspaceFolder}'
const mattSkillsSource = 'https://github.com/mattpocock/skills.git'
const mattSkillsRevision = '8b78b531ab965735c5dc74f6f7a219e1e37326df'

const selectedPaths = [
  'skills/init-project/assets/hosts',
  'skills/init-project/assets/project',
  'skills/init-project/assets/core',
]

const upstream = {
  name: ['Tre', 'llis'].join(''),
  revision: 'd8fff53ce4964ed1a3e52fea6b418b27eba093e4',
  source: 'https://github.com/mindfold-ai/Trellis.git',
  version: '0.6.15',
}

const selectedIntegrity = {
  bytes: 1811745,
  files: 313,
  hash: '945163b533fb20dd1ae5c1434447a99aee8f85fc3744759a614a44aa5f4d5f21',
}

const migratedRuntimePaths = [
  'skills/init-project/assets/runtime/source',
  'skills/init-project/assets/runtime/vendor/channel-mem.mjs',
]

const runtimeIntegrity = {
  bytes: 993614,
  files: 89,
  hash: 'ac3bb73309040c21854cb2a16535c9b60be5a4e9fe1e56a96c79451ec6497c30',
}

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
  'spec-review',
  'start',
  'ts-sdk-author',
  'update-spec',
]

const nativeCapabilityCounts = [
  ['skills/init-project/assets/hosts/claude', 10],
  ['skills/init-project/assets/hosts/codebuddy', 9],
  ['skills/init-project/assets/hosts/codex', 24],
  ['skills/init-project/assets/hosts/copilot', 11],
  ['skills/init-project/assets/hosts/cursor', 9],
  ['skills/init-project/assets/hosts/droid', 9],
  ['skills/init-project/assets/hosts/gemini', 9],
  ['skills/init-project/assets/hosts/kiro', 10],
  ['skills/init-project/assets/hosts/omp', 9],
  ['skills/init-project/assets/hosts/opencode', 15],
  ['skills/init-project/assets/hosts/pi', 10],
  ['skills/init-project/assets/hosts/qoder', 9],
  ['skills/init-project/assets/hosts/reasonix', 8],
  ['skills/init-project/assets/hosts/trae', 9],
  ['skills/init-project/assets/hosts/zcode', 9],
] as const

const nativeCapabilityEntrypoints = [
  'skills/init-project/assets/hosts/claude/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/claude/settings.json',
  'skills/init-project/assets/hosts/codex/agents/moluoxixi-check.toml',
  'skills/init-project/assets/hosts/codex/config.toml',
  'skills/init-project/assets/hosts/codex/hooks.json',
  'skills/init-project/assets/hosts/copilot/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/cursor/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/cursor/hooks.json',
  'skills/init-project/assets/hosts/omp/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/omp/extensions/moluoxixi/index.ts.txt',
  'skills/init-project/assets/hosts/opencode/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/opencode/plugins/inject-workflow-state.js',
  'skills/init-project/assets/hosts/pi/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/pi/extensions/moluoxixi/index.ts.txt',
  'skills/init-project/assets/core/commands/continue.md',
  'skills/init-project/assets/core/hooks/inject-workflow-state.py',
]

function sortPaths(paths: string[]): string[] {
  return paths.sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

function resolveRolePath(relativePath: string): string {
  return path.join(roleRoot, ...relativePath.split('/'))
}

function collectFiles(relativeRoot: string): string[] {
  const files: string[] = []

  function visit(relativePath: string): void {
    const absolutePath = resolveRolePath(relativePath)
    const stats = fs.lstatSync(absolutePath)

    if (stats.isSymbolicLink()) {
      throw new Error(`Selected Moluoxixi path must not be a symbolic link: ${relativePath}`)
    }
    if (stats.isFile()) {
      files.push(relativePath)
      return
    }
    if (!stats.isDirectory()) {
      throw new Error(`Unsupported selected Moluoxixi entry: ${relativePath}`)
    }

    for (const name of sortPaths(fs.readdirSync(absolutePath))) {
      visit(path.posix.join(relativePath, name))
    }
  }

  visit(relativeRoot)
  return files
}

function selectedFiles(): string[] {
  const files = selectedPaths.flatMap(collectFiles)
  if (new Set(files).size !== files.length) {
    throw new Error('Selected Moluoxixi paths must not overlap')
  }
  return sortPaths(files)
}

function selectedStats(files: string[]): { bytes: number, hash: string } {
  const hash = createHash('sha256')
  let bytes = 0

  for (const relativePath of files) {
    const content = fs.readFileSync(resolveRolePath(relativePath))
    bytes += content.byteLength
    hash.update(`${relativePath}\0${content.byteLength}\0`, 'utf8')
    hash.update(content)
  }

  return { bytes, hash: hash.digest('hex') }
}

function readRoleManifest(): RoleManifest {
  const document = parseDocument(
    fs.readFileSync(path.join(roleRoot, 'role.yaml'), 'utf8'),
    { merge: false, prettyErrors: true, strict: true, uniqueKeys: true },
  )
  if (document.errors.length > 0) {
    throw new Error(document.errors.map(error => error.message).join('; '))
  }
  return document.toJS({ maxAliasCount: 0 }) as RoleManifest
}

describe('moluoxixi curated upstream role assets', () => {
  it('pins the selected upstream paths and curated content', () => {
    expect(new Set(selectedPaths).size).toBe(selectedPaths.length)
    for (const selectedPath of selectedPaths) {
      expect(selectedPath).not.toContain('\\')
      expect(selectedPath).not.toContain('\0')
      expect(path.isAbsolute(selectedPath)).toBe(false)
      expect(path.posix.isAbsolute(selectedPath)).toBe(false)
      expect(path.posix.normalize(selectedPath)).toBe(selectedPath)
      expect(selectedPath.split('/')).not.toContain('..')
    }

    const files = selectedFiles()
    const stats = selectedStats(files)
    expect(files).toHaveLength(selectedIntegrity.files)
    expect(stats).toEqual({
      bytes: selectedIntegrity.bytes,
      hash: selectedIntegrity.hash,
    })
  })

  it('keeps the role root limited to distribution metadata and the initializer', () => {
    expect(sortPaths(fs.readdirSync(roleRoot))).toEqual(sortPaths([
      '__test__',
      'constants',
      'mcp',
      'role.yaml',
      'skills',
    ]))

    const distributedSkills = fs.readdirSync(resolveRolePath('skills'), { withFileTypes: true })
    expect(distributedSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(distributedSkills.map(entry => entry.name)).toEqual(['init-project'])

    const projectSkills = fs.readdirSync(resolveRolePath('skills/init-project/assets/core/skills'), { withFileTypes: true })
    expect(projectSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(sortPaths(projectSkills.map(entry => entry.name))).toEqual(sortPaths([...projectSkillNames]))
    for (const skillName of projectSkillNames) {
      expect(fs.readFileSync(resolveRolePath(`skills/init-project/assets/core/skills/${skillName}/SKILL.md`), 'utf8')).toMatch(new RegExp(`^name: ${skillName}$`, 'mu'))
    }

    for (const [nativeRoot, expectedFiles] of nativeCapabilityCounts) {
      expect(collectFiles(nativeRoot)).toHaveLength(expectedFiles)
    }
    for (const entrypoint of nativeCapabilityEntrypoints) {
      expect(fs.statSync(resolveRolePath(entrypoint)).isFile()).toBe(true)
    }
    expect(selectedFiles().filter(file => file.endsWith('.backup'))).toEqual([])
  })

  it('keeps Reasonix in the project sub-agent context platform set', () => {
    const taskStore = fs.readFileSync(resolveRolePath('skills/init-project/assets/project/scripts/common/task_store.py'), 'utf8')
    expect(taskStore).toContain('".reasonix"')
  })

  it('keeps host and project asset roots free of unprojected legacy payloads', () => {
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets/hosts/copilot/prompts'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets/project/optional'))).toBe(false)
  })

  it('keeps the legacy brand only in immutable provenance and published source specifiers', () => {
    const allFiles = collectFiles('.')
    expect(allFiles.filter(relativePath => relativePath.toLowerCase().includes(legacyBrand))).toEqual([])

    const provenanceFiles = new Set([
      '__test__/moluoxixi-source.test.ts',
      '__test__/runtime-upstream.test.ts',
      '__test__/upstream-script-sync.test.ts',
      'role.yaml',
      'skills/init-project/references/upstream-capability-map.md',
      'skills/init-project/references/upstream-reconciliation-v0.6.15.json',
    ])
    for (const relativePath of allFiles) {
      const content = fs.readFileSync(resolveRolePath(relativePath), 'utf8')
      if (!content.toLowerCase().includes(legacyBrand))
        continue
      if (relativePath.startsWith('skills/init-project/assets/runtime/source/')) {
        expect(content.replaceAll(`@mindfoldhq/${legacyBrand}-core`, '').toLowerCase()).not.toContain(legacyBrand)
      }
      else {
        expect(provenanceFiles.has(relativePath)).toBe(true)
      }
    }
  })

  it.each([
    '.git',
    '.github',
    '.husky',
    legacyProjectRoot,
    '.moluoxixi',
    '.agents/skills/contribute',
    '.claude/commands/moluoxixi/create-manifest.md',
    '.claude/commands/moluoxixi/improve-ut.md',
    '.claude/commands/moluoxixi/publish-skill.md',
    '.claude/skills/contribute',
    '.claude/skills/gitnexus',
    '.codex/skills/create-manifest',
    '.cursor/commands/moluoxixi-create-manifest.md',
    '.cursor/commands/moluoxixi-publish-skill.md',
    '.opencode/package-lock.json',
    'apps',
    'assets',
    'docs',
    'docs-site',
    'drafts',
    'examples',
    'marketplace',
    'node_modules',
    'packages',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])('does not distribute repository-only path %s', (relativePath) => {
    expect(fs.existsSync(resolveRolePath(relativePath))).toBe(false)
  })

  it('maps native assets and distributes the self-contained initializer', () => {
    const manifest = readRoleManifest()
    expect(manifest).toMatchObject({
      assets: {
        mcp: 'mcp',
        skills: 'skills',
      },
      canonical_root: 'roles/moluoxixi',
      distribution: {
        bootstrap_manifest: 'constants/skills.ts',
        full_role_path_required: true,
        npm_embedded_source: false,
      },
      entrypoints: {
        initialize_project_script: 'skills/init-project/scripts/init-project.mjs',
        initialize_project_skill: 'init-project',
        moluoxixi_runtime: 'skills/init-project/assets/runtime/moluoxixi.mjs',
      },
      role_id: 'moluoxixi',
      role_version: '0.3.0',
    })
    expect(manifest.third_party.upstream).toEqual({
      name: upstream.name,
      paths: [
        'skills/init-project/assets/hosts',
        'skills/init-project/assets/project',
        'skills/init-project/assets/runtime/source',
        'skills/init-project/assets/runtime/vendor/channel-mem.mjs',
        'skills/init-project/assets/core',
      ],
      reconciliation: 'skills/init-project/references/upstream-reconciliation-v0.6.15.json',
      revision: upstream.revision,
      source: upstream.source,
      version: upstream.version,
    })
    expect(manifest.third_party.productivity_skills).toEqual({
      name: 'Matt Pocock Skills',
      source: mattSkillsSource,
      revision: mattSkillsRevision,
      category: 'skills/productivity',
    })
    expect(fs.statSync(resolveRolePath(manifest.assets.skills)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(manifest.assets.mcp)).isDirectory()).toBe(true)
    expect(fs.existsSync(resolveRolePath('skills/init-project/scripts/migrations/manifests'))).toBe(false)

    expect(extendsRoles).toEqual([])
    expect(hosts).toBe('all')
    expect(vendors).toHaveLength(2)
    expect(vendors[0]).toMatchObject({
      name: 'moluoxixi',
      projections: [
        { kind: 'role-assets', sourceDir: 'roles/moluoxixi' },
      ],
    })
    expect(vendors[0]?.setup).toEqual([
      {
        args: ['install', '--global', '@colbymchenry/codegraph'],
        command: 'npm',
        skipIfCommandAvailable: 'codegraph',
      },
      {
        args: ['install', '--yes'],
        command: 'codegraph',
        windowsCommandShim: true,
      },
    ])
    expect(vendors[1]).toEqual({
      name: 'mattpocock',
      source: mattSkillsSource,
      revision: mattSkillsRevision,
      projections: [
        {
          kind: 'namespace',
          sourceDir: 'skills/productivity',
          output: 'productivity',
        },
      ],
    })
    expect(JSON.parse(fs.readFileSync(resolveRolePath('mcp/mcp.json'), 'utf8'))).toEqual({
      mcpServers: {
        codegraph: {
          args: ['serve', '--mcp', '--path', workspaceFolderPlaceholder],
          command: 'codegraph',
        },
      },
    })
    expect(selectedFiles()).toHaveLength(selectedIntegrity.files)
    const runtimeFiles = migratedRuntimePaths.flatMap(collectFiles)
    expect(runtimeFiles).toHaveLength(runtimeIntegrity.files)
    expect(selectedStats(sortPaths(runtimeFiles))).toEqual({
      bytes: runtimeIntegrity.bytes,
      hash: runtimeIntegrity.hash,
    })
    expect(fs.statSync(resolveRolePath('skills/init-project/assets/runtime/moluoxixi.mjs')).isFile()).toBe(true)
  })

  it('uses Moluoxixi project and channel state roots in the executable runtime', () => {
    const runtimeFiles = [
      'skills/init-project/assets/runtime/source/packages/cli/src/constants/paths.ts',
      'skills/init-project/assets/runtime/source/packages/cli/src/commands/channel/agent-loader.ts',
      'skills/init-project/assets/runtime/source/packages/cli/src/commands/channel/store/paths.ts',
      'skills/init-project/assets/runtime/source/packages/core/src/channel/internal/store/paths.ts',
      'skills/init-project/assets/runtime/vendor/channel-mem.mjs',
    ]
    for (const relativePath of runtimeFiles) {
      const content = fs.readFileSync(resolveRolePath(relativePath), 'utf8')
      expect(content).toContain('.moluoxixi')
      expect(content).not.toContain(legacyProjectRoot)
    }
  })

  it('reconciles every official non-merge commit in the v0.6.7 to v0.6.15 range', () => {
    const ledger = JSON.parse(fs.readFileSync(
      resolveRolePath('skills/init-project/references/upstream-reconciliation-v0.6.15.json'),
      'utf8',
    ))
    expect(ledger.upstream).toEqual({
      name: upstream.name,
      source: upstream.source,
      from: { tag: 'v0.6.7', revision: 'e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a' },
      to: { tag: 'v0.6.15', revision: upstream.revision },
      history: { order: 'reverse', excludeMerges: true, commitCount: 122 },
    })
    expect(ledger.entries).toHaveLength(122)
    expect(new Set(ledger.entries.map((entry: { hash: string }) => entry.hash)).size).toBe(122)
    expect(ledger.entries[0]?.hash).toBe('200365b45a2afa68ff55c66a93d004303332f616')
    expect(ledger.entries.at(-1)?.hash).toBe(upstream.revision)
    expect(createHash('sha256').update(
      ledger.entries.map((entry: { hash: string, subject: string }) => `${entry.hash}\0${entry.subject}\n`).join(''),
    ).digest('hex')).toBe('7242f63c61794aaede0ab1b94799b2e62730e8910a8ed94b5ef1f9689f781eca')

    const allowedStatuses = new Set(['adapted', 'retained-local', 'reviewed-no-change', 'not-applicable'])
    const counts: Record<string, number> = {}
    for (const entry of ledger.entries) {
      expect(entry.hash).toMatch(/^[a-f0-9]{40}$/u)
      expect(entry.subject).toEqual(expect.any(String))
      expect(allowedStatuses.has(entry.status)).toBe(true)
      counts[entry.status] = (counts[entry.status] ?? 0) + 1
      if (entry.status === 'adapted' || entry.status === 'retained-local') {
        expect(entry.localEvidence.length).toBeGreaterThan(0)
        for (const evidence of entry.localEvidence) {
          expect(evidence.symbol).toEqual(expect.any(String))
          expect(fs.statSync(path.resolve(roleRoot, '..', '..', ...evidence.path.split('/'))).isFile()).toBe(true)
        }
      }
    }
    expect(counts).toEqual({
      'adapted': 51,
      'not-applicable': 64,
      'retained-local': 4,
      'reviewed-no-change': 3,
    })
  })
})
