import type { RoleContractData } from './types/roles.js'
import fs from 'node:fs'
import { parseDocument, visit } from 'yaml'
import { requireRoleName } from './role-assets.js'

const installationFields = ['hosts', 'packages', 'assets', 'distribution', 'entrypoints', 'role_vendor', 'role_vendor_position']
const metadataFields = ['schema_version', 'role_id', 'role_version', 'status', 'canonical_root', 'description', 'extends_roles', 'provides', 'installation']

function requireRecord(value: unknown, location: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${location} must be an object`)
  return value as Record<string, unknown>
}

function requireFields(record: Record<string, unknown>, allowed: string[], location: string): void {
  for (const field of Object.keys(record)) {
    if (!allowed.includes(field))
      throw new Error(`${location} has unsupported field "${field}"`)
  }
}

export function requireRoleInheritance(value: unknown, location: string, schemaVersion: number = 1): string[] {
  if (!Array.isArray(value) || !value.every(role => typeof role === 'string'))
    throw new TypeError(`${location} must be a string array`)
  if (schemaVersion < 2 && value.length > 1)
    throw new Error(`${location} supports at most one parent role (single inheritance); use schema_version: 2 for multiple parents`)
  const seen = new Set<string>()
  for (const role of value) {
    requireRoleName(role)
    const key = role.toLowerCase()
    if (seen.has(key))
      throw new Error(`${location} declares duplicate parent role "${role}"`)
    seen.add(key)
  }
  return [...value]
}

export function readRoleContract(contractPath: string): RoleContractData {
  const location = `Role contract "${contractPath}"`
  const document = parseDocument(fs.readFileSync(contractPath, 'utf8'), {
    merge: false,
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  })
  if (document.errors.length > 0)
    throw new Error(`${location} is invalid: ${document.errors.map(error => error.message).join('; ')}`)
  visit(document, {
    Alias() {
      throw new Error(`${location} must not use YAML aliases`)
    },
  })
  const record = requireRecord(document.toJS({ maxAliasCount: 0 }), `${location} YAML mapping`)
  const schemaVersion = record.schema_version === undefined ? 1 : record.schema_version
  if (schemaVersion !== 1 && schemaVersion !== 2)
    throw new Error(`${location} schema_version must be 1 or 2`)

  let provides = record
  let installation = record
  if (schemaVersion === 2) {
    requireFields(record, metadataFields, location)
    requireRoleName(record.role_id)
    provides = requireRecord(record.provides, `${location} provides`)
    requireFields(provides, ['capabilities'], `${location} provides`)
    installation = requireRecord(record.installation === undefined ? {} : record.installation, `${location} installation`)
    requireFields(installation, installationFields, `${location} installation`)
    if (!Array.isArray(provides.capabilities))
      throw new TypeError(`${location} provides.capabilities must be a list`)
    if (installation.assets !== undefined) {
      const assets = requireRecord(installation.assets, `${location} installation.assets`)
      for (const [name, root] of Object.entries(assets)) {
        if (typeof root !== 'string' || root.length === 0)
          throw new TypeError(`${location} installation.assets.${name} must be a non-empty relative path`)
        if (/^(?:[\\/]|[A-Za-z]:)/u.test(root) || root.replaceAll('\\', '/').split('/').includes('..'))
          throw new Error(`${location} installation.assets.${name} must stay inside the role`)
      }
    }
  }
  else if (record.provides !== undefined || record.installation !== undefined) {
    throw new Error(`${location} provides/installation require schema_version: 2`)
  }
  const roleVendorPosition = schemaVersion === 2 ? installation.role_vendor_position : installation.role_vendor_position ?? installation.roleVendorPosition
  if (roleVendorPosition !== undefined && roleVendorPosition !== 'before' && roleVendorPosition !== 'after')
    throw new Error(`${location} field "role_vendor_position" must be "before" or "after"`)

  return {
    path: contractPath,
    schemaVersion,
    roleId: record.role_id,
    canonicalRoot: record.canonical_root,
    capabilities: provides.capabilities,
    extendsRoles: requireRoleInheritance(schemaVersion === 2
      ? record.extends_roles === undefined ? [] : record.extends_roles
      : record.extends_roles ?? record.extendsRoles ?? [], `${location} field "extends_roles"`, schemaVersion),
    hosts: installation.hosts,
    packages: installation.packages,
    assets: installation.assets,
    distribution: installation.distribution,
    entrypoints: installation.entrypoints,
    roleVendor: installation.role_vendor ?? installation.roleVendor,
    roleVendorPosition,
  }
}
