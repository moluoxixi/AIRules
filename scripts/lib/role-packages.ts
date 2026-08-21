import fs from 'node:fs'
import path from 'node:path'
import { isPathInside } from './canonical-path.js'
import { requireRoleName } from './role-assets.js'
import { resolveRoleManifestPath } from './roles.js'
import { loadVendorManifest } from './vendors.js'

const semverPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const roleReleaseTagPattern = /^([a-z0-9][a-z0-9-]{0,62})-v(.+)$/u

interface PackageJson {
  dependencies?: Record<string, string>
  name?: string
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  private?: boolean
  publishConfig?: {
    access?: string
  }
  scripts?: Record<string, string>
  version?: string
}

export interface ResolvedRolePackage {
  directory: string
  name: string
  packageJson: PackageJson
  relativePath: string
  version: string
}

export interface RolePackageWorkspace {
  packages: ResolvedRolePackage[]
  role: string
  roleRoot: string
  version: string
}

export interface RoleReleaseTag {
  role: string
  version: string
}

export function parseRoleReleaseTag(tagValue: string): RoleReleaseTag {
  const tag = tagValue.replace(/^refs\/tags\//u, '')
  const match = tag.match(roleReleaseTagPattern)
  if (!match || !semverPattern.test(match[2]))
    throw new Error(`Role release tag must match <role>-v<semver>: ${tagValue}`)
  return {
    role: requireRoleName(match[1]),
    version: match[2],
  }
}

export function npmDistTag(version: string): string {
  if (!semverPattern.test(version))
    throw new Error(`Invalid package semver: ${version}`)
  const prerelease = version.split('-', 2)[1]?.split('.', 1)[0]
  return prerelease && /[A-Za-z]/u.test(prerelease)
    ? prerelease.toLowerCase()
    : prerelease
      ? 'next'
      : 'latest'
}

function comparePrerelease(left: string | undefined, right: string | undefined): number {
  if (left === right)
    return 0
  if (left === undefined)
    return 1
  if (right === undefined)
    return -1
  const leftParts = left.split('.')
  const rightParts = right.split('.')
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]
    if (leftPart === rightPart)
      continue
    if (leftPart === undefined)
      return -1
    if (rightPart === undefined)
      return 1
    const leftNumeric = /^\d+$/u.test(leftPart)
    const rightNumeric = /^\d+$/u.test(rightPart)
    if (leftNumeric && rightNumeric)
      return Number(leftPart) - Number(rightPart)
    if (leftNumeric !== rightNumeric)
      return leftNumeric ? -1 : 1
    return leftPart.localeCompare(rightPart)
  }
  return 0
}

export function compareSemver(left: string, right: string): number {
  if (!semverPattern.test(left) || !semverPattern.test(right))
    throw new Error(`Cannot compare invalid semver values: ${left}, ${right}`)
  const [leftCore, leftPrerelease] = left.split('+', 1)[0].split('-', 2)
  const [rightCore, rightPrerelease] = right.split('+', 1)[0].split('-', 2)
  const leftNumbers = leftCore.split('.').map(Number)
  const rightNumbers = rightCore.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (leftNumbers[index] !== rightNumbers[index])
      return leftNumbers[index] - rightNumbers[index]
  }
  return comparePrerelease(leftPrerelease, rightPrerelease)
}

function readPackageJson(packageJsonPath: string): PackageJson {
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`Cannot read role package manifest ${packageJsonPath}: ${String(error)}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TypeError(`Role package manifest must contain a JSON object: ${packageJsonPath}`)
  return parsed as PackageJson
}

function validatePublicationOrder(packages: ResolvedRolePackage[]): void {
  const order = new Map(packages.map((rolePackage, index) => [rolePackage.name, index]))
  for (const [index, rolePackage] of packages.entries()) {
    const dependencies = {
      ...rolePackage.packageJson.peerDependencies,
      ...rolePackage.packageJson.optionalDependencies,
      ...rolePackage.packageJson.dependencies,
    }
    for (const dependencyName of Object.keys(dependencies)) {
      const dependencyIndex = order.get(dependencyName)
      if (dependencyIndex !== undefined && dependencyIndex >= index) {
        throw new Error(
          `Role package publication order is invalid: ${dependencyName} must appear before ${rolePackage.name}`,
        )
      }
    }
  }
}

export async function loadRolePackageWorkspace(repoRoot: string, roleValue: unknown): Promise<RolePackageWorkspace> {
  const role = requireRoleName(roleValue)
  const manifestPath = resolveRoleManifestPath(repoRoot, role)
  const roleRoot = fs.realpathSync(path.resolve(manifestPath, '..', '..'))
  const manifest = await loadVendorManifest(manifestPath)
  if (!manifest.packages || manifest.packages.length === 0)
    throw new Error(`AIRules role "${role}" does not declare publishable packages`)

  const packages = manifest.packages.map((config): ResolvedRolePackage => {
    const requestedDirectory = path.resolve(roleRoot, config.path)
    if (!fs.existsSync(requestedDirectory))
      throw new Error(`Role package directory does not exist: roles/${role}/${config.path}`)
    const directory = fs.realpathSync(requestedDirectory)
    if (!isPathInside(roleRoot, directory))
      throw new Error(`Role package directory escapes roles/${role}: ${config.path}`)
    const packageJsonPath = path.join(directory, 'package.json')
    if (!fs.existsSync(packageJsonPath) || !fs.statSync(packageJsonPath).isFile())
      throw new Error(`Role package is missing package.json: roles/${role}/${config.path}`)

    const packageJson = readPackageJson(packageJsonPath)
    if (packageJson.name !== config.name) {
      throw new Error(
        `Role package name mismatch at roles/${role}/${config.path}: configured ${config.name}, found ${String(packageJson.name)}`,
      )
    }
    if (typeof packageJson.version !== 'string' || !semverPattern.test(packageJson.version))
      throw new Error(`Role package ${config.name} must declare a valid semver version`)
    if (packageJson.private === true)
      throw new Error(`Role package ${config.name} is private and cannot be published`)
    if (packageJson.publishConfig?.access !== 'public')
      throw new Error(`Role package ${config.name} must set publishConfig.access to "public"`)

    return {
      directory,
      name: config.name,
      packageJson,
      relativePath: config.path,
      version: packageJson.version,
    }
  })

  const versions = new Set(packages.map(rolePackage => rolePackage.version))
  if (versions.size !== 1)
    throw new Error(`Role package versions must match: ${packages.map(item => `${item.name}@${item.version}`).join(', ')}`)
  validatePublicationOrder(packages)

  return {
    packages,
    role,
    roleRoot,
    version: packages[0].version,
  }
}

export async function discoverRolePackageWorkspaces(repoRoot: string): Promise<RolePackageWorkspace[]> {
  const rolesRoot = path.join(fs.realpathSync(path.resolve(repoRoot)), 'roles')
  if (!fs.existsSync(rolesRoot))
    return []

  const workspaces: RolePackageWorkspace[] = []
  const roleNames = fs.readdirSync(rolesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
  for (const roleName of roleNames) {
    const manifestPath = path.join(rolesRoot, roleName, 'constants', 'skills.ts')
    const javascriptManifestPath = path.join(rolesRoot, roleName, 'constants', 'skills.js')
    if (!fs.existsSync(manifestPath) && !fs.existsSync(javascriptManifestPath))
      continue
    const manifest = await loadVendorManifest(fs.existsSync(manifestPath) ? manifestPath : javascriptManifestPath)
    if ((manifest.packages?.length ?? 0) > 0)
      workspaces.push(await loadRolePackageWorkspace(repoRoot, roleName))
  }

  const packageOwners = new Map<string, string>()
  for (const workspace of workspaces) {
    for (const rolePackage of workspace.packages) {
      const owner = packageOwners.get(rolePackage.name)
      if (owner) {
        throw new Error(
          `Role package name "${rolePackage.name}" is declared by both "${owner}" and "${workspace.role}"`,
        )
      }
      packageOwners.set(rolePackage.name, workspace.role)
    }
  }
  return workspaces
}

export function requireReleaseMatchesWorkspace(
  release: RoleReleaseTag,
  workspace: RolePackageWorkspace,
): void {
  if (release.role !== workspace.role)
    throw new Error(`Release tag role "${release.role}" does not match workspace role "${workspace.role}"`)
  if (release.version !== workspace.version) {
    throw new Error(
      `Release tag version "${release.version}" does not match ${workspace.role} package version "${workspace.version}"`,
    )
  }
}
