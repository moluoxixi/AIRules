import type { VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

// 角色能力（capabilities）与 role_vendor_position 声明在 roles/matt/role.yaml 中，由 loadVendorManifest 组合成 vendors。
export const roleVendor: VendorRepo = {
  name: 'matt-role',
  source: 'https://github.com/moluoxixi/AIRules.git',
  projections: [
    {
      kind: 'role-assets',
      sourceDir: 'roles/matt',
    },
  ],
}
