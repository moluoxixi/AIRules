import { existsSync } from 'node:fs'
import path from 'node:path'

export const DEFAULT_ROLE = 'development'
export const COMMON_ROLE = 'common'

export interface RolePaths {
  role: string
  roleRoot: string
  constantsDir: string
  rulesDir: string
  agentsDir: string
  skillsDir: string
  mcpDir: string
  hooksDir: string
}

export function resolveRolePaths(repoRoot: string, role = DEFAULT_ROLE): RolePaths {
  const roleRoot = path.join(repoRoot, 'roles', role)
  return {
    role,
    roleRoot,
    constantsDir: path.join(roleRoot, 'constants'),
    rulesDir: path.join(roleRoot, 'rules'),
    agentsDir: path.join(roleRoot, 'agents'),
    skillsDir: path.join(roleRoot, 'skills'),
    mcpDir: path.join(roleRoot, 'mcp'),
    hooksDir: path.join(roleRoot, 'hooks'),
  }
}

export function requireRolePaths(repoRoot: string, role = DEFAULT_ROLE): RolePaths {
  const paths = resolveRolePaths(repoRoot, role)
  if (!existsSync(paths.roleRoot)) {
    throw new Error(`Unknown AIRules role "${role}": ${paths.roleRoot}`)
  }

  return paths
}

export function roleOverlayOrder(role = DEFAULT_ROLE): string[] {
  return role === COMMON_ROLE ? [COMMON_ROLE] : [COMMON_ROLE, role]
}

export function existingRoleOverlayPaths(repoRoot: string, role = DEFAULT_ROLE): RolePaths[] {
  const selected = requireRolePaths(repoRoot, role)
  if (role === COMMON_ROLE) {
    return [selected]
  }

  const common = resolveRolePaths(repoRoot, COMMON_ROLE)
  return existsSync(common.roleRoot) ? [common, selected] : [selected]
}

export function resolveRoleManifestPath(
  repoRoot: string,
  role = DEFAULT_ROLE,
  options: { preferDist?: boolean } = {},
): string {
  const sourceManifestTs = path.join(repoRoot, 'roles', role, 'constants', 'skills.ts')
  const sourceManifestJs = path.join(repoRoot, 'roles', role, 'constants', 'skills.js')
  const distManifestJs = path.join(repoRoot, 'dist', 'roles', role, 'constants', 'skills.js')

  if (options.preferDist) {
    if (existsSync(distManifestJs)) {
      return distManifestJs
    }

    if (existsSync(sourceManifestJs)) {
      return sourceManifestJs
    }
  }

  if (existsSync(sourceManifestTs)) {
    return sourceManifestTs
  }

  if (existsSync(sourceManifestJs)) {
    return sourceManifestJs
  }

  if (existsSync(distManifestJs)) {
    return distManifestJs
  }

  throw new Error(`Missing AIRules role skill manifest: roles/${role}/constants/skills.ts`)
}
