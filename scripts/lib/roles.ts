import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_ROLE = 'openspec-development'
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

export async function roleOverlayOrder(repoRoot: string, role = DEFAULT_ROLE): Promise<string[]> {
  const orderedRoles: string[] = []
  const seenRoles = new Set<string>()
  const visitingRoles = new Set<string>()

  async function visit(roleName: string) {
    requireRolePaths(repoRoot, roleName)

    if (seenRoles.has(roleName)) {
      return
    }

    if (visitingRoles.has(roleName)) {
      throw new Error(`AIRules role inheritance cycle detected at "${roleName}"`)
    }

    visitingRoles.add(roleName)
    for (const extendedRole of await loadRoleExtendsRoles(repoRoot, roleName)) {
      await visit(extendedRole)
    }
    visitingRoles.delete(roleName)

    seenRoles.add(roleName)
    orderedRoles.push(roleName)
  }

  await visit(role)
  return orderedRoles
}

export async function existingRoleOverlayPaths(repoRoot: string, role = DEFAULT_ROLE): Promise<RolePaths[]> {
  const roles = await roleOverlayOrder(repoRoot, role)
  return roles.map(roleName => requireRolePaths(repoRoot, roleName))
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

async function loadRoleExtendsRoles(repoRoot: string, role: string): Promise<string[]> {
  const manifestPath = resolveRoleManifestPath(repoRoot, role)
  const manifestUrl = pathToFileURL(path.resolve(manifestPath)).href
  const module = await import(manifestUrl)
  const extendsRoles = module.extendsRoles ?? module.default?.extendsRoles ?? []

  if (!Array.isArray(extendsRoles) || !extendsRoles.every(roleName => typeof roleName === 'string')) {
    throw new TypeError(`roles/${role}/constants/skills.ts export "extendsRoles" must be a string array`)
  }

  return extendsRoles
}
