import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

function resolveManifestPath(repoRoot: string): string {
  const sourceManifestTs = path.join(repoRoot, 'constants', 'skills.ts')
  const sourceManifestJs = path.join(repoRoot, 'constants', 'skills.js')
  if (existsSync(sourceManifestTs) || existsSync(sourceManifestJs)) {
    return sourceManifestJs
  }

  return path.join(repoRoot, 'dist', 'constants', 'skills.js')
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
    ensureVendorRepo(paths.moluoHome, vendor)
  }

  runSkillSetupCommands(manifest)
}

function syncLocalSkillLayers(paths: ToolPaths) {
  syncFirstPartySkillsToVendor(paths.repoRoot, paths.moluoHome)
  syncFirstPartySkillsToVendor(path.join(paths.moluoHome, 'local'), paths.moluoHome)
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
  const installPaths = getDefaultInstallPaths(paths.userHome)
  installPaths.moluoHome = paths.moluoHome
  installPaths.repoRoot = paths.repoRoot

  ensureInstallRoot(installPaths)
  syncFirstPartyToHome(paths.repoRoot, paths.moluoHome)
  await syncVendorsIfNeeded(paths, options.skipVendors)
  await rebuildVendorSkillLinks({
    homeDir: paths.moluoHome,
    manifestPath: paths.manifestPath,
  })
  syncLocalSkillLayers(paths)

  const projectedHosts: string[] = []
  const skippedHosts: string[] = []
  const failedHosts: string[] = []

  for (const host of resolveHostTargets(options.host)) {
    const { success } = projectHostById(host, paths.userHome, paths.moluoHome)
    if (!success) {
      skippedHosts.push(host)
      continue
    }

    projectedHosts.push(host)
    linkHostBaseline({
      moluoHome: paths.moluoHome,
      host,
      userHome: paths.userHome,
    })

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
