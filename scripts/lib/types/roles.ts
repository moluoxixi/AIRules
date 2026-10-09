export interface RolePaths {
  role: string
  roleRoot: string
  roleManifest: string
  constantsDir?: string
  constantsFile?: string
}

/** Normalized fields; installation values always belong to this declaration. */
export interface RoleContractData {
  path: string
  schemaVersion: 1 | 2
  roleId?: unknown
  canonicalRoot?: unknown
  capabilities?: unknown
  extendsRoles: string[]
  hosts?: unknown
  packages?: unknown
  assets?: unknown
  distribution?: unknown
  entrypoints?: unknown
  roleVendor?: unknown
  roleVendorPosition?: 'before' | 'after'
}

export interface RoleInheritanceEntry {
  role: string
  manifestPath: string
  inheritancePath: string[]
  contract?: RoleContractData
}
