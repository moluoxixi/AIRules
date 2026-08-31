import type { CapabilityName } from '../../../capabilities/index.js'
import type { RolePackageConfig, VendorRepo } from '../../../scripts/lib/vendors.js'
import { composeCapabilities } from '../../../capabilities/index.js'

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

export const capabilities = [
  'common',
  'coding',
  'productivity',
  'frontend',
] as const satisfies readonly CapabilityName[]

const roleVendor: VendorRepo = {
  name: 'moluoxixi',
  source: 'https://github.com/moluoxixi/AIRules.git',
  projections: [
    {
      kind: 'role-assets',
      sourceDir: 'roles/moluoxixi',
    },
  ],
}

export const vendors: VendorRepo[] = composeCapabilities(capabilities, { roleVendor })
