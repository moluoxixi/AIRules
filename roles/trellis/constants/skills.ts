import type { CapabilityName } from '../../../capabilities/index.js'
import type { VendorRepo } from '../../../scripts/lib/vendors.js'
import { composeCapabilities } from '../../../capabilities/index.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

export const capabilities = [
  'common',
  'coding',
  'productivity',
  'frontend',
] as const satisfies readonly CapabilityName[]

const roleVendor: VendorRepo = {
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

export const vendors: VendorRepo[] = composeCapabilities(capabilities, { roleVendor })
