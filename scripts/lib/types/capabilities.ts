import type { VendorProjection, VendorRepo } from './manifest.js'

/** Capability ids are discovered from capability directories containing capability.yaml. */
export type CapabilityName = string

export interface CapabilityDefinition {
  roleProjections?: readonly VendorProjection[]
  vendors?: readonly VendorRepo[]
}

export interface CapabilitySelection {
  definition: CapabilityDefinition
  name: string
  origin?: string
}

export interface ComposeCapabilitiesOptions {
  roleVendor: VendorRepo
  roleVendorPosition?: 'before' | 'after'
  capabilityOrigins?: Record<string, string>
  roleOrigin?: string
}

export interface CapabilityVendorEntry {
  vendor: VendorRepo
  origin: string
  projectionOrigins?: string[][]
}
