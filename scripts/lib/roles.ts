import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { requireRoleName } from './role-assets.js'

export const DEFAULT_ROLE = ''
export const COMMON_ROLE = ''

export interface RolePaths {
  role: string
  roleRoot: string
  manifestFile: string
  constantsDir: string
  constantsFile: string
  rulesDir: string
  agentsDir: string
  skillsDir: string
  workflowDir: string
  schemasDir: string
  templatesDir: string
  adaptersDir: string
  mcpDir: string
  hooksDir: string
}

export function resolveRolePaths(repoRoot: string, roleValue: unknown): RolePaths {
  const role = requireRoleName(roleValue)
  const roleRoot = path.join(path.resolve(repoRoot), 'roles', role)
  return buildRolePaths(role, roleRoot)
}

export function requireRolePaths(repoRoot: string, roleValue: unknown): RolePaths {
  const role = requireRoleName(roleValue)
  const rolesRoot = path.join(path.resolve(repoRoot), 'roles')
  const requestedRoot = path.join(rolesRoot, role)
  if (!fs.statSync(requestedRoot, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Unknown AIRules role "${role}": ${requestedRoot}`)
  }

  const roleRoot = fs.realpathSync(requestedRoot)
  requireInsideRoot(rolesRoot, roleRoot, 'role', 'roles root')
  const paths = buildRolePaths(role, roleRoot)
  if (!fs.statSync(paths.constantsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Missing AIRules role constants directory: ${paths.constantsDir}`)
  }
  const constantsDir = fs.realpathSync(paths.constantsDir)
  requireInsideRoot(roleRoot, constantsDir, 'role constants directory', 'role root')

  const requestedConstantsFile = path.join(constantsDir, 'skills.ts')
  if (!fs.statSync(requestedConstantsFile, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing AIRules role constants: ${paths.constantsFile}`)
  }
  const constantsFile = fs.realpathSync(requestedConstantsFile)
  requireInsideRoot(constantsDir, constantsFile, 'role constants file', 'constants directory')
  return { ...paths, constantsDir, constantsFile }
}

export async function roleOverlayOrder(repoRoot: string, roleValue: unknown = DEFAULT_ROLE): Promise<string[]> {
  if (roleValue === '') {
    return []
  }

  const role = requireRoleName(roleValue)
  const orderedRoles: string[] = []
  const seenRoles = new Set<string>()
  const visitingRoles = new Set<string>()

  async function visit(roleName: string): Promise<void> {
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

export async function existingRoleOverlayPaths(
  repoRoot: string,
  roleValue: unknown = DEFAULT_ROLE,
): Promise<RolePaths[]> {
  const roles = await roleOverlayOrder(repoRoot, roleValue)
  return roles.map(role => requireRolePaths(repoRoot, role))
}

export function resolveRoleManifestPath(
  repoRoot: string,
  roleValue: unknown,
  options: { preferDist?: boolean } = {},
): string {
  if (roleValue === '') {
    const resolvedRepoRoot = fs.realpathSync(path.resolve(repoRoot))
    const sourceManifest = path.join(resolvedRepoRoot, 'scripts', 'lib', 'empty-role-manifest.ts')
    const distManifest = path.join(resolvedRepoRoot, 'dist', 'scripts', 'lib', 'empty-role-manifest.js')
    if (options.preferDist && fs.existsSync(distManifest)) {
      return distManifest
    }
    return sourceManifest
  }

  const role = requireRoleName(roleValue)
  const resolvedRepoRoot = fs.realpathSync(path.resolve(repoRoot))
  const sourceRoleRoot = path.join(resolvedRepoRoot, 'roles', role)
  const distRoleRoot = path.join(resolvedRepoRoot, 'dist', 'roles', role)
  const candidates = options.preferDist
    ? [
        [distRoleRoot, path.join(distRoleRoot, 'constants', 'skills.js')],
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.js')],
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.ts')],
      ] as const
    : [
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.ts')],
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.js')],
        [distRoleRoot, path.join(distRoleRoot, 'constants', 'skills.js')],
      ] as const

  for (const [roleRoot, manifestPath] of candidates) {
    if (fs.existsSync(manifestPath)) {
      return resolveManifestCandidate(resolvedRepoRoot, roleRoot, manifestPath)
    }
  }
  throw new Error(`Missing AIRules role skill manifest: roles/${role}/constants/skills.ts`)
}

function resolveManifestCandidate(repoRoot: string, requestedRoleRoot: string, manifestPath: string): string {
  const roleRoot = fs.realpathSync(requestedRoleRoot)
  requireInsideRoot(repoRoot, roleRoot, 'manifest role', 'repository root')

  const constantsDir = fs.realpathSync(path.dirname(manifestPath))
  requireInsideRoot(roleRoot, constantsDir, 'manifest constants directory', 'role root')

  if (!fs.statSync(manifestPath).isFile()) {
    throw new Error(`AIRules role manifest is not a file: ${manifestPath}`)
  }
  const resolvedManifest = fs.realpathSync(manifestPath)
  requireInsideRoot(constantsDir, resolvedManifest, 'role manifest', 'constants directory')
  return resolvedManifest
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

function buildRolePaths(role: string, roleRoot: string): RolePaths {
  const constantsDir = path.join(roleRoot, 'constants')
  return {
    role,
    roleRoot,
    manifestFile: path.join(roleRoot, 'role.yaml'),
    constantsDir,
    constantsFile: path.join(constantsDir, 'skills.ts'),
    rulesDir: path.join(roleRoot, 'rules'),
    agentsDir: path.join(roleRoot, 'agents'),
    skillsDir: path.join(roleRoot, 'skills'),
    workflowDir: path.join(roleRoot, 'workflow'),
    schemasDir: path.join(roleRoot, 'schemas'),
    templatesDir: path.join(roleRoot, 'templates'),
    adaptersDir: path.join(roleRoot, 'adapters'),
    mcpDir: path.join(roleRoot, 'mcp'),
    hooksDir: path.join(roleRoot, 'hooks'),
  }
}

function requireInsideRoot(root: string, target: string, field: string, rootLabel: string): void {
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`AIRules ${field} resolves outside ${rootLabel}: ${target}`)
  }
}
