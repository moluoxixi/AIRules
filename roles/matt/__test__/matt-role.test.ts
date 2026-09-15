import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'
import { extendsRoles, hosts, roleVendor } from '../constants/skills.js'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(roleRoot, 'constants', 'skills.ts')
const temporaryRoots: string[] = []
const mattSkillsSource = 'https://github.com/mattpocock/skills.git'
const mattSkillsRevision = '8b78b531ab965735c5dc74f6f7a219e1e37326df'
const fixtureSkills = [
  { category: 'engineering', name: 'architecture' },
  { category: 'engineering', name: 'testing' },
  { category: 'productivity', name: 'focus' },
  { category: 'productivity', name: 'handoff' },
] as const

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true })
  }
})

describe('matt role', () => {
  it('projects the pinned engineering and productivity namespaces', async () => {
    expect(extendsRoles).toEqual([])
    expect(hosts).toBe('all')
    expect(roleVendor).toEqual({
      name: 'matt-role',
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [
        {
          kind: 'role-assets',
          sourceDir: 'roles/matt',
        },
      ],
    })

    const loaded = await loadVendorManifest(manifestPath)
    // role.yaml 声明 role_vendor_position: after，能力供应商必须排在角色供应商之前。
    expect(Object.keys(loaded.vendors)).toEqual(['mattpocock', 'matt-role'])
    expect(loaded.vendors.mattpocock).toMatchObject({
      repo: mattSkillsSource,
      revision: mattSkillsRevision,
    })
    expect(loaded.vendors.mattpocock?.links).toEqual([
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
    ])
  })

  it('ships a canonical remote role contract', () => {
    expect(fs.readdirSync(roleRoot).sort()).toEqual(['__test__', 'constants', 'mcp', 'role.yaml', 'skills'])
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
      distribution: {
        bootstrap_manifest: 'constants/skills.ts',
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

    const inventory = await rebuildVendorAssets({ homeDir, role: 'matt', manifestPath })
    expect(inventory).toEqual({
      role: 'matt',
      roleRoot: path.join(homeDir, 'roles', 'matt'),
      skills: fixtureSkills.map(({ name }) => name).sort((left, right) => left.localeCompare(right)),
    })
    for (const { name } of fixtureSkills) {
      expect(fs.statSync(path.join(homeDir, 'vendor', 'skills', name, 'SKILL.md')).isFile()).toBe(true)
    }
    expect(fs.statSync(path.join(homeDir, 'roles', 'matt', 'role.yaml')).isFile()).toBe(true)
  })
})
