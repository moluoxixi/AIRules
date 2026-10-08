import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
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
    expect(roleContract.extends_roles).toEqual(['general'])
    expect(roleContract.hosts).toBe('all')
    expect(roleContract.role_vendor).toEqual({
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
    expect(Object.keys(loaded.vendors)).toEqual(['hindsight-memory', 'mattpocock', 'matt-role'])
    expect(loaded.vendors.mattpocock).toMatchObject({
      repo: mattSkillsSource,
      revision: mattSkillsRevision,
    })
    expect(loaded.vendors.mattpocock?.links).toEqual([
      {
        kind: 'skill',
        source: 'skills/productivity/grilling',
        target: 'vendor/skills/grilling',
      },
      {
        kind: 'namespace-dir',
        source: 'skills/engineering',
        target: 'vendor/skills/engineering',
      },
      {
        kind: 'namespace-dir',
        source: 'skills/productivity',
        target: 'vendor/skills/productivity',
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
      schema_version: 1,
      role_id: 'matt',
      role_version: '0.1.0',
      status: 'experimental',
      canonical_root: 'roles/matt',
      description: 'Installs Matt Pocock\'s engineering and productivity skills through AIRules.',
      assets: {
        skills: 'skills',
      },
      capabilities: [
        'engineering',
        'productivity',
      ],
      role_vendor_position: 'after',
      hosts: 'all',
      extends_roles: ['general'],
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
      third_party: {
        upstream: {
          name: 'Matt Pocock Skills',
          source: mattSkillsSource,
          revision: mattSkillsRevision,
          categories: [
            'skills/engineering',
            'skills/productivity',
          ],
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
    const commonRoot = path.resolve(roleRoot, '..', '..', 'capabilities', 'common')
    const checkoutCommonRoot = path.join(homeDir, 'vendor', 'repos', 'matt-role', 'capabilities', 'common')
    fs.mkdirSync(path.dirname(checkoutCommonRoot), { recursive: true })
    fs.cpSync(commonRoot, checkoutCommonRoot, { recursive: true })
    const docsRoot = path.join(homeDir, 'vendor', 'repos', 'hindsight-memory', 'skills', 'hindsight-docs')
    fs.mkdirSync(docsRoot, { recursive: true })
    fs.writeFileSync(path.join(docsRoot, 'SKILL.md'), '---\nname: hindsight-docs\ndescription: fixture\n---\n')

    const inventory = await rebuildVendorAssets({ homeDir, role: 'matt', manifestPath })
    expect(inventory).toEqual({
      role: 'matt',
      roleRoot: path.join(homeDir, 'roles', 'matt'),
      skills: [
        ...fixtureSkills.map(({ name }) => name),
        'create-skill',
        'hindsight-docs',
        'hindsight-memory',
        'spec-organization',
      ].sort((left, right) => left.localeCompare(right)),
    })
    for (const { name } of fixtureSkills) {
      expect(fs.statSync(path.join(homeDir, 'vendor', 'skills', name, 'SKILL.md')).isFile()).toBe(true)
    }
    expect(fs.statSync(path.join(homeDir, 'roles', 'matt', 'role.yaml')).isFile()).toBe(true)
  })
})
