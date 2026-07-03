import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_HOST_IDS } from '../../constants/hosts.js'
import {
  ensureInstallRoot,
  getDefaultInstallPaths,
  isSamePath,
  linkHostBaseline,
  projectHostById,
  rebuildVendorSkillLinks,
  runSkillSetupCommands,
  syncFirstPartySkillsToVendor,
  syncFirstPartyToHome,
} from './install.js'
import { flattenedSkillName } from './skill-projection.js'
import { ensureVendorRepo } from './vendor-sync.js'
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
}

export interface SyncResult {
  moluoHome: string
  projectedHosts: string[]
  skippedHosts: string[]
}

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

function resolveManifestPath(repoRoot: string): string {
  const sourceManifestTs = path.join(repoRoot, 'constants', 'skills.ts')
  const sourceManifestJs = path.join(repoRoot, 'constants', 'skills.js')
  const distManifestJs = path.join(repoRoot, 'dist', 'constants', 'skills.js')

  if (isRunningFromDist()) {
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

  return distManifestJs
}

export function resolveToolPaths(repoRoot: string, home: string, userHome = os.homedir()): ToolPaths {
  const moluoHome = path.resolve(home)
  const resolvedRepoRoot = path.resolve(repoRoot)

  return {
    repoRoot: resolvedRepoRoot,
    moluoHome,
    userHome: path.resolve(userHome),
    manifestPath: resolveManifestPath(resolvedRepoRoot),
  }
}

export function resolveHostTargets(host: string): string[] {
  return host === 'all' ? ALL_HOST_IDS : [host]
}

async function syncVendorsIfNeeded(paths: ToolPaths, skipVendors: boolean) {
  if (skipVendors) {
    return
  }

  const manifest = await loadVendorManifest(paths.manifestPath)
  for (const vendor of Object.values(manifest.vendors)) {
    if (vendor.sourceMode === 'workspace') {
      continue
    }

    ensureVendorRepo(paths.moluoHome, vendor)
  }

  runSkillSetupCommands(manifest)
}

function syncLocalSkillLayers(paths: ToolPaths, role?: string) {
  // 第一方 skills 链路恒为 <repoRoot>/roles/common + roles/<role>/skills/* → <moluoHome>/vendor/skills/*。
  // 源目录 skills/ 与目标 vendor/skills/ 永不相同，即使仓库被安装进 ~/.moluoxixi
  // （repoRoot === moluoHome）也不会产生自链接，因此必须无条件投影；
  // 否则该布局下第一方 skills 会被整体漏发。
  syncFirstPartySkillsToVendor(paths.repoRoot, paths.moluoHome, role)

  syncFirstPartySkillsToVendor(path.join(paths.moluoHome, 'local'), paths.moluoHome, role)
}

/**
 * 先把所有可安装内容汇入 vendor，再从 vendor 分发到各宿主。
 * 这一步只负责 staging，不做宿主投影。
 */
function syncVendorStaging(paths: ToolPaths, skipVendors: boolean, role?: string) {
  ensureInstallRoot({
    ...getDefaultInstallPaths(paths.userHome),
    moluoHome: paths.moluoHome,
    repoRoot: paths.repoRoot,
  })
  syncFirstPartyToHome(paths.repoRoot, paths.moluoHome, role)
  return syncVendorsIfNeeded(paths, skipVendors)
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
  const paths = resolveToolPaths(options.repoRoot, options.home, options.userHome)

  await syncVendorStaging(paths, options.skipVendors, options.role)
  await rebuildVendorSkillLinks({
    homeDir: paths.moluoHome,
    manifestPath: paths.manifestPath,
  })
  syncLocalSkillLayers(paths, options.role)

  const projectedHosts: string[] = []
  const skippedHosts: string[] = []
  const failedHosts: string[] = []

  for (const host of resolveHostTargets(options.host)) {
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
