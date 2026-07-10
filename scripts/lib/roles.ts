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

export function resolveRoleManifestPath(
  repoRoot: string,
  roleValue: unknown,
  options: { preferDist?: boolean } = {},
): string {
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

function requireInsideRoot(root: string, target: string, field: string, rootLabel: string): void {
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`AIRules ${field} resolves outside ${rootLabel}: ${target}`)
  }
}
