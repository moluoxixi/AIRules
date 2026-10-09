import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { readRoleContract } from '../role-contract.js'
import { loadVendorManifest } from '../vendors.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function writeContract(fields: Record<string, unknown> = {}, raw?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-contract-'))
  temporaryRoots.push(root)
  const manifestPath = path.join(root, 'roles', 'demo', 'role.yaml')
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, raw ?? stringify({
    schema_version: 2,
    role_id: 'demo',
    provides: { capabilities: [] },
    ...fields,
  }))
  return manifestPath
}

describe('v2 role contracts', () => {
  it('normalizes provided capabilities separately from selected installation settings', () => {
    const contract = readRoleContract(writeContract({
      extends_roles: ['left', 'right'],
      provides: { capabilities: ['common'] },
      installation: {
        assets: { skills: '.native/skills', rules: '.' },
        hosts: ['codex'],
        packages: [{ name: '@example/cli', path: 'packages/cli' }],
        distribution: { full_role_path_required: true },
        entrypoints: { initialize_project_skill: 'init-project' },
        role_vendor_position: 'after',
      },
    }))
    expect(contract).toMatchObject({
      schemaVersion: 2,
      roleId: 'demo',
      capabilities: ['common'],
      extendsRoles: ['left', 'right'],
      assets: { skills: '.native/skills', rules: '.' },
      hosts: ['codex'],
      roleVendorPosition: 'after',
    })
  })

  it.each([
    [{ capabilities: [] }, /unsupported field "capabilities"/u],
    [{ hosts: 'all' }, /unsupported field "hosts"/u],
    [{ provides: { skills: [] } }, /provides.*unsupported field "skills"/u],
    [{ installation: { capabilities: [] } }, /installation.*unsupported field "capabilities"/u],
    [{ installation: { roleVendor: {} } }, /unsupported field "roleVendor"/u],
    [{ schema_version: 3 }, /schema_version must be 1 or 2/u],
    [{ schema_version: '2' }, /schema_version must be 1 or 2/u],
    [{ schema_version: null }, /schema_version must be 1 or 2/u],
    [{ role_id: undefined }, /Invalid AIRules role name/u],
    [{ role_id: '../escape' }, /Invalid AIRules role name/u],
    [{ provides: undefined }, /provides must be an object/u],
    [{ provides: [] }, /provides must be an object/u],
    [{ provides: { capabilities: 'common' } }, /capabilities must be a list/u],
    [{ installation: [] }, /installation must be an object/u],
    [{ installation: null }, /installation must be an object/u],
    [{ installation: { assets: [] } }, /installation\.assets must be an object/u],
    [{ installation: { assets: { skills: null } } }, /non-empty relative path/u],
    [{ installation: { role_vendor_position: 'last' } }, /must be "before" or "after"/u],
    [{ installation: { role_vendor_position: null } }, /must be "before" or "after"/u],
    [{ extends_roles: null }, /extends_roles.*string array/u],
    [{ extends_roles: 'base' }, /extends_roles.*string array/u],
    [{ extends_roles: [1] }, /extends_roles.*string array/u],
    [{ extends_roles: ['../base'] }, /Invalid AIRules role name/u],
    [{ extends_roles: ['base', 'base'] }, /duplicate parent role/u],
  ])('rejects malformed or unknown fields: %j', (fields, expected) => {
    expect(() => readRoleContract(writeContract(fields))).toThrow(expected)
  })

  it.each(['../outside', '..\\outside', '/outside', 'C:\\outside', 'skills/../../outside'])('rejects escaping asset root %s', (skills) => {
    expect(() => readRoleContract(writeContract({ installation: { assets: { skills } } })))
      .toThrow(/must stay inside the role/u)
  })

  it('rejects duplicate YAML keys and alias expansion', () => {
    const duplicate = writeContract({}, 'schema_version: 2\nrole_id: demo\nrole_id: demo\nprovides: { capabilities: [] }\n')
    expect(() => readRoleContract(duplicate)).toThrow(/Map keys must be unique/u)
    const alias = writeContract({}, 'schema_version: 2\nrole_id: demo\nprovides: { capabilities: &caps [] }\ninstallation: { packages: *caps }\n')
    expect(() => readRoleContract(alias)).toThrow(/alias/iu)
  })

  it.each([
    [{ installation: { hosts: 'codex' } }, /hosts.*string array/u],
    [{ installation: { hosts: ['codex', 'codex'] } }, /hosts.*duplicates/u],
    [{ installation: { hosts: ['unknown'] } }, /unknown host/u],
    [{ installation: { packages: {} } }, /packages.*array/u],
    [{ installation: { packages: [{ name: '@example/cli', path: '../outside' }] } }, /path must stay inside/u],
    [{ provides: { capabilities: ['common', 'common'] } }, /duplicate capability/u],
    [{ provides: { capabilities: ['missing'] } }, /unknown capability/u],
    [{ provides: { capabilities: [1] } }, /unknown capability/u],
  ])('validates install and capability values when loading: %j', async (fields, expected) => {
    await expect(loadVendorManifest(writeContract(fields))).rejects.toThrow(expected)
  })

  it('keeps v1 and unversioned declarations readable without accepting mixed v2 fields', () => {
    for (const schemaVersion of [1, undefined]) {
      const manifestPath = writeContract({
        schema_version: schemaVersion,
        provides: undefined,
        hosts: 'all',
        capabilities: ['common'],
      })
      expect(readRoleContract(manifestPath)).toMatchObject({ schemaVersion: 1, capabilities: ['common'], hosts: 'all' })
    }
    expect(() => readRoleContract(writeContract({ schema_version: 1 })))
      .toThrow(/provides\/installation require schema_version: 2/u)
  })
})
