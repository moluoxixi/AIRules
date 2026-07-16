import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { extendsRoles, vendors } from '../constants/skills.js'

interface UpstreamLock {
  combined_hash: {
    algorithm: string
    value: string
  }
  license: string
  local_initializer: {
    license: string
    path: string
    uses_upstream_cli: boolean
  }
  migrated_project_templates: {
    combined_hash: {
      algorithm: string
      value: string
    }
    local_path: string
    regular_file_bytes: number
    regular_files: number
    upstream_path: string
  }
  migrated_runtime: {
    combined_hash: {
      algorithm: string
      value: string
    }
    local_paths: string[]
    regular_file_bytes: number
    regular_files: number
    upstream_paths: string[]
  }
  ref: string
  revision: string
  selected_paths: string[]
  selected_regular_file_bytes: number
  selected_regular_files: number
  source: string
  tree: string
}

interface RoleManifest {
  assets: {
    agents: string
    rules: string
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
    trellis_runtime: string
  }
  role_id: string
  third_party: {
    trellis: {
      license: string
      paths: string[]
      revision: string
      source: string
      version: string
    }
  }
}

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lock = JSON.parse(
  fs.readFileSync(path.join(roleRoot, 'trellis.upstream.json'), 'utf8'),
) as UpstreamLock

const selectedPaths = [
  '.agents',
  '.claude',
  '.codex',
  '.cursor',
  '.omp',
  '.opencode',
  '.pi',
  'AGENTS.md',
]

const skillNames = [
  'first-principles-thinking',
  'python-design',
  'trellis-before-dev',
  'trellis-brainstorm',
  'trellis-break-loop',
  'trellis-channel',
  'trellis-check',
  'trellis-continue',
  'trellis-finish-work',
  'trellis-meta',
  'trellis-session-insight',
  'trellis-spec-bootstrap',
  'trellis-start',
  'trellis-update-spec',
  'ts-sdk-author',
]

const agentFiles = [
  'trellis-check.md',
  'trellis-implement.md',
  'trellis-research.md',
]

const nativeCapabilityCounts = [
  ['.agents', 84],
  ['.claude', 82],
  ['.codex', 7],
  ['.cursor', 52],
  ['.omp', 38],
  ['.opencode', 53],
  ['.pi', 50],
] as const

const nativeCapabilityEntrypoints = [
  '.claude/settings.json',
  '.claude/hooks/session-start.py',
  '.codex/config.toml',
  '.codex/hooks.json',
  '.cursor/hooks.json',
  '.omp/extensions/trellis/index.ts',
  '.opencode/plugins/inject-workflow-state.js',
  '.pi/extensions/trellis/index.ts',
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
      throw new Error(`Selected Trellis path must not be a symbolic link: ${relativePath}`)
    }
    if (stats.isFile()) {
      files.push(relativePath)
      return
    }
    if (!stats.isDirectory()) {
      throw new Error(`Unsupported selected Trellis entry: ${relativePath}`)
    }

    for (const name of sortPaths(fs.readdirSync(absolutePath))) {
      visit(path.posix.join(relativePath, name))
    }
  }

  visit(relativeRoot)
  return files
}

function selectedFiles(): string[] {
  const files = lock.selected_paths.flatMap(collectFiles)
  if (new Set(files).size !== files.length) {
    throw new Error('Selected Trellis paths must not overlap')
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

describe('moluoxixi curated Trellis role assets', () => {
  it('pins the selected upstream paths and their raw content', () => {
    expect(lock).toMatchObject({
      combined_hash: {
        algorithm: 'sha256-posix-path-size-content-v1',
      },
      license: 'AGPL-3.0-only',
      ref: 'v0.6.7',
      revision: 'e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a',
      source: 'https://github.com/mindfold-ai/Trellis.git',
      tree: 'd2856ff1290cc297f7579f768a63c2bbaec42f92',
    })
    expect(lock.selected_paths).toEqual(selectedPaths)
    expect(new Set(lock.selected_paths).size).toBe(lock.selected_paths.length)
    for (const selectedPath of lock.selected_paths) {
      expect(selectedPath).not.toContain('\\')
      expect(selectedPath).not.toContain('\0')
      expect(path.isAbsolute(selectedPath)).toBe(false)
      expect(path.posix.isAbsolute(selectedPath)).toBe(false)
      expect(path.posix.normalize(selectedPath)).toBe(selectedPath)
      expect(selectedPath.split('/')).not.toContain('..')
    }

    const files = selectedFiles()
    const stats = selectedStats(files)
    expect(files).toHaveLength(lock.selected_regular_files)
    expect(stats).toEqual({
      bytes: lock.selected_regular_file_bytes,
      hash: lock.combined_hash.value,
    })
  })

  it('allows only the role adapter and selected Trellis roots', () => {
    expect(sortPaths(fs.readdirSync(roleRoot))).toEqual(sortPaths([
      '.agents',
      '.claude',
      '.codex',
      '.cursor',
      '.omp',
      '.opencode',
      '.pi',
      'AGENTS.md',
      '__test__',
      'agents',
      'constants',
      'role.yaml',
      'rules',
      'runtime',
      'skills',
      'trellis.upstream.json',
    ]))

    const actualSkills = fs.readdirSync(resolveRolePath('.agents/skills'), { withFileTypes: true })
    expect(actualSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(sortPaths(actualSkills.map(entry => entry.name))).toEqual(sortPaths([...skillNames]))

    const distributedSkills = fs.readdirSync(resolveRolePath('skills'), { withFileTypes: true })
    expect(distributedSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(sortPaths(distributedSkills.map(entry => entry.name))).toEqual(sortPaths([...skillNames, 'init-project']))

    const actualAgents = fs.readdirSync(resolveRolePath('agents'), { withFileTypes: true })
    expect(actualAgents.every(entry => entry.isFile())).toBe(true)
    expect(sortPaths(actualAgents.map(entry => entry.name))).toEqual(sortPaths([...agentFiles]))

    for (const [nativeRoot, expectedFiles] of nativeCapabilityCounts) {
      expect(collectFiles(nativeRoot)).toHaveLength(expectedFiles)
    }
    for (const entrypoint of nativeCapabilityEntrypoints) {
      expect(fs.statSync(resolveRolePath(entrypoint)).isFile()).toBe(true)
    }
    expect(selectedFiles().filter(file => file.endsWith('.backup'))).toEqual([])
  })

  it.each([
    '.git',
    '.github',
    '.husky',
    '.moluoxixi',
    '.trellis',
    '.agents/skills/contribute',
    '.claude/commands/trellis/create-manifest.md',
    '.claude/commands/trellis/improve-ut.md',
    '.claude/commands/trellis/publish-skill.md',
    '.claude/skills/contribute',
    '.claude/skills/gitnexus',
    '.codex/skills/create-manifest',
    '.cursor/commands/trellis-create-manifest.md',
    '.cursor/commands/trellis-publish-skill.md',
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
        agents: 'agents',
        rules: 'rules',
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
        trellis_runtime: 'runtime/trellis.mjs',
      },
      role_id: 'moluoxixi',
    })
    expect(manifest.third_party.trellis).toEqual({
      license: lock.license,
      paths: [
        ...lock.selected_paths,
        'runtime/source',
        'runtime/vendor/channel-mem.mjs',
        'skills/init-project/assets/trellis-v0.6.7',
      ],
      revision: lock.revision,
      source: lock.source,
      version: lock.ref.slice(1),
    })
    expect(fs.statSync(resolveRolePath(manifest.assets.skills)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(manifest.assets.agents)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(path.posix.join(manifest.assets.rules, 'AGENTS.md'))).isFile()).toBe(true)

    expect(extendsRoles).toEqual([])
    expect(vendors).toHaveLength(1)
    expect(vendors[0]).toMatchObject({
      name: 'moluoxixi',
      projections: [
        { kind: 'role-assets', sourceDir: 'roles/moluoxixi' },
      ],
    })
    expect(vendors[0]?.setup).toBeUndefined()
    expect(lock.local_initializer).toEqual({
      license: 'MIT',
      path: 'skills/init-project/scripts/init-project.mjs',
      uses_upstream_cli: false,
    })
    expect(lock.migrated_project_templates).toMatchObject({
      local_path: 'skills/init-project/assets/trellis-v0.6.7',
      regular_file_bytes: 1158179,
      regular_files: 201,
      upstream_path: 'packages/cli/src/templates',
    })
    const runtimeFiles = lock.migrated_runtime.local_paths.flatMap(collectFiles)
    expect(runtimeFiles).toHaveLength(lock.migrated_runtime.regular_files)
    expect(selectedStats(sortPaths(runtimeFiles))).toEqual({
      bytes: lock.migrated_runtime.regular_file_bytes,
      hash: lock.migrated_runtime.combined_hash.value,
    })
    expect(fs.statSync(resolveRolePath('runtime/trellis.mjs')).isFile()).toBe(true)
  })

  it('uses Moluoxixi project and channel state roots in the executable runtime', () => {
    const runtimeFiles = [
      'runtime/source/packages/cli/src/constants/paths.ts',
      'runtime/source/packages/cli/src/commands/channel/agent-loader.ts',
      'runtime/source/packages/cli/src/commands/channel/store/paths.ts',
      'runtime/source/packages/core/src/channel/internal/store/paths.ts',
      'runtime/vendor/channel-mem.mjs',
    ]
    for (const relativePath of runtimeFiles) {
      const content = fs.readFileSync(resolveRolePath(relativePath), 'utf8')
      expect(content).toContain('.moluoxixi')
      expect(content).not.toContain('.trellis')
    }
  })

  it('keeps legal texts with the migrated assets instead of the role root', () => {
    expect(fs.existsSync(resolveRolePath('LICENSE'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('COPYRIGHT'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('THIRD_PARTY_NOTICES.md'))).toBe(false)
    expect(fs.readFileSync(resolveRolePath('skills/init-project/assets/trellis-v0.6.7/legal/LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE')
    expect(fs.readFileSync(resolveRolePath('skills/init-project/assets/trellis-v0.6.7/legal/COPYRIGHT'), 'utf8')).toContain('Copyright (C) 2026 Mindfold LLC')
    const notice = fs.readFileSync(resolveRolePath('runtime/NOTICE.md'), 'utf8')
    expect(notice).toContain(lock.revision)
    expect(notice).toContain('vendor/channel-mem.mjs')
  })
})
