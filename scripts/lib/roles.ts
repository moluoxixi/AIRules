import { existsSync } from 'node:fs'
import path from 'node:path'

export const DEFAULT_ROLE = 'development'
export const COMMON_ROLE = 'common'

export interface RolePaths {
  role: string
  roleRoot: string
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
