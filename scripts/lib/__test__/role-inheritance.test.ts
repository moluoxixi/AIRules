import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
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

describe('role capability inheritance', () => {
  it('combines a diamond from ancestors to child once and keeps child installation settings', async () => {
    const root = createRepo()
    writeRole(root, 'base', {
      capabilities: ['common', 'grilling'],
      packages: [{ name: '@example/base-cli', path: 'packages/cli', install: { kind: 'npm-global' } }],
    })
    writeRole(root, 'left', { extends_roles: ['base'], capabilities: ['coding'] })
    writeRole(root, 'right', { extends_roles: ['base'], capabilities: ['common', 'frontend'] })
    const manifestPath = writeRole(root, 'child', {
      extends_roles: ['left', 'right'],
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
      { kind: 'skill', source: 'skills/productivity/grilling', target: 'vendor/skills/grilling' },
      { kind: 'namespace-dir', source: 'skills/productivity', target: 'vendor/skills/productivity' },
    ])
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
