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
    packages: string
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
  bytes: 1741795,
  files: 300,
  hash: 'f9ef9b1cec9686bb93e95efedb6f4ce09cc2a15c529aaff9906cbeefeae173ff',
}

const migratedRuntimePaths = [
  'packages/core',
  'packages/cli',
  'skills/init-project/assets/runtime/vendor/channel-mem.mjs',
]

const runtimeIntegrity = {
  bytes: 4798933,
  files: 636,
  hash: '7a679228a89c988c4d6e3efc34c83919a91f4a0f2e3bbb91db08279b1e92b080',
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
  ['skills/init-project/assets/hosts/codex', 11],
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

  it('keeps the role root limited to distribution metadata, publishable packages, and the initializer', () => {
    expect(sortPaths(fs.readdirSync(roleRoot))).toEqual(sortPaths([
      '__test__',
      'constants',
      'mcp',
      'package.json',
      'packages',
      'pnpm-workspace.yaml',
      'role.yaml',
      'skills',
    ]))

    const distributedSkills = fs.readdirSync(resolveRolePath('skills'), { withFileTypes: true })
    expect(distributedSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(distributedSkills.map(entry => entry.name)).toEqual(['init-project'])
    expect(collectFiles('skills/init-project').filter(file => path.posix.basename(file) === 'SKILL.md')).toEqual([
      'skills/init-project/SKILL.md',
    ])

    const projectSkills = fs.readdirSync(resolveRolePath('skills/init-project/assets/core/skills'), { withFileTypes: true })
    expect(projectSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(sortPaths(projectSkills.map(entry => entry.name))).toEqual(sortPaths([...projectSkillNames]))
    for (const skillName of projectSkillNames) {
      expect(fs.readFileSync(resolveRolePath(`skills/init-project/assets/core/skills/${skillName}/SKILL.md.txt`), 'utf8')).toMatch(new RegExp(`^name: ${skillName}$`, 'mu'))
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

  it('keeps the legacy brand only in the upstream package baseline and immutable provenance', () => {
    const allFiles = collectFiles('.')
    expect(allFiles.filter(relativePath =>
      relativePath.toLowerCase().includes(legacyBrand)
      && !relativePath.startsWith('packages/'),
    )).toEqual([])

    const provenanceFiles = new Set([
      '__test__/moluoxixi-source.test.ts',
      '__test__/runtime-upstream.test.ts',
      '__test__/upstream-script-sync.test.ts',
      'role.yaml',
      'skills/init-project/references/sync-preservation-contracts.json',
      'skills/init-project/references/upstream-capability-map.md',
      'skills/init-project/references/upstream-reconciliation-v0.6.15.json',
    ])
    for (const relativePath of allFiles) {
      if (relativePath.startsWith('packages/'))
        continue
      const content = fs.readFileSync(resolveRolePath(relativePath), 'utf8')
      if (!content.toLowerCase().includes(legacyBrand))
        continue
      expect(provenanceFiles.has(relativePath)).toBe(true)
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
    'pnpm-lock.yaml',
  ])('does not distribute repository-only path %s', (relativePath) => {
    expect(fs.existsSync(resolveRolePath(relativePath))).toBe(false)
  })

  it('maps native assets and distributes the self-contained initializer', () => {
    const manifest = readRoleManifest()
    expect(manifest).toMatchObject({
      assets: {
        mcp: 'mcp',
        packages: 'packages',
        skills: 'skills',
      },
      canonical_root: 'roles/moluoxixi',
      distribution: {
        bootstrap_manifest: 'constants/skills.ts',
        full_role_path_required: true,
        npm_embedded_source: false,
      },
      entrypoints: {
        initialize_project_script: 'packages/cli/bin/init-project.js',
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
        'packages/core',
        'packages/cli',
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
    expect(fs.statSync(resolveRolePath(manifest.assets.packages)).isDirectory()).toBe(true)
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

  it('keeps complete role-local packages public, collision-resistant, and publication-capable', () => {
    const workspace = JSON.parse(fs.readFileSync(resolveRolePath('package.json'), 'utf8'))
    const core = JSON.parse(fs.readFileSync(resolveRolePath('packages/core/package.json'), 'utf8'))
    const cli = JSON.parse(fs.readFileSync(resolveRolePath('packages/cli/package.json'), 'utf8'))

    expect(workspace).toMatchObject({
      name: '@moluoxixi/airules-moluoxixi-role',
      private: true,
      workspaces: ['packages/*'],
    })
    expect(fs.readFileSync(resolveRolePath('pnpm-workspace.yaml'), 'utf8')).toContain('- \'packages/*\'')
    expect(core).toMatchObject({
      name: '@moluoxixi/airules-moluoxixi-core',
      version: upstream.version,
      exports: {
        './task': expect.any(Object),
        './testing': expect.any(Object),
      },
      publishConfig: {
        access: 'public',
        provenance: true,
      },
      scripts: {
        'build': expect.any(String),
        'lint:publish': expect.any(String),
        'test': expect.any(String),
        'test:publish': expect.any(String),
        'typecheck': expect.any(String),
        'prepublishOnly': expect.stringContaining('test:publish'),
      },
    })
    expect(core).not.toHaveProperty('private')
    expect(cli).toMatchObject({
      name: '@moluoxixi/airules-moluoxixi-cli',
      version: upstream.version,
      bin: {
        trellis: './bin/trellis.js',
        tl: './bin/trellis.js',
      },
      dependencies: {
        '@moluoxixi/airules-moluoxixi-core': 'workspace:*',
      },
      publishConfig: {
        access: 'public',
        provenance: true,
      },
      scripts: {
        'build': expect.any(String),
        'lint:publish': expect.any(String),
        'test': expect.any(String),
        'test:publish': expect.any(String),
        'typecheck': expect.any(String),
        'prepublishOnly': expect.stringContaining('test:publish'),
      },
    })
    expect(cli).not.toHaveProperty('private')
    expect(cli.files).toEqual(['dist', 'bin/trellis.js'])
    expect(workspace).toMatchObject({
      packageManager: 'pnpm@10.32.1',
      scripts: {
        'build': expect.any(String),
        'publish:dry-run': expect.any(String),
        'test': expect.any(String),
        'test:publish': expect.any(String),
        'typecheck': expect.any(String),
        'verify:publish': expect.any(String),
      },
    })
    expect(workspace).not.toHaveProperty('publishConfig')
    expect(collectFiles('packages/core')).toHaveLength(78)
    expect(collectFiles('packages/cli')).toHaveLength(557)
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets/runtime/source'))).toBe(false)
  })

  it('uses Moluoxixi project and channel state roots in the executable runtime', () => {
    const runtimeFiles = [
      'packages/cli/src/commands/channel/agent-loader.ts',
      'packages/cli/src/commands/channel/context-trust.ts',
      'packages/cli/src/commands/channel/store/paths.ts',
      'packages/core/src/channel/internal/store/paths.ts',
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
      'adapted': 53,
      'not-applicable': 64,
      'retained-local': 2,
      'reviewed-no-change': 3,
    })
  })

  it('records synchronization-preservation contracts for intentional behavior', () => {
    const ledger = JSON.parse(fs.readFileSync(
      resolveRolePath('skills/init-project/references/sync-preservation-contracts.json'),
      'utf8',
    ))
    expect(ledger).toMatchObject({
      schemaVersion: 1,
      baseline: {
        name: upstream.name,
        source: upstream.source,
        version: upstream.version,
        revision: upstream.revision,
      },
    })

    const expectedContracts = {
      'review-gated-spec-proposals': ['local-extension', 'preserve-local'],
      'role-local-publishable-runtime-packages': ['local-extension', 'preserve-local'],
      'simple-task-creation-opt-out': ['upstream-parity', 'preserve-upstream'],
      'task-complexity-triage': ['local-extension', 'preserve-local'],
    }
    const contracts = ledger.contracts as Array<{
      id: string
      title: string
      origin: string
      syncPolicy: string
      reason: string
      localEvidence: Array<{ path: string, symbol: string }>
      verification: Array<{ path: string, symbol: string }>
    }>
    expect(sortPaths(contracts.map(contract => contract.id))).toEqual(Object.keys(expectedContracts))
    expect(new Set(contracts.map(contract => contract.id)).size).toBe(contracts.length)

    for (const contract of contracts) {
      expect([contract.origin, contract.syncPolicy]).toEqual(expectedContracts[contract.id as keyof typeof expectedContracts])
      expect(contract.title.trim()).not.toBe('')
      expect(contract.reason.trim()).not.toBe('')
      expect(contract.localEvidence.length).toBeGreaterThan(0)
      expect(contract.verification.length).toBeGreaterThan(0)
      for (const evidence of [...contract.localEvidence, ...contract.verification]) {
        expect(evidence.path).not.toContain('\\')
        expect(evidence.path).not.toContain('\0')
        expect(path.posix.isAbsolute(evidence.path)).toBe(false)
        expect(path.posix.normalize(evidence.path)).toBe(evidence.path)
        expect(evidence.path.split('/')).not.toContain('..')
        expect(evidence.symbol.trim()).not.toBe('')
        const evidenceStats = fs.lstatSync(path.resolve(roleRoot, '..', '..', ...evidence.path.split('/')))
        expect(evidenceStats.isSymbolicLink()).toBe(false)
        expect(evidenceStats.isFile()).toBe(true)
      }
    }
  })
})
