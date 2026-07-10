import fs from 'node:fs'
import path from 'node:path'
import { requireRoleName } from './role-assets.js'

export interface RolePaths {
  role: string
  roleRoot: string
  constantsDir: string
  constantsFile: string
  rulesDir: string
  agentsDir: string
  skillsDir: string
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
  requireInsideRoot(rolesRoot, roleRoot)
  const paths = buildRolePaths(role, roleRoot)
  if (!fs.statSync(paths.constantsFile, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing AIRules role constants: ${paths.constantsFile}`)
  }
  return paths
}

export function resolveRoleManifestPath(
  repoRoot: string,
  roleValue: unknown,
  options: { preferDist?: boolean } = {},
): string {
  const role = requireRoleName(roleValue)
  const sourceManifestTs = path.join(repoRoot, 'roles', role, 'constants', 'skills.ts')
  const sourceManifestJs = path.join(repoRoot, 'roles', role, 'constants', 'skills.js')
  const distManifestJs = path.join(repoRoot, 'dist', 'roles', role, 'constants', 'skills.js')

  if (options.preferDist && fs.existsSync(distManifestJs)) {
    return distManifestJs
  }
  if (options.preferDist && fs.existsSync(sourceManifestJs)) {
    return sourceManifestJs
  }
  if (fs.existsSync(sourceManifestTs)) {
    return sourceManifestTs
  }
  if (fs.existsSync(sourceManifestJs)) {
    return sourceManifestJs
  }
  if (fs.existsSync(distManifestJs)) {
    return distManifestJs
  }
  throw new Error(`Missing AIRules role skill manifest: roles/${role}/constants/skills.ts`)
}

function buildRolePaths(role: string, roleRoot: string): RolePaths {
  const constantsDir = path.join(roleRoot, 'constants')
  return {
    role,
    roleRoot,
    constantsDir,
    constantsFile: path.join(constantsDir, 'skills.ts'),
    rulesDir: path.join(roleRoot, 'rules'),
    agentsDir: path.join(roleRoot, 'agents'),
    skillsDir: path.join(roleRoot, 'skills'),
    mcpDir: path.join(roleRoot, 'mcp'),
    hooksDir: path.join(roleRoot, 'hooks'),
  }
}

function requireInsideRoot(root: string, target: string): void {
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`AIRules role resolves outside roles root: ${target}`)
  }
}
