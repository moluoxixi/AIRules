import type { RolePackageConfig, VendorRepo } from '../../../scripts/lib/vendors.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

export const packages: RolePackageConfig[] = [
  {
    name: '@moluoxixi/airules-moluoxixi-core',
    path: 'packages/core',
  },
  {
    name: '@moluoxixi/airules-moluoxixi-cli',
    path: 'packages/cli',
    install: {
      kind: 'npm-global',
      version: 'latest',
    },
  },
]

// 角色能力（capabilities）声明在 roles/moluoxixi/role.yaml 中，由 loadVendorManifest 组合成 vendors。
export const roleVendor: VendorRepo = {
  name: 'moluoxixi',
  source: 'https://github.com/moluoxixi/AIRules.git',
  projections: [
    {
      kind: 'role-assets',
      sourceDir: 'roles/moluoxixi',
    },
  ],
}
