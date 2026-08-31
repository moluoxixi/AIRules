import type { VendorProjection, VendorRepo } from '../scripts/lib/vendors.js'

export const CAPABILITY_NAMES = [
  'common',
  'coding',
  'frontend',
  'productivity',
  'engineering',
] as const

export type CapabilityName = typeof CAPABILITY_NAMES[number]

export interface CapabilityDefinition {
  roleProjections?: readonly VendorProjection[]
  vendors?: readonly VendorRepo[]
}

export interface CapabilitySelection {
  definition: CapabilityDefinition
  name: string
}

export interface ComposeCapabilitiesOptions {
  roleVendor: VendorRepo
  roleVendorPosition?: 'before' | 'after'
}
