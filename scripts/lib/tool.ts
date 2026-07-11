import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_HOST_IDS, findHostConfig, resolveHostPaths } from '../../constants/hosts.js'
import {
  ensureInstallRoot,
  getDefaultInstallPaths,
  isSamePath,
  linkHostBaseline,
  projectHostById,
  rebuildVendorSkillLinks,
  resolveSetupCommandExecutable,
  runSkillSetupCommands,
  shouldUseShellForSetupCommand,
  syncFirstPartySkillsToVendor,
  syncFirstPartyToHome,
} from './install.js'
import { DEFAULT_ROLE, resolveRoleManifestPath } from './roles.js'
import { flattenedSkillName } from './skill-projection.js'
import { rebuildVendorAssets } from './vendor-staging.js'
import { ensureVendorRepo, verifyVendorRepoRevision } from './vendor-sync.js'
import { loadVendorManifest } from './vendors.js'
import { verifyHost } from './verify.js'

export interface ToolPaths {
  repoRoot: string
  moluoHome: string
  userHome: string
  manifestPath: string
}

export interface SyncOptions {
  repoRoot: string
  home: string
  userHome?: string
  host: string
  role?: string
  skipVendors: boolean
  verify: boolean
  runOfficialEccInstall?: OfficialEccInstallRunner
}

export interface SyncResult {
  moluoHome: string
  projectedHosts: string[]
  officialInstalledHosts: string[]
  skippedHosts: string[]
}

export interface OfficialEccInstallInvocation {
  host: string
  target: string
  profile: string
  args: string[]
  userHome: string
}

export type OfficialEccInstallRunner = (invocation: OfficialEccInstallInvocation) => void | Promise<void>

export interface AddSkillOptions {
  sourceDir: string
  moluoHome: string
  name?: string
  overwrite: boolean
}

export interface AddSkillResult {
  skillName: string
  targetDir: string
}

export interface VerifyOptions {
  home: string
  userHome?: string
  host: string
}

export function getDefaultMoluoHome(): string {
  return path.join(os.homedir(), '.moluoxixi')
}

function isRunningFromDist(): boolean {
  const currentFile = fileURLToPath(import.meta.url)
  return currentFile.split(path.sep).includes('dist')
}

function resolveManifestPath(repoRoot: string, role = DEFAULT_ROLE): string {
  return resolveRoleManifestPath(repoRoot, role, { preferDist: isRunningFromDist() })
}

export function resolveToolPaths(repoRoot: string, home: string, userHome = os.homedir(), role = DEFAULT_ROLE): ToolPaths {
  const moluoHome = path.resolve(home)
  const resolvedRepoRoot = path.resolve(repoRoot)

  return {
    repoRoot: resolvedRepoRoot,
    moluoHome,
    userHome: path.resolve(userHome),
    manifestPath: resolveManifestPath(resolvedRepoRoot, role),
  }
}

export function resolveHostTargets(host: string): string[] {
  return host === 'all' ? ALL_HOST_IDS : [host]
}

const ECC_DEVELOPMENT_ROLE = 'ecc-development'

const ECC_OFFICIAL_HOSTS: Record<string, { target: string, profile: string }> = {
  claude: { target: 'claude', profile: 'core' },
  codex: { target: 'codex', profile: 'core' },
  opencode: { target: 'opencode', profile: 'opencode' },
}

const ECC_FALLBACK_DISABLED_SURFACES = [
  'rules-core',
  'commands-core',
  'hooks-runtime',
] as const

type EccFallbackDisabledSurface = typeof ECC_FALLBACK_DISABLED_SURFACES[number]

export interface EccFallbackContract {
  hostHomeRequired: boolean
  markdownAgentsOnly: boolean
  activeMcpSource: 'role-audited'
  disabledSurfaces: readonly EccFallbackDisabledSurface[]
}

const ECC_FALLBACK_CONTRACTS: Record<string, EccFallbackContract> = {
  'qoder': {
    hostHomeRequired: false,
    markdownAgentsOnly: true,
    activeMcpSource: 'role-audited',
    disabledSurfaces: ECC_FALLBACK_DISABLED_SURFACES,
  },
  'trae': {
    hostHomeRequired: true,
    markdownAgentsOnly: true,
    activeMcpSource: 'role-audited',
    disabledSurfaces: ECC_FALLBACK_DISABLED_SURFACES,
  },
  'trae-cn': {
    hostHomeRequired: true,
    markdownAgentsOnly: true,
    activeMcpSource: 'role-audited',
    disabledSurfaces: ECC_FALLBACK_DISABLED_SURFACES,
  },
}

export function getEccFallbackContract(host: string): EccFallbackContract | undefined {
  return ECC_FALLBACK_CONTRACTS[host]
}

function officialEccInstallInvocation(host: string, userHome: string): OfficialEccInstallInvocation | undefined {
  const spec = ECC_OFFICIAL_HOSTS[host]
  if (!spec) {
    return undefined
  }

  return {
    host,
    target: spec.target,
    profile: spec.profile,
    args: [
      '-y',
      '--package',
      'ecc-universal',
      'ecc',
      'install',
      '--profile',
      spec.profile,
      '--target',
      spec.target,
    ],
    userHome,
  }
}

function hostHomeExists(host: string, userHome: string): boolean {
  const config = findHostConfig(host)
  if (!config) {
    throw new Error(`Unknown host: ${host}`)
  }

  return existsSync(path.resolve(resolveHostPaths(config, userHome).hostHome))
}

function eccFallbackHostReady(host: string, userHome: string): boolean {
  const contract = getEccFallbackContract(host)
  if (!contract) {
    return false
  }

  return !contract.hostHomeRequired || hostHomeExists(host, userHome)
}

function officialEccInstallEnv(userHome: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: userHome,
    USERPROFILE: userHome,
  }
}

function runOfficialEccInstallCommand(invocation: OfficialEccInstallInvocation): void {
  console.log(`[ecc] 官方安装: ${invocation.host} -> ${invocation.target} (${invocation.profile})`)
  try {
    execFileSync(resolveSetupCommandExecutable('npx'), invocation.args, {
      env: officialEccInstallEnv(invocation.userHome),
      shell: shouldUseShellForSetupCommand('npx'),
      stdio: 'inherit',
    })
  }
  catch (error) {
    throw new Error(`[ecc] 官方安装失败: ${invocation.host} -> ${invocation.target}
${String(error)}`)
  }
}

async function syncVendorsIfNeeded(paths: ToolPaths, skipVendors: boolean) {
  const manifest = await loadVendorManifest(paths.manifestPath)
  if (!skipVendors) {
    for (const vendor of Object.values(manifest.vendors)) {
      if (vendor.sourceMode === 'workspace') {
        continue
      }

      ensureVendorRepo(paths.moluoHome, vendor)
    }

    runSkillSetupCommands(manifest)
  }
  else {
    for (const vendor of Object.values(manifest.vendors)) {
      verifyVendorRepoRevision(paths.moluoHome, vendor)
    }
  }
  return manifest
}

async function syncLocalSkillLayers(paths: ToolPaths, role: string | undefined, includeRepositoryRole: boolean) {
  // 第一方 skills 链路由 roles/<role>/constants/skills.ts 的 extendsRoles 显式决定。
  // 源目录 skills/ 与目标 vendor/skills/ 永不相同，即使仓库被安装进 ~/.moluoxixi
  // （repoRoot === moluoHome）也不会产生自链接，因此必须无条件投影；
  // 否则该布局下第一方 skills 会被整体漏发。
  if (includeRepositoryRole) {
    await syncFirstPartySkillsToVendor(paths.repoRoot, paths.moluoHome, role)
  }

  await syncFirstPartySkillsToVendor(path.join(paths.moluoHome, 'local'), paths.moluoHome, role)
}

function usesRemoteRoleAssets(manifest: Awaited<ReturnType<typeof loadVendorManifest>>, role: string | undefined): role is string {
  if (!role) {
    return false
  }
  return Object.values(manifest.vendors).some(vendor => vendor.links.some(link => link.kind === 'role-assets-dir'))
}

/**
 * 先把所有可安装内容汇入 vendor，再从 vendor 分发到各宿主。
 * 这一步只负责 staging，不做宿主投影。
 */
async function syncVendorStaging(paths: ToolPaths, skipVendors: boolean, role?: string) {
  ensureInstallRoot({
    ...getDefaultInstallPaths(paths.userHome),
    moluoHome: paths.moluoHome,
    repoRoot: paths.repoRoot,
  })
  const manifest = await syncVendorsIfNeeded(paths, skipVendors)
  const remoteRoleAssets = usesRemoteRoleAssets(manifest, role)
  if (remoteRoleAssets) {
    await rebuildVendorAssets({
      homeDir: paths.moluoHome,
      role,
      manifestPath: paths.manifestPath,
    })
  }
  else {
    await syncFirstPartyToHome(paths.repoRoot, paths.moluoHome, role)
    await rebuildVendorSkillLinks({
      homeDir: paths.moluoHome,
      manifestPath: paths.manifestPath,
    })
    await syncLocalSkillLayers(paths, role, true)
  }
}
export function addLocalSkill(options: AddSkillOptions): AddSkillResult {
  const sourceDir = path.resolve(options.sourceDir)
  const skillName = flattenedSkillName(options.name ?? path.basename(sourceDir))
  const targetDir = path.join(path.resolve(options.moluoHome), 'local', 'skills', skillName)

  if (!existsSync(path.join(sourceDir, 'SKILL.md'))) {
    throw new Error(`Skill source must contain SKILL.md: ${sourceDir}`)
  }

  if (existsSync(targetDir) && !options.overwrite && !isSamePath(sourceDir, targetDir)) {
    throw new Error(`Skill already exists: ${targetDir}. Re-run with --overwrite to replace it.`)
  }

  if (isSamePath(sourceDir, targetDir)) {
    return { skillName, targetDir }
  }

  mkdirSync(path.dirname(targetDir), { recursive: true })
  rmSync(targetDir, { recursive: true, force: true })
  cpSync(sourceDir, targetDir, { recursive: true })

  return { skillName, targetDir }
}

export async function syncToHosts(options: SyncOptions): Promise<SyncResult> {
  const paths = resolveToolPaths(options.repoRoot, options.home, options.userHome, options.role)

  await syncVendorStaging(paths, options.skipVendors, options.role)

  const projectedHosts: string[] = []
  const officialInstalledHosts: string[] = []
  const skippedHosts: string[] = []
  const failedHosts: string[] = []
  const officialEccRunner = options.runOfficialEccInstall ?? runOfficialEccInstallCommand
  const isEccDevelopmentRole = options.role === ECC_DEVELOPMENT_ROLE
  const useOfficialEccInstall = isEccDevelopmentRole && !options.skipVendors

  for (const host of resolveHostTargets(options.host)) {
    const officialEccInvocation = useOfficialEccInstall
      ? officialEccInstallInvocation(host, paths.userHome)
      : undefined

    if (officialEccInvocation) {
      if (!hostHomeExists(host, paths.userHome)) {
        skippedHosts.push(host)
        continue
      }

      await officialEccRunner(officialEccInvocation)
      officialInstalledHosts.push(host)
      continue
    }

    if (isEccDevelopmentRole && !getEccFallbackContract(host)) {
      skippedHosts.push(host)
      continue
    }

    if (isEccDevelopmentRole && !eccFallbackHostReady(host, paths.userHome)) {
      skippedHosts.push(host)
      continue
    }

    const { success, baselineProjected } = projectHostById(host, paths.userHome, paths.moluoHome)
    if (!success) {
      skippedHosts.push(host)
      continue
    }

    projectedHosts.push(host)
    if (baselineProjected) {
      linkHostBaseline({
        moluoHome: paths.moluoHome,
        host,
        userHome: paths.userHome,
      })
    }

    if (options.verify) {
      const verified = await verifyHost(host, paths.moluoHome, paths.userHome)
      if (!verified) {
        failedHosts.push(host)
      }
    }
  }

  if (failedHosts.length > 0) {
    throw new Error(`Host verification failed: ${failedHosts.join(', ')}`)
  }

  return {
    moluoHome: paths.moluoHome,
    projectedHosts,
    officialInstalledHosts,
    skippedHosts,
  }
}

export async function verifyHosts(options: VerifyOptions): Promise<string[]> {
  const paths = resolveToolPaths(process.cwd(), options.home, options.userHome)
  const failedHosts: string[] = []

  for (const host of resolveHostTargets(options.host)) {
    const verified = await verifyHost(host, paths.moluoHome, paths.userHome)
    if (!verified) {
      failedHosts.push(host)
    }
  }

  if (failedHosts.length > 0) {
    throw new Error(`Host verification failed: ${failedHosts.join(', ')}`)
  }

  return resolveHostTargets(options.host)
}
