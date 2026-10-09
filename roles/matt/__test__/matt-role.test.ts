import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { readInstalledMcpServers } from '../../../scripts/lib/install.js'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(roleRoot, 'role.yaml')
const temporaryRoots: string[] = []
const mattSkillsSource = 'https://github.com/mattpocock/skills.git'
const mattSkillsRevision = '8b78b531ab965735c5dc74f6f7a219e1e37326df'
const fixtureSkills = [
  { category: 'engineering', name: 'architecture' },
  { category: 'engineering', name: 'testing' },
  { category: 'productivity', name: 'focus' },
  { category: 'productivity', name: 'handoff' },
  { category: 'productivity', name: 'grilling' },
] as const

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

describe('matt role', () => {
  it('projects the pinned engineering and productivity namespaces', async () => {
    const roleContract = parseDocument(fs.readFileSync(manifestPath, 'utf8')).toJS({ maxAliasCount: 0 }) as Record<string, unknown>
    const installation = roleContract.installation as Record<string, unknown>
    expect(roleContract.extends_roles).toEqual(['development'])
    expect(roleContract.provides).toEqual({ capabilities: ['engineering'] })
    expect(installation.hosts).toBe('all')
    expect(installation.role_vendor).toEqual({
      name: 'matt-role',
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [
        {
          kind: 'role-assets',
          source_dir: 'roles/matt',
        },
      ],
    })

    const loaded = await loadVendorManifest(manifestPath)
    // role.yaml 声明 role_vendor_position: after，能力供应商必须排在角色供应商之前。
    expect(Object.keys(loaded.vendors)).toEqual(['hindsight-memory', 'mattpocock', 'anthropic-skills', 'matt-role'])
    expect(loaded.vendors.mattpocock).toMatchObject({
      repo: mattSkillsSource,
      revision: mattSkillsRevision,
    })
    expect(loaded.vendors.mattpocock?.links).toEqual([
      {
        kind: 'namespace-dir',
        source: 'skills/productivity',
        target: 'vendor/skills/productivity',
      },
      {
        kind: 'namespace-dir',
        source: 'skills/engineering',
        target: 'vendor/skills/engineering',
      },
    ])
    expect(loaded.vendors['matt-role']?.links).toEqual([
      {
        kind: 'role-assets-dir',
        source: 'roles/matt',
        target: 'vendor',
      },
      { kind: 'namespace-dir', source: 'capabilities/common/skills', target: 'vendor/skills/common' },
      { kind: 'mcp-file', source: 'capabilities/common/mcps.json', target: 'vendor/mcps/common/mcp.json' },
      { kind: 'mcp-file', source: 'capabilities/coding/mcps.json', target: 'vendor/mcps/code/mcp.json' },
      { kind: 'mcp-file', source: 'capabilities/frontend/mcps.json', target: 'vendor/mcps/frontend/mcp.json' },
    ])
  })

  it('ships a canonical remote role contract', () => {
    expect(fs.readdirSync(roleRoot).sort()).toEqual(['__test__', 'mcp', 'role.yaml', 'skills'])
    expect(JSON.parse(fs.readFileSync(path.join(roleRoot, 'mcp', 'mcp.json'), 'utf8'))).toEqual({ mcpServers: {} })

    const document = parseDocument(fs.readFileSync(path.join(roleRoot, 'role.yaml'), 'utf8'), {
      merge: false,
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    })
    expect(document.errors).toEqual([])
    expect(document.toJS({ maxAliasCount: 0 })).toEqual({
      schema_version: 2,
      role_id: 'matt',
      role_version: '0.1.0',
      status: 'experimental',
      canonical_root: 'roles/matt',
      description: 'Development role using Matt Pocock\'s skills and shared coding and frontend tools.',
      extends_roles: ['development'],
      provides: {
        capabilities: ['engineering'],
      },
      installation: {
        assets: {
          skills: 'skills',
        },
        role_vendor_position: 'after',
        hosts: 'all',
        role_vendor: {
          name: 'matt-role',
          source: 'https://github.com/moluoxixi/AIRules.git',
          projections: [
            {
              kind: 'role-assets',
              source_dir: 'roles/matt',
            },
          ],
        },
        distribution: {
          bootstrap_manifest: 'role.yaml',
          full_role_path_required: true,
          npm_embedded_source: false,
        },
      },
    })
  })

  it('stages the remote skills and canonical role path together', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-matt-role-'))
    temporaryRoots.push(root)
    const homeDir = path.join(root, 'home')
    const mattRepository = path.join(homeDir, 'vendor', 'repos', 'mattpocock')
    const roleRepository = path.join(homeDir, 'vendor', 'repos', 'matt-role', 'roles', 'matt')

    for (const { category, name } of fixtureSkills) {
      const skillRoot = path.join(mattRepository, 'skills', category, name)
      fs.mkdirSync(skillRoot, { recursive: true })
      fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), `---\nname: ${name}\n---\n`)
    }
    fs.mkdirSync(path.dirname(roleRepository), { recursive: true })
    fs.cpSync(roleRoot, roleRepository, { recursive: true })
    for (const capability of ['common', 'coding', 'frontend']) {
      const sourceRoot = path.resolve(roleRoot, '..', '..', 'capabilities', capability)
      const checkoutRoot = path.join(homeDir, 'vendor', 'repos', 'matt-role', 'capabilities', capability)
      fs.mkdirSync(path.dirname(checkoutRoot), { recursive: true })
      fs.cpSync(sourceRoot, checkoutRoot, { recursive: true })
    }
    const docsRoot = path.join(homeDir, 'vendor', 'repos', 'hindsight-memory', 'skills', 'hindsight-docs')
    fs.mkdirSync(docsRoot, { recursive: true })
    fs.writeFileSync(path.join(docsRoot, 'SKILL.md'), '---\nname: hindsight-docs\ndescription: fixture\n---\n')
    const frontendRoot = path.join(homeDir, 'vendor', 'repos', 'anthropic-skills', 'skills', 'frontend-design')
    fs.mkdirSync(frontendRoot, { recursive: true })
    fs.writeFileSync(path.join(frontendRoot, 'SKILL.md'), '---\nname: frontend-design\ndescription: fixture\n---\n')

    const inventory = await rebuildVendorAssets({ homeDir, role: 'matt', manifestPath })
    expect(inventory).toEqual({
      role: 'matt',
      roleRoot: path.join(homeDir, 'roles', 'matt'),
      skills: [
        ...fixtureSkills.map(({ name }) => name),
        'create-skill',
        'frontend-design',
        'hindsight-docs',
        'hindsight-memory',
        'spec-organization',
      ].sort((left, right) => left.localeCompare(right)),
    })
    for (const { name } of fixtureSkills) {
      expect(fs.statSync(path.join(homeDir, 'vendor', 'skills', name, 'SKILL.md')).isFile()).toBe(true)
    }
    expect(fs.statSync(path.join(homeDir, 'roles', 'matt', 'role.yaml')).isFile()).toBe(true)
    expect(Object.keys(readInstalledMcpServers(homeDir, 'matt') ?? {}).sort()).toEqual([
      'codegraph',
      'context7',
      'hindsight',
      'playwright',
      'sequential-thinking',
    ])
  })
})
