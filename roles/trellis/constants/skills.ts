import type { VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

// 角色能力（capabilities）声明在 roles/trellis/role.yaml 中，由 loadVendorManifest 组合成 vendors。
export const roleVendor: VendorRepo = {
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
  ],
}
