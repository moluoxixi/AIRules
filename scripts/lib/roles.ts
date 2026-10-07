import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDocument } from 'yaml'
import { isPathInside } from './canonical-path.js'
import { requireRoleName } from './role-assets.js'

export const DEFAULT_ROLE = ''
export const COMMON_ROLE = ''

export interface RolePaths {
  role: string
  roleRoot: string
  roleManifest: string
  constantsDir?: string
  constantsFile?: string
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
  const roleYamlPath = path.join(roleRoot, 'role.yaml')
  const hasRoleYaml = fs.statSync(roleYamlPath, { throwIfNoEntry: false })?.isFile() === true
  const requestedConstantsDir = path.join(roleRoot, 'constants')
  const constantsStats = fs.lstatSync(requestedConstantsDir, { throwIfNoEntry: false })
  if (!hasRoleYaml) {
    if (!constantsStats) {
      throw new Error(`Missing AIRules role skill manifest: roles/${role}/role.yaml (legacy fallback: constants/skills.ts)`)
    }
    if (!constantsStats.isDirectory() && !constantsStats.isSymbolicLink()) {
      throw new Error(`Missing AIRules role constants directory: ${requestedConstantsDir}`)
    }
  }
  const roleManifest = resolveRoleManifestPath(repoRoot, role)

  // `role.yaml` is the current contract. Validate a legacy constants tree when
  // it is present so an old role cannot smuggle an escaping manifest through a
  // repository that has already adopted the YAML contract.
  let constantsDir: string | undefined
  let constantsFile: string | undefined
  if (constantsStats) {
    if (!constantsStats.isDirectory() && !constantsStats.isSymbolicLink()) {
      throw new Error(`AIRules role constants path is not a directory: ${requestedConstantsDir}`)
    }
    constantsDir = fs.realpathSync(requestedConstantsDir)
    requireInsideRoot(roleRoot, constantsDir, 'role constants directory', 'role root')

    for (const fileName of ['skills.js', 'skills.ts']) {
      const requestedConstantsFile = path.join(constantsDir, fileName)
      const fileStats = fs.lstatSync(requestedConstantsFile, { throwIfNoEntry: false })
      if (!fileStats)
        continue
      if (!fileStats.isFile() && !fileStats.isSymbolicLink()) {
        throw new Error(`AIRules role constants file is not a file: ${requestedConstantsFile}`)
      }
      const resolvedConstantsFile = fs.realpathSync(requestedConstantsFile)
      requireInsideRoot(constantsDir, resolvedConstantsFile, 'role constants file', 'constants directory')
      constantsFile ??= resolvedConstantsFile
    }
    if (!hasRoleYaml && constantsFile === undefined) {
      throw new Error(`Missing AIRules role constants: ${path.join(constantsDir, 'skills.ts')}`)
    }
  }

  return { role, roleRoot, roleManifest, constantsDir, constantsFile }
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
        [sourceRoleRoot, path.join(sourceRoleRoot, 'role.yaml')],
        [distRoleRoot, path.join(distRoleRoot, 'role.yaml')],
        [distRoleRoot, path.join(distRoleRoot, 'constants', 'skills.js')],
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.js')],
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.ts')],
      ] as const
    : [
        [sourceRoleRoot, path.join(sourceRoleRoot, 'role.yaml')],
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.ts')],
        [sourceRoleRoot, path.join(sourceRoleRoot, 'constants', 'skills.js')],
        [distRoleRoot, path.join(distRoleRoot, 'role.yaml')],
        [distRoleRoot, path.join(distRoleRoot, 'constants', 'skills.js')],
      ] as const

  for (const [roleRoot, manifestPath] of candidates) {
    if (fs.existsSync(manifestPath)) {
      return resolveManifestCandidate(resolvedRepoRoot, roleRoot, manifestPath)
    }
  }
  throw new Error(`Missing AIRules role skill manifest: roles/${role}/role.yaml (legacy fallback: constants/skills.ts)`)
}

function resolveManifestCandidate(repoRoot: string, requestedRoleRoot: string, manifestPath: string): string {
  const roleRoot = fs.realpathSync(requestedRoleRoot)
  requireInsideRoot(repoRoot, roleRoot, 'manifest role', 'repository root')

  const manifestParent = fs.realpathSync(path.dirname(manifestPath))
  requireInsideRoot(roleRoot, manifestParent, 'manifest directory', 'role root')

  if (!fs.statSync(manifestPath).isFile()) {
    throw new Error(`AIRules role manifest is not a file: ${manifestPath}`)
  }
  const resolvedManifest = fs.realpathSync(manifestPath)
  requireInsideRoot(roleRoot, resolvedManifest, 'role manifest', 'role root')
  return resolvedManifest
}

async function loadRoleExtendsRoles(repoRoot: string, role: string): Promise<string[]> {
  const manifestPath = resolveRoleManifestPath(repoRoot, role)
  if (path.basename(manifestPath).toLowerCase() === 'role.yaml') {
    const document = parseDocument(fs.readFileSync(manifestPath, 'utf8'), {
      merge: false,
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    })
    if (document.errors.length > 0) {
      throw new Error(`Role contract "${manifestPath}" is invalid: ${document.errors.map(error => error.message).join('; ')}`)
    }
    const value = document.toJS({ maxAliasCount: 0 }) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`Role contract "${manifestPath}" must be a YAML mapping`)
    }
    const record = value as Record<string, unknown>
    const extendsRoles = record.extends_roles ?? record.extendsRoles ?? []
    if (!Array.isArray(extendsRoles) || !extendsRoles.every(roleName => typeof roleName === 'string')) {
      throw new TypeError(`roles/${role}/role.yaml field "extends_roles" must be a string array`)
    }
    return extendsRoles
  }

  const manifestUrl = pathToFileURL(path.resolve(manifestPath)).href
  const module = await import(manifestUrl)
  const extendsRoles = module.extendsRoles ?? module.default?.extendsRoles ?? []

  if (!Array.isArray(extendsRoles) || !extendsRoles.every(roleName => typeof roleName === 'string')) {
    throw new TypeError(`roles/${role}/constants/skills.ts export "extendsRoles" must be a string array`)
  }

  return extendsRoles
}

function requireInsideRoot(root: string, target: string, field: string, rootLabel: string): void {
  if (!isPathInside(root, target)) {
    throw new Error(`AIRules ${field} resolves outside ${rootLabel}: ${target}`)
  }
}
