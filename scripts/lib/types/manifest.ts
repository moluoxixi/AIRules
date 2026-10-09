/**
 * Runtime-neutral declarations shared by YAML manifests and the installer.
 * These types intentionally live outside the loader so declaration files do
 * not have to import executable implementation code.
 */

export interface SetupCommand {
  command: string
  args?: string[]
  windowsCommandShim?: boolean
  skipIfCommandAvailable?: string
}

export interface RolePackageInstall {
  kind: 'npm-global'
  version?: string
}

export interface RolePackageConfig {
  name: string
  path: string
  install?: RolePackageInstall
}

export interface SkillConfig {
  name: string
  output?: string
  setup?: SetupCommand[]
}

export type SkillDef = string | SkillConfig

export type VendorProjection
  = | {
    kind: 'namespace'
    sourceDir: string
    output: string
    setup?: SetupCommand[]
  }
  | {
    kind: 'skills'
    sourceBaseDir: string
    skills: SkillDef[]
  }
  | {
    kind: 'role-assets'
    sourceDir: string
  }
  | {
    kind: 'mcp'
    sourceFile: string
    output: string
  }

export interface VendorRepo {
  name: string
  source: string
  revision?: string
  setup?: SetupCommand[]
  projections: VendorProjection[]
}

export type VendorNode = VendorRepo | { [category: string]: VendorNode[] }
export type VendorsConfig = VendorNode[]

export interface VendorLink {
  kind: 'namespace-dir' | 'skill' | 'role-assets-dir' | 'mcp-file'
  source: string
  target: string
  setup?: SetupCommand[]
}

export interface Vendor {
  repo: string
  revision?: string
  cloneDir: string
  setup?: SetupCommand[]
  links: VendorLink[]
}

export interface VendorManifest {
  hosts?: string[]
  packages?: RolePackageConfig[]
  version: number
  vendors: Record<string, Vendor>
  origins?: Record<string, { vendor: string[], links: string[][] }>
}
