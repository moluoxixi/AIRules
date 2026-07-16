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
  npm_cli: {
    integrity: string
    package: string
    version: string
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
    cli: string
    initialize_project: string
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
  'COPYRIGHT',
  'LICENSE',
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
      '.npmignore',
      '.omp',
      '.opencode',
      '.pi',
      'AGENTS.md',
      'COPYRIGHT',
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      '__test__',
      'constants',
      'role.yaml',
      'trellis.upstream.json',
    ]))

    const actualSkills = fs.readdirSync(resolveRolePath('.agents/skills'), { withFileTypes: true })
    expect(actualSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(sortPaths(actualSkills.map(entry => entry.name))).toEqual(sortPaths([...skillNames]))

    const actualAgents = fs.readdirSync(resolveRolePath('.claude/agents'), { withFileTypes: true })
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

  it('maps the selected native assets and installs the pinned CLI separately', () => {
    const manifest = readRoleManifest()
    expect(manifest).toMatchObject({
      assets: {
        agents: '.claude/agents',
        rules: '.',
        skills: '.agents/skills',
      },
      canonical_root: 'roles/moluoxixi',
      distribution: {
        bootstrap_manifest: 'constants/skills.ts',
        full_role_path_required: true,
        npm_embedded_source: false,
      },
      entrypoints: {
        cli: 'trellis',
        initialize_project: 'trellis init',
      },
      role_id: 'moluoxixi',
    })
    expect(manifest.third_party.trellis).toEqual({
      license: lock.license,
      paths: lock.selected_paths,
      revision: lock.revision,
      source: lock.source,
      version: lock.npm_cli.version,
    })
    expect(fs.statSync(resolveRolePath(manifest.assets.skills)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(manifest.assets.agents)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(path.posix.join(manifest.assets.rules, 'AGENTS.md'))).isFile()).toBe(true)

    expect(extendsRoles).toEqual([])
    expect(vendors).toHaveLength(1)
    expect(vendors[0]).toMatchObject({
      name: 'moluoxixi',
      projections: [{ kind: 'role-assets', sourceDir: 'roles/moluoxixi' }],
      setup: [{
        args: ['install', '--global', `@mindfoldhq/trellis@${lock.npm_cli.version}`],
        command: 'npm',
      }],
    })
    expect(lock.ref).toBe(`v${lock.npm_cli.version}`)
    expect(lock.npm_cli).toMatchObject({
      integrity: expect.stringMatching(/^sha512-/u),
      package: '@mindfoldhq/trellis',
    })
  })

  it('retains the upstream license and documents the curated boundary', () => {
    expect(fs.readFileSync(resolveRolePath('LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE')
    expect(fs.readFileSync(resolveRolePath('COPYRIGHT'), 'utf8')).toContain('Copyright (C) 2026 Mindfold LLC')

    const notice = fs.readFileSync(resolveRolePath('THIRD_PARTY_NOTICES.md'), 'utf8')
    expect(notice).toContain('curated source-form subset')
    expect(notice).toContain(lock.revision)
    expect(notice).toContain(lock.tree)
    expect(notice).toContain('@mindfoldhq/trellis@0.6.7')
    expect(notice).toContain('369 selected files total 2,397,739 bytes')
  })
})
