import type { CapabilityName } from '../../../capabilities/index.js'
import type { VendorRepo } from '../../../scripts/lib/vendors.js'
import { composeCapabilities } from '../../../capabilities/index.js'

export const extendsRoles: string[] = []

export const hosts = 'all'

export const capabilities = [
  'engineering',
  'productivity',
] as const satisfies readonly CapabilityName[]

const roleVendor: VendorRepo = {
  name: 'matt-role',
  source: 'https://github.com/moluoxixi/AIRules.git',
  projections: [
    {
      kind: 'role-assets',
      sourceDir: 'roles/matt',
    },
  ],
}

export const vendors: VendorRepo[] = composeCapabilities(capabilities, {
  roleVendor,
  roleVendorPosition: 'after',
})
