import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { extendsRoles, hosts, packages, vendors } from '../constants/skills.js'

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
  }
}

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mattSkillsSource = 'https://github.com/mattpocock/skills.git'
const mattSkillsRevision = '8b78b531ab965735c5dc74f6f7a219e1e37326df'

const publishedPackageVersion = '0.6.20'
const publishedRepository = 'https://github.com/moluoxixi/AIRules'

const migratedRuntimePaths = [
  'packages/core',
  'packages/cli',
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
    const segments = relativePath.split('/')
    if (relativePath === '.sync' || relativePath.startsWith('.sync/') || segments.includes('node_modules'))
      return
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

describe('moluoxixi finalized role assets', () => {
  it('keeps the role root limited to finalized distribution assets', () => {
    const distributedEntries = fs.readdirSync(roleRoot).filter(name => !['.sync', 'node_modules', 'pnpm-lock.yaml'].includes(name))
    expect(sortPaths(distributedEntries)).toEqual(sortPaths([
      '.gitignore',
      '__test__',
      'constants',
      'mcp',
      'package.json',
      'packages',
      'pnpm-workspace.yaml',
      'registry',
      'role.yaml',
      'skills',
    ]))

    const distributedSkills = fs.readdirSync(resolveRolePath('skills'), { withFileTypes: true })
    expect(distributedSkills.every(entry => entry.isDirectory())).toBe(true)
    expect(distributedSkills.map(entry => entry.name)).toEqual(['init-project'])
    expect(collectFiles('skills/init-project').filter(file => path.posix.basename(file) === 'SKILL.md')).toEqual([
      'skills/init-project/SKILL.md',
    ])

    expect(fs.readFileSync(resolveRolePath('.gitignore'), 'utf8')).toContain('.sync/')
    expect(fs.existsSync(resolveRolePath('overlays'))).toBe(false)
  })

  it('keeps the init skill free of duplicated package assets and references', () => {
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('skills/init-project/references'))).toBe(false)
    expect(fs.existsSync(resolveRolePath('references'))).toBe(false)
  })

  it.each([
    '.git',
    '.github',
    '.husky',
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
        initialize_project_script: 'packages/cli/bin/moluoxixi.js',
        initialize_project_skill: 'init-project',
      },
      role_id: 'moluoxixi',
      role_version: '0.4.0',
    })
    expect(manifest.third_party).toEqual({
      productivity_skills: {
        name: 'Matt Pocock Skills',
        source: mattSkillsSource,
        revision: mattSkillsRevision,
        category: 'skills/productivity',
      },
    })
    expect(fs.statSync(resolveRolePath(manifest.assets.skills)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(manifest.assets.mcp)).isDirectory()).toBe(true)
    expect(fs.statSync(resolveRolePath(manifest.assets.packages)).isDirectory()).toBe(true)
    expect(fs.existsSync(resolveRolePath('skills/init-project/scripts/migrations/manifests'))).toBe(false)

    expect(extendsRoles).toEqual([])
    expect(hosts).toBe('all')
    expect(packages).toEqual([
      {
        name: '@moluoxixi/airules-moluoxixi-core',
        path: 'packages/core',
      },
      {
        name: '@moluoxixi/airules-moluoxixi-cli',
        path: 'packages/cli',
        install: { kind: 'npm-global', version: 'latest' },
      },
    ])
    expect(vendors).toHaveLength(2)
    expect(vendors[0]).toMatchObject({
      name: 'moluoxixi',
      projections: [
        { kind: 'role-assets', sourceDir: 'roles/moluoxixi' },
        { kind: 'namespace', sourceDir: 'skills/common', output: 'common' },
        { kind: 'mcp', sourceFile: 'mcps/code/mcps.json', output: 'mcps/code/mcp.json' },
      ],
    })
    expect(vendors[0]?.setup).toBeUndefined()
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
      mcpServers: {},
    })
    const runtimeFiles = migratedRuntimePaths.flatMap(collectFiles)
    expect(runtimeFiles.length).toBeGreaterThan(0)
    expect(fs.statSync(resolveRolePath('packages/cli/bin/moluoxixi.js')).isFile()).toBe(true)
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
      version: publishedPackageVersion,
      exports: {
        './task': expect.any(Object),
        './testing': expect.any(Object),
      },
      publishConfig: {
        access: 'public',
        provenance: true,
      },
      repository: {
        type: 'git',
        url: publishedRepository,
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
      version: publishedPackageVersion,
      bin: {
        moluoxixi: './bin/moluoxixi.js',
        tl: './bin/moluoxixi.js',
      },
      dependencies: {
        '@moluoxixi/airules-moluoxixi-core': 'workspace:*',
      },
      publishConfig: {
        access: 'public',
        provenance: true,
      },
      repository: {
        type: 'git',
        url: publishedRepository,
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
    expect(cli.files).toEqual(['dist', 'bin', 'README.md', 'LICENSE'])
    expect(workspace).toMatchObject({
      packageManager: 'pnpm@10.32.1',
      scripts: {
        'build': expect.any(String),
        'lint:publish': expect.any(String),
        'release': expect.any(String),
        'release:check': expect.any(String),
        'release:plan': expect.any(String),
        'publish:dry-run': expect.any(String),
        'test': expect.any(String),
        'test:publish': expect.any(String),
        'typecheck': expect.any(String),
        'verify:publish': expect.any(String),
      },
    })
    expect(workspace).not.toHaveProperty('publishConfig')
    expect(collectFiles('packages/core').length).toBeGreaterThan(0)
    expect(collectFiles('packages/cli').length).toBeGreaterThan(0)
    expect(fs.existsSync(resolveRolePath('skills/init-project/assets'))).toBe(false)
  })

  it('uses Moluoxixi project and channel state roots in the executable runtime', () => {
    const runtimeFiles = [
      'packages/cli/src/commands/channel/agent-loader.ts',
      'packages/cli/src/commands/channel/context-trust.ts',
      'packages/cli/src/commands/channel/store/paths.ts',
      'packages/core/src/channel/internal/store/paths.ts',
    ]
    for (const relativePath of runtimeFiles) {
      const content = fs.readFileSync(resolveRolePath(relativePath), 'utf8')
      expect(content).toContain('.moluoxixi')
    }
  })
})
