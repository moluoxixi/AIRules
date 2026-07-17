import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_HOST_IDS, HOST_IDS } from '../../constants/hosts.js'
import {
  ensureInstallRoot,
  getDefaultInstallPaths,
  projectHostById,
  rebuildVendorSkillLinks,
  runSkillSetupCommands,
} from './install.js'
import { DEFAULT_ROLE, resolveRoleManifestPath } from './roles.js'
import { rebuildVendorAssets } from './vendor-staging.js'
import { ensureVendorRepo, verifyVendorRepoRevision } from './vendor-sync.js'
import { loadVendorManifest } from './vendors.js'
import { verifyHost } from './verify.js'

export interface ToolPaths {
  repoRoot: string
  moluoHome: string
  userHome: string
  role: string
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
}

export interface SyncResult {
  moluoHome: string
  projectedHosts: string[]
  skippedHosts: string[]
}

export interface VerifyOptions {
  home: string
  userHome?: string
  host: string
  repoRoot: string
  role?: string
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
    role,
    manifestPath: resolveManifestPath(resolvedRepoRoot, role),
  }
}

export function resolveHostTargets(host: string, supportedHosts?: string[]): string[] {
  if (host === 'all') {
    if (supportedHosts === undefined)
      return ALL_HOST_IDS
    const supported = new Set(supportedHosts)
    return ALL_HOST_IDS.filter(hostId => supported.has(hostId))
  }
  if (!HOST_IDS.includes(host))
    throw new Error(`Unknown AIRules host "${host}"`)
  if (supportedHosts !== undefined && !supportedHosts.includes(host))
    throw new Error(`AIRules role does not support host "${host}"`)
  return [host]
}

function roleSupportedHosts(paths: ToolPaths, manifest: Awaited<ReturnType<typeof loadVendorManifest>>): string[] | undefined {
  if (!paths.role)
    return undefined
  if (manifest.hosts === undefined)
    throw new Error(`AIRules role "${paths.role}" must export a "hosts" allowlist`)
  return manifest.hosts
}

async function syncVendorsIfNeeded(paths: ToolPaths, skipVendors: boolean, manifest: Awaited<ReturnType<typeof loadVendorManifest>>) {
  if (!skipVendors) {
    for (const vendor of Object.values(manifest.vendors)) {
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

/**
 * 先把所有可安装内容汇入 vendor，再从 vendor 分发到各宿主。
 * 这一步只负责 staging，不做宿主投影。
 */
async function syncVendorStaging(paths: ToolPaths, skipVendors: boolean, manifest: Awaited<ReturnType<typeof loadVendorManifest>>) {
  ensureInstallRoot({
    ...getDefaultInstallPaths(paths.userHome),
    moluoHome: paths.moluoHome,
    repoRoot: paths.repoRoot,
  })
  await syncVendorsIfNeeded(paths, skipVendors, manifest)
  if (paths.role) {
    await rebuildVendorAssets({
      homeDir: paths.moluoHome,
      role: paths.role,
      manifestPath: paths.manifestPath,
    })
  }
  else {
    await rebuildVendorSkillLinks({
      homeDir: paths.moluoHome,
      manifestPath: paths.manifestPath,
    })
  }
}

export async function syncToHosts(options: SyncOptions): Promise<SyncResult> {
  const paths = resolveToolPaths(options.repoRoot, options.home, options.userHome, options.role)
  const manifest = await loadVendorManifest(paths.manifestPath)
  const targets = resolveHostTargets(options.host, roleSupportedHosts(paths, manifest))

  await syncVendorStaging(paths, options.skipVendors, manifest)

  const projectedHosts: string[] = []
  const skippedHosts: string[] = []
  const failedHosts: string[] = []

  for (const host of targets) {
    const { success } = projectHostById(
      host,
      paths.userHome,
      paths.moluoHome,
      paths.role,
    )
    if (!success) {
      skippedHosts.push(host)
      continue
    }

    projectedHosts.push(host)
    if (options.verify) {
      const verified = await verifyHost(
        host,
        paths.moluoHome,
        paths.userHome,
      )
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
    skippedHosts,
  }
}

export async function verifyHosts(options: VerifyOptions): Promise<string[]> {
  const paths = resolveToolPaths(options.repoRoot, options.home, options.userHome, options.role)
  const manifest = await loadVendorManifest(paths.manifestPath)
  const targets = resolveHostTargets(options.host, roleSupportedHosts(paths, manifest))
  const failedHosts: string[] = []

  for (const host of targets) {
    const verified = await verifyHost(
      host,
      paths.moluoHome,
      paths.userHome,
    )
    if (!verified) {
      failedHosts.push(host)
    }
  }

  if (failedHosts.length > 0) {
    throw new Error(`Host verification failed: ${failedHosts.join(', ')}`)
  }

  return targets
}
