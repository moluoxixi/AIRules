import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { extendsRoles, vendors } from '../constants/skills.js'

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
  third_party: {
    upstream: {
      name: string
      paths: string[]
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

const selectedPaths = [
  'skills/init-project/assets/hosts',
  'skills/init-project/assets/project',
  'skills/init-project/assets/shared',
]

const upstream = {
  name: ['Tre', 'llis'].join(''),
  revision: 'e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a',
  source: 'https://github.com/mindfold-ai/Trellis.git',
  version: '0.6.7',
}

const selectedIntegrity = {
  bytes: 1618041,
  files: 242,
  hash: 'da794faff1247b907b23599a38af25233e80592d0f8a1033406a87bcb4a76656',
}

const migratedRuntimePaths = [
  'skills/init-project/assets/runtime/source',
  'skills/init-project/assets/runtime/vendor/channel-mem.mjs',
]

const runtimeIntegrity = {
  bytes: 860894,
  files: 85,
  hash: 'f521071fe0c7924e3950b5826a55a049b8d3daf787de187af1f84cd6f3d7735f',
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
  'start',
  'ts-sdk-author',
  'update-spec',
]

const nativeCapabilityCounts = [
  ['skills/init-project/assets/hosts/claude', 5],
  ['skills/init-project/assets/hosts/codebuddy', 4],
  ['skills/init-project/assets/hosts/codex', 19],
  ['skills/init-project/assets/hosts/copilot', 16],
  ['skills/init-project/assets/hosts/cursor', 4],
  ['skills/init-project/assets/hosts/droid', 4],
  ['skills/init-project/assets/hosts/gemini', 4],
  ['skills/init-project/assets/hosts/kiro', 5],
  ['skills/init-project/assets/hosts/omp', 4],
  ['skills/init-project/assets/hosts/opencode', 9],
  ['skills/init-project/assets/hosts/pi', 5],
  ['skills/init-project/assets/hosts/qoder', 4],
  ['skills/init-project/assets/hosts/reasonix', 2],
  ['skills/init-project/assets/hosts/trae', 4],
  ['skills/init-project/assets/hosts/zcode', 3],
] as const

const nativeCapabilityEntrypoints = [
  'skills/init-project/assets/hosts/claude/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/claude/settings.json',
  'skills/init-project/assets/hosts/codex/agents/moluoxixi-check.toml',
  'skills/init-project/assets/hosts/codex/config.toml',
  'skills/init-project/assets/hosts/codex/hooks.json',
  'skills/init-project/assets/hosts/cursor/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/cursor/hooks.json',
  'skills/init-project/assets/hosts/omp/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/omp/extensions/moluoxixi/index.ts.txt',
  'skills/init-project/assets/hosts/opencode/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/opencode/plugins/inject-workflow-state.js',
  'skills/init-project/assets/hosts/pi/agents/moluoxixi-check.md',
  'skills/init-project/assets/hosts/pi/extensions/moluoxixi/index.ts.txt',
  'skills/init-project/assets/shared/commands/continue.md',
  'skills/init-project/assets/shared/hooks/inject-workflow-state.py',
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

    const projectSkills = fs.readdirSync(resolveRolePath('skills/init-project/assets/shared/skills'), { withFileTypes: true })
    expect(projectSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(sortPaths(projectSkills.map(entry => entry.name))).toEqual(sortPaths([...projectSkillNames]))
    for (const skillName of projectSkillNames) {
      expect(fs.readFileSync(resolveRolePath(`skills/init-project/assets/shared/skills/${skillName}/SKILL.md`), 'utf8')).toMatch(new RegExp(`^name: ${skillName}$`, 'mu'))
    }

    for (const [nativeRoot, expectedFiles] of nativeCapabilityCounts) {
      expect(collectFiles(nativeRoot)).toHaveLength(expectedFiles)
    }
    for (const entrypoint of nativeCapabilityEntrypoints) {
      expect(fs.statSync(resolveRolePath(entrypoint)).isFile()).toBe(true)
    }
    expect(selectedFiles().filter(file => file.endsWith('.backup'))).toEqual([])
  })

  it('keeps the legacy brand only in immutable provenance and published source specifiers', () => {
    const allFiles = collectFiles('.')
    expect(allFiles.filter(relativePath => relativePath.toLowerCase().includes(legacyBrand))).toEqual([])

    const provenanceFiles = new Set([
      '__test__/moluoxixi-source.test.ts',
      'role.yaml',
      'skills/init-project/references/upstream-capability-map.md',
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
    })
    expect(manifest.third_party.upstream).toEqual({
      name: upstream.name,
      paths: [
        'skills/init-project/assets/hosts',
        'skills/init-project/assets/project',
        'skills/init-project/assets/runtime/source',
        'skills/init-project/assets/runtime/vendor/channel-mem.mjs',
        'skills/init-project/assets/shared',
      ],
      revision: upstream.revision,
      source: upstream.source,
      version: upstream.version,
    })
    expect(fs.statSync(resolveRolePath(manifest.assets.skills)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(manifest.assets.mcp)).isDirectory()).toBe(true)

    expect(extendsRoles).toEqual([])
    expect(vendors).toHaveLength(1)
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
      },
    ])
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

  it('omits license and notice artifacts from the role assets', () => {
    expect(fs.existsSync(resolveRolePath('LICENSE'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('COPYRIGHT'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('THIRD_PARTY_NOTICES.md'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets/moluoxixi-v0.6.7'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets/runtime/NOTICE.md'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets/runtime/legal'))).toBe(false)
    expect(fs.readFileSync(resolveRolePath('role.yaml'), 'utf8')).not.toMatch(/^\s*license:/mu)
  })
})
