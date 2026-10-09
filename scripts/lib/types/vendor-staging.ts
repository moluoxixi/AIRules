import type { SetupCommand, VendorLink, VendorManifest } from './manifest.js'

export interface VendorAssetInventory {
  role: string
  roleRoot?: string
  skills: string[]
}

export interface RebuildVendorAssetsOptions {
  homeDir: string
  role: string
  manifestPath: string
  manifest?: VendorManifest
  beforeCommit?: () => void | Promise<void>
}

export interface PlannedAsset {
  vendorId: string
  kind: VendorLink['kind']
  source: string
  target: string
  setup: SetupCommand[]
  origin: string
}

export interface VendorStagingPlan {
  assets: PlannedAsset[]
  roleSource?: string
  roleVendorId?: string
  roleMcpPath?: string
  roleSetup?: SetupCommand[]
  roleOrigin?: string
}

export interface MaterializedPlan {
  buildRoot: string
  stagingRoot: string
  roleStagingRoot?: string
}

export type SourceKind = 'file' | 'directory'

export interface CanonicalRoleAssetRoots {
  skills: string
  mcp: string
}

export interface ManagedEntryCommit {
  current: string
  backup: string
  movedCurrent: boolean
  installedNext: boolean
}

export interface ManagedEntrySpec {
  current: string
  next: string
  backup: string
  preserveRoot?: boolean
}
