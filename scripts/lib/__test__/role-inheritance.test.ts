import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { resolveRoleInheritance, roleOverlayOrder } from '../roles.js'
import { loadVendorManifest } from '../vendors.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function createRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-inheritance-'))
  temporaryRoots.push(root)
  return root
}

function writeRole(root: string, role: string, fields: Record<string, unknown> = {}): string {
  const manifestPath = path.join(root, 'roles', role, 'role.yaml')
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, stringify({
    schema_version: 1,
    role_id: role,
    hosts: 'all',
    capabilities: [],
    role_vendor: {
      name: `${role}-role`,
      source: 'https://example.test/roles.git',
      projections: [{ kind: 'role-assets', source_dir: `roles/${role}` }],
    },
    ...fields,
  }))
  return manifestPath
}

function writeV2Role(root: string, role: string, fields: Record<string, unknown> = {}): string {
  const manifestPath = path.join(root, 'roles', role, 'role.yaml')
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, stringify({
    schema_version: 2,
    role_id: role,
    canonical_root: `roles/${role}`,
    extends_roles: [],
    provides: { capabilities: [] },
    installation: {
      hosts: 'all',
      role_vendor: {
        name: `${role}-role`,
        source: 'https://example.test/roles.git',
        projections: [{ kind: 'role-assets', source_dir: `roles/${role}` }],
      },
    },
    ...fields,
  }))
  return manifestPath
}

describe('role capability inheritance', () => {
  it('resolves a v2 diamond once in declared parent order with capability provenance', async () => {
    const root = createRepo()
    writeV2Role(root, 'base', { provides: { capabilities: ['common'] }, installation: undefined })
    writeV2Role(root, 'left', { extends_roles: ['base'], provides: { capabilities: ['productivity'] } })
    writeV2Role(root, 'right', { extends_roles: ['base'], provides: { capabilities: ['common', 'frontend'] } })
    const manifestPath = writeV2Role(root, 'child', {
      extends_roles: ['left', 'right'],
      provides: { capabilities: ['common', 'coding'] },
    })

    const lineage = await resolveRoleInheritance(root, 'child')
    expect(lineage.map(entry => entry.role)).toEqual(['base', 'left', 'right', 'child'])
    expect(lineage[0]?.inheritancePath).toEqual(['child', 'left', 'base'])
    const loaded = await loadVendorManifest(manifestPath)
    expect(Object.keys(loaded.vendors)).toEqual(['child-role', 'hindsight-memory', 'mattpocock', 'anthropic-skills'])
    expect(loaded.vendors['child-role']?.links.filter(link => link.source === 'capabilities/common/skills')).toHaveLength(1)
    expect(loaded.vendors['child-role']?.links.filter(link => link.source === 'capabilities/common/mcps.json')).toHaveLength(1)
    expect(loaded.origins?.['hindsight-memory']?.vendor).toEqual(['child → left → base [common]'])

    writeV2Role(root, 'reversed', { extends_roles: ['right', 'left'] })
    await expect(roleOverlayOrder(root, 'reversed')).resolves.toEqual(['base', 'right', 'left', 'reversed'])
    const reversed = await loadVendorManifest(path.join(root, 'roles', 'reversed', 'role.yaml'))
    expect(Object.keys(reversed.vendors)).toEqual(['reversed-role', 'hindsight-memory', 'anthropic-skills', 'mattpocock'])
  })

  it('inherits only capabilities from v2 parents and retains the selected installation', async () => {
    const root = createRepo()
    for (const role of ['left', 'right']) {
      writeV2Role(root, role, {
        provides: { capabilities: [role === 'left' ? 'common' : 'coding'] },
        installation: {
          hosts: ['claude'],
          assets: { skills: 'private-skills' },
          packages: [{ name: `@example/${role}-cli`, path: 'packages/cli', install: { kind: 'npm-global' } }],
          entrypoints: { initialize_project_skill: 'private-init' },
          role_vendor: {
            name: `${role}-private`,
            source: 'https://example.test/private.git',
            setup: [{ command: 'parent-setup' }],
            projections: [{ kind: 'namespace', source_dir: 'private-skills', output: 'private' }],
          },
        },
      })
    }
    const manifestPath = writeV2Role(root, 'child', {
      extends_roles: ['left', 'right'],
      installation: {
        hosts: ['codex'],
        role_vendor_position: 'after',
        role_vendor: {
          name: 'child-role',
          source: 'https://example.test/child.git',
          projections: [{ kind: 'role-assets', source_dir: 'roles/child' }],
        },
      },
    })

    const loaded = await loadVendorManifest(manifestPath)
    expect(loaded.hosts).toEqual(['codex'])
    expect(loaded.packages).toEqual([])
    expect(Object.keys(loaded.vendors)).toEqual(['hindsight-memory', 'child-role'])
    expect(loaded.vendors['child-role']?.repo).toBe('https://example.test/child.git')
    expect(loaded.vendors['child-role']?.links).toContainEqual({ kind: 'role-assets-dir', source: 'roles/child', target: 'vendor' })
    expect(Object.values(loaded.vendors).every(vendor => vendor.setup === undefined)).toBe(true)
    expect(JSON.stringify(loaded)).not.toContain('private-skills')
    expect(JSON.stringify(loaded)).not.toContain('parent-setup')
  })

  it('supports v2 declaration-only templates and roles with no capabilities', async () => {
    const root = createRepo()
    writeV2Role(root, 'base', { provides: { capabilities: ['common'] }, installation: undefined })
    writeV2Role(root, 'empty', { installation: undefined })
    const manifestPath = writeV2Role(root, 'child', { extends_roles: ['base', 'empty'] })

    const loaded = await loadVendorManifest(manifestPath)
    expect(Object.keys(loaded.vendors)).toEqual(['child-role', 'hindsight-memory'])
    const standalone = await loadVendorManifest(writeV2Role(root, 'standalone'))
    expect(Object.keys(standalone.vendors)).toEqual(['standalone-role'])
    await expect(loadVendorManifest(path.join(root, 'roles', 'base', 'role.yaml')))
      .rejects
      .toThrow(/installation\.role_vendor is required/u)
  })

  it('never executes legacy modules for v2 roles, including explicit module paths', async () => {
    const root = createRepo()
    for (const role of ['base', 'child']) {
      const constantsDir = path.join(root, 'roles', role, 'constants')
      fs.mkdirSync(constantsDir, { recursive: true })
      fs.writeFileSync(path.join(constantsDir, 'skills.js'), 'throw new Error("legacy module executed")\n')
    }
    writeV2Role(root, 'base', { provides: { capabilities: ['common'] }, installation: undefined })
    const manifestPath = writeV2Role(root, 'child', { extends_roles: ['base'] })

    await expect(roleOverlayOrder(root, 'child')).resolves.toEqual(['base', 'child'])
    const yaml = await loadVendorManifest(manifestPath)
    const legacyPath = await loadVendorManifest(path.join(root, 'roles', 'child', 'constants', 'skills.js'))
    expect(legacyPath).toEqual(yaml)
  })

  it('reports v2 missing parents and cycles with the inheritance path', async () => {
    const root = createRepo()
    writeV2Role(root, 'right')
    writeV2Role(root, 'left', { extends_roles: ['missing'] })
    const manifestPath = writeV2Role(root, 'child', { extends_roles: ['left', 'right'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/child → left → missing/u)

    writeV2Role(root, 'left', { extends_roles: ['child'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/inheritance cycle.*child → left → child/u)
  })

  it('rejects duplicate parents and mismatched v2 identities', async () => {
    const root = createRepo()
    writeV2Role(root, 'base')
    const manifestPath = writeV2Role(root, 'child', { extends_roles: ['base', 'base'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/duplicate parent role "base"/u)
    writeV2Role(root, 'child', { role_id: 'other' })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/role_id must equal "child"/u)
    writeV2Role(root, 'child', { canonical_root: 'roles/other' })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/canonical_root must equal roles\/child/u)
  })

  it('combines a single inheritance chain once and keeps child installation settings', async () => {
    const root = createRepo()
    writeRole(root, 'base', {
      capabilities: ['common', 'productivity'],
      packages: [{ name: '@example/base-cli', path: 'packages/cli', install: { kind: 'npm-global' } }],
    })
    writeRole(root, 'template', { extends_roles: ['base'], capabilities: ['common', 'coding', 'frontend'] })
    const manifestPath = writeRole(root, 'child', {
      extends_roles: ['template'],
      capabilities: ['productivity'],
      hosts: ['codex'],
      role_vendor_position: 'after',
    })

    const loaded = await loadVendorManifest(manifestPath)

    expect(loaded.hosts).toEqual(['codex'])
    expect(loaded.packages).toEqual([])
    expect(Object.keys(loaded.vendors)).toEqual(['hindsight-memory', 'mattpocock', 'anthropic-skills', 'child-role'])
    expect(loaded.vendors['child-role']?.links).toEqual([
      { kind: 'role-assets-dir', source: 'roles/child', target: 'vendor' },
      { kind: 'namespace-dir', source: 'capabilities/common/skills', target: 'vendor/skills/common' },
      { kind: 'mcp-file', source: 'capabilities/common/mcps.json', target: 'vendor/mcps/common/mcp.json' },
      { kind: 'mcp-file', source: 'capabilities/coding/mcps.json', target: 'vendor/mcps/code/mcp.json' },
      { kind: 'mcp-file', source: 'capabilities/frontend/mcps.json', target: 'vendor/mcps/frontend/mcp.json' },
    ])
    expect(Object.values(loaded.vendors).every(vendor => vendor.setup === undefined)).toBe(true)
    expect(loaded.vendors.mattpocock?.links).toEqual([
      { kind: 'namespace-dir', source: 'skills/productivity', target: 'vendor/skills/productivity' },
    ])
  })

  it.each([
    ['left', 'right'],
    ['left', 'left'],
  ])('rejects multiple parents without composing their capabilities (%s)', async (...parents) => {
    const root = createRepo()
    writeRole(root, 'left', { capabilities: ['common'] })
    writeRole(root, 'right', { capabilities: ['frontend'] })
    const manifestPath = writeRole(root, 'child', { extends_roles: parents, capabilities: ['coding'] })

    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/at most one parent role/u)
    writeRole(root, 'child', { extends_roles: parents, role_vendor: undefined })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/at most one parent role/u)
    writeRole(root, 'template', { extends_roles: parents, role_vendor: undefined })
    writeRole(root, 'child', { extends_roles: ['template'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/at most one parent role/u)
  })

  it('rejects multiple parents in a legacy vendor manifest', async () => {
    const root = createRepo()
    const manifestPath = path.join(root, 'manifest.mjs')
    fs.writeFileSync(manifestPath, 'export const extendsRoles = [\'left\', \'right\']\nexport const vendors = []\n')
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/at most one parent role/u)
  })

  it.each([undefined, []])('allows a child to get all capabilities from a declaration-only template (%s)', async (capabilities) => {
    const root = createRepo()
    writeRole(root, 'base', { capabilities: ['common'], role_vendor: undefined })
    const manifestPath = writeRole(root, 'child', { extends_roles: ['base'], capabilities })

    const loaded = await loadVendorManifest(manifestPath)

    expect(Object.keys(loaded.vendors)).toEqual(['child-role', 'hindsight-memory'])
    expect(loaded.vendors['child-role']?.links).toContainEqual({
      kind: 'mcp-file',
      source: 'capabilities/common/mcps.json',
      target: 'vendor/mcps/common/mcp.json',
    })
  })

  it('rejects missing ancestors and inheritance cycles when loading vendors', async () => {
    const root = createRepo()
    const manifestPath = writeRole(root, 'child', { extends_roles: ['missing'], capabilities: ['common'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/unknown AIRules role/i)

    writeRole(root, 'base', { extends_roles: ['child'], capabilities: ['common'] })
    writeRole(root, 'child', { extends_roles: ['base'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/inheritance cycle/i)
  })

  it.each([
    [['unknown'], /unknown capability/u],
    [['common', 'common'], /duplicate capability/u],
    ['common', /capabilities.*list/u],
  ])('validates every inherited capability declaration (%s)', async (capabilities, error) => {
    const root = createRepo()
    writeRole(root, 'base', { capabilities })
    const manifestPath = writeRole(root, 'child', { extends_roles: ['base'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(error)
  })

  it.each(['base', [1]])('rejects malformed extends_roles (%s)', async (extendsRoles) => {
    const root = createRepo()
    const manifestPath = writeRole(root, 'child', { extends_roles: extendsRoles, capabilities: ['common'] })
    await expect(loadVendorManifest(manifestPath)).rejects.toThrow(/extends_roles.*string array/u)
  })
})
