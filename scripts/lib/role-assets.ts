import fs from 'node:fs'
import path from 'node:path'

export interface RoleAssets {
  role: string
  roleRoot: string
  skillsDir?: string
  rulesFile?: string
  hooksDir?: string
  mcpFile?: string
}

const roleNamePattern = /^[a-z0-9][a-z0-9-]{0,62}$/u

export function requireRoleName(value: unknown): string {
  if (typeof value !== 'string' || !roleNamePattern.test(value)) {
    throw new TypeError('Invalid AIRules role name')
  }
  return value
}

export function resolveRoleAssets(home: string, roleValue: unknown): RoleAssets {
  const role = requireRoleName(roleValue)
  const rolesRoot = path.resolve(home, 'roles')
  const requestedRoot = path.join(rolesRoot, role)
  if (!fs.existsSync(requestedRoot) || !fs.statSync(requestedRoot).isDirectory()) {
    throw new Error(`AIRules role directory does not exist: ${requestedRoot}`)
  }

  const roleRoot = fs.realpathSync(requestedRoot)
  requireInsideRoot(rolesRoot, roleRoot, 'role directory')

  return {
    role,
    roleRoot,
    skillsDir: resolveOptionalAsset(roleRoot, 'skills', 'directory'),
    rulesFile: resolveOptionalAsset(roleRoot, 'rules/AGENTS.md', 'file'),
    hooksDir: resolveOptionalAsset(roleRoot, 'hooks', 'directory'),
    mcpFile: resolveOptionalAsset(roleRoot, 'mcp/mcp.json', 'file'),
  }
}

function requireInsideRoot(root: string, target: string, field: string): void {
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`AIRules ${field} resolves outside its role`)
  }
}

function resolveOptionalAsset(
  roleRoot: string,
  relativePath: string,
  kind: 'file' | 'directory',
): string | undefined {
  const requested = path.join(roleRoot, relativePath)
  if (!fs.existsSync(requested)) {
    return undefined
  }

  const resolved = fs.realpathSync(requested)
  requireInsideRoot(roleRoot, resolved, relativePath)
  const stats = fs.statSync(resolved)
  if (kind === 'file' ? !stats.isFile() : !stats.isDirectory()) {
    throw new Error(`AIRules role asset has invalid type: ${relativePath}`)
  }
  return resolved
}
