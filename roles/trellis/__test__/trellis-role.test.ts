import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { HOST_IDS } from '../../../constants/hosts.js'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'
import { extendsRoles, hosts, vendors } from '../constants/skills.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(roleRoot, 'constants', 'skills.ts')
const temporaryRoots: string[] = []
const workspaceFolderPlaceholder = '$' + '{workspaceFolder}'
const mattSkillsSource = 'https://github.com/mattpocock/skills.git'
const mattSkillsRevision = '8b78b531ab965735c5dc74f6f7a219e1e37326df'

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

describe('native Trellis role', () => {
  it('installs the official CLI and projects the AIRules-owned initialization entry', async () => {
    expect(extendsRoles).toEqual([])
    expect(hosts).toBe('all')
    expect(vendors).toEqual([
      {
        name: 'trellis',
        source: 'https://github.com/moluoxixi/AIRules.git',
        setup: [
          {
            command: 'npm',
            args: ['install', '--global', '@mindfoldhq/trellis@latest'],
          },
        ],
        projections: [
          {
            kind: 'role-assets',
            sourceDir: 'roles/trellis',
          },
          {
            kind: 'namespace',
            sourceDir: 'skills/common',
            output: 'common',
          },
          {
            kind: 'mcp',
            sourceFile: 'mcps/code/mcps.json',
            output: 'mcps/code/mcp.json',
          },
        ],
      },
      {
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
      },
    ])

    const loaded = await loadVendorManifest(manifestPath)
    expect(loaded.hosts).toEqual(HOST_IDS)
    expect(loaded.vendors.trellis).toMatchObject({
      repo: 'https://github.com/moluoxixi/AIRules.git',
      setup: [
        {
          command: 'npm',
          args: ['install', '--global', '@mindfoldhq/trellis@latest'],
        },
      ],
    })
    expect(loaded.vendors.trellis?.links).toEqual([
      {
        kind: 'role-assets-dir',
        source: 'roles/trellis',
        target: 'vendor',
      },
      {
        kind: 'namespace-dir',
        source: 'skills/common',
        target: 'vendor/skills/common',
      },
      {
        kind: 'mcp-file',
        source: 'mcps/code/mcps.json',
        target: 'vendor/mcps/code/mcp.json',
      },
    ])
    expect(loaded.vendors.mattpocock).toMatchObject({
      repo: mattSkillsSource,
      revision: mattSkillsRevision,
      links: [{
        kind: 'namespace-dir',
        source: 'skills/productivity',
        target: 'vendor/skills/productivity',
      }],
    })
  })

  it('ships the native initialization entry and declares shared coding MCP servers', () => {
    expect(fs.readdirSync(roleRoot).sort()).toEqual(['__test__', 'constants', 'mcp', 'role.yaml', 'skills'])
    expect(fs.readdirSync(path.join(roleRoot, 'skills')).sort()).toEqual(['init-project'])
    expect(fs.statSync(path.join(roleRoot, 'skills', 'init-project', 'scripts', 'inject-readme.mjs')).isFile()).toBe(true)
    expect(fs.statSync(path.join(roleRoot, 'skills', 'init-project', 'scripts', 'install-extension.mjs')).isFile()).toBe(true)
    expect(fs.statSync(path.join(roleRoot, 'skills', 'init-project', 'scripts', 'run-role-cli.mjs')).isFile()).toBe(true)
    expect(fs.statSync(path.join(roleRoot, 'skills', 'init-project', 'scripts', 'core', 'extension-transaction.mjs')).isFile()).toBe(true)
    expect(fs.statSync(path.join(roleRoot, 'skills', 'init-project', 'assets', 'readme-usage.md')).isFile()).toBe(true)
    expect(fs.statSync(path.join(roleRoot, 'skills', 'init-project', 'assets', 'project-extension', 'AGENTS.md')).isFile()).toBe(true)
    expect(fs.statSync(path.join(roleRoot, 'skills', 'init-project', 'assets', 'project-extension', 'skill', 'SKILL.md')).isFile()).toBe(true)

    const skill = fs.readFileSync(path.join(roleRoot, 'skills', 'init-project', 'SKILL.md'), 'utf8')
    expect(skill).toContain('trellis init --help')
    expect(skill).toContain('scripts/run-role-cli.mjs')
    expect(skill).toContain('--developer <confirmed-developer>')
    expect(skill).toContain('AIRULES:TRELLIS-ZH-COMPAT')
    expect(skill).toContain('Do not stage or commit generated files')

    expect(JSON.parse(fs.readFileSync(path.join(roleRoot, 'mcp', 'mcp.json'), 'utf8'))).toEqual({ mcpServers: {} })
    const catalog = JSON.parse(fs.readFileSync(path.resolve(roleRoot, '..', '..', 'mcps', 'code', 'mcps.json'), 'utf8')) as {
      mcps: Record<string, { mcp: { args: string[], command: string } }>
    }
    expect(Object.keys(catalog.mcps).sort()).toEqual(['codegraph', 'context7', 'playwright', 'sequential-thinking'])
    expect(catalog.mcps.codegraph.mcp.args).toEqual(['serve', '--mcp', '--path', workspaceFolderPlaceholder])

    const document = parseDocument(fs.readFileSync(path.join(roleRoot, 'role.yaml'), 'utf8'), {
      merge: false,
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    })
    expect(document.errors).toEqual([])
    expect(document.toJS({ maxAliasCount: 0 })).toMatchObject({
      schema_version: 1,
      role_id: 'trellis',
      role_version: '0.4.0',
      status: 'stable',
      canonical_root: 'roles/trellis',
      assets: {
        skills: 'skills',
        mcp: 'mcp',
      },
      distribution: {
        bootstrap_manifest: 'constants/skills.ts',
        full_role_path_required: true,
        npm_embedded_source: false,
      },
      entrypoints: {
        initialize_project_skill: 'init-project',
        initialize_project_script: 'skills/init-project/scripts/run-role-cli.mjs',
      },
      third_party: {
        upstream: {
          name: 'Trellis',
          source: 'https://github.com/mindfold-ai/Trellis.git',
          package: '@mindfoldhq/trellis@latest',
        },
        productivity_skills: {
          name: 'Matt Pocock Skills',
          source: mattSkillsSource,
          revision: mattSkillsRevision,
          category: 'skills/productivity',
        },
      },
    })
  })

  it('injects one Chinese Trellis usage block while preserving project documentation', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-readme-'))
    temporaryRoots.push(projectRoot)
    const readmePath = path.join(projectRoot, 'README.md')
    const injector = path.join(roleRoot, 'skills', 'init-project', 'scripts', 'inject-readme.mjs')
    const original = '# Existing project\n\nProject documentation.  \nContinued line.\n'
    fs.writeFileSync(readmePath, original)

    const first = spawnSync(process.execPath, [injector, '--project', projectRoot], { encoding: 'utf8' })
    expect(first).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(first.stdout)).toEqual({ readme: 'README.md', status: 'updated' })
    const injected = fs.readFileSync(readmePath, 'utf8')
    expect(injected).toContain(original.trim())
    expect(injected).toContain('请使用 Trellis 开始处理这个需求：<描述需求>')
    expect(injected).toContain('.trellis/knowledge/sources/')
    expect(injected.match(/<!-- AIRULES:TRELLIS:START -->/gu)).toHaveLength(1)
    expect(injected.match(/<!-- AIRULES:TRELLIS:END -->/gu)).toHaveLength(1)

    const second = spawnSync(process.execPath, [injector, '--project', projectRoot], { encoding: 'utf8' })
    expect(second).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(second.stdout)).toEqual({ readme: 'README.md', status: 'unchanged' })
    expect(fs.readFileSync(readmePath, 'utf8')).toBe(injected)

    const emptyProject = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-readme-'))
    temporaryRoots.push(emptyProject)
    const created = spawnSync(process.execPath, [injector, '--project', emptyProject], { encoding: 'utf8' })
    expect(created).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(created.stdout)).toEqual({ readme: 'README.md', status: 'created' })
    expect(fs.readFileSync(path.join(emptyProject, 'README.md'), 'utf8')).toContain('请使用 Trellis 完成本次工作。')
  })

  it('preserves a non-UTF-8 README during Trellis usage injection', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-readme-'))
    temporaryRoots.push(projectRoot)
    const readmePath = path.join(projectRoot, 'README.md')
    const injector = path.join(roleRoot, 'skills', 'init-project', 'scripts', 'inject-readme.mjs')
    const utf16Readme = Buffer.from('\uFEFF# UTF-16 project\r\n', 'utf16le')
    fs.writeFileSync(readmePath, utf16Readme)

    const result = spawnSync(process.execPath, [injector, '--project', projectRoot], { encoding: 'utf8' })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('README.md is not UTF-8 text')
    expect(fs.readFileSync(readmePath)).toEqual(utf16Readme)
  })

  it('stages the project initializer as the role skill', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-trellis-role-'))
    temporaryRoots.push(root)
    const homeDir = path.join(root, 'home')
    const repository = path.join(homeDir, 'vendor', 'repos', 'trellis')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'trellis'), { recursive: true })
    const stagingManifest = path.join(root, 'manifest.mjs')
    fs.writeFileSync(stagingManifest, `export const vendors = ${JSON.stringify([{
      name: 'trellis',
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [
        { kind: 'role-assets', sourceDir: 'roles/trellis' },
      ],
    }])}\n`)

    const inventory = await rebuildVendorAssets({ homeDir, role: 'trellis', manifestPath: stagingManifest })
    expect(inventory.skills).toEqual(['init-project'])
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'agents', 'openai.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'assets', 'readme-usage.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'assets', 'project-extension', 'AGENTS.md'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'scripts', 'inject-readme.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'scripts', 'install-extension.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'scripts', 'run-role-cli.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'skills', 'init-project', 'scripts', 'core', 'extension-transaction.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'trellis', 'mcp', 'mcp.json'))).toBe(true)
  })
})
