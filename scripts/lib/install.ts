import type { SetupCommand } from '../../constants/skills.js'
import type { LinkEntry } from './links.js'
import type { VendorManifest } from './vendors.js'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'

import os from 'node:os'
import path from 'node:path'
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js'
import { buildLinkPlan } from './links.js'
import { collectFlattenedSkillSources, discoverSkillDirectories, flattenedSkillName } from './skill-projection.js'
import { loadVendorManifest } from './vendors.js'

// ─── 路径辅助函数：集中管理重复路径模式 ──────────────────────────────────────

/** 基线文件文件名（宿主与 vendor 目录下均使用此名） */
const BASELINE_FILE_NAME = 'AGENTS.md'

/** 仓库内基线源文件位于 rules/ 目录 */
const BASELINE_SOURCE_PATH = path.join('rules', BASELINE_FILE_NAME)

/** 获取基线文件在 vendor 目录下的绝对路径（所有宿主软链接的统一源） */
function vendorBaselinePath(moluoHome: string): string {
  return path.join(moluoHome, 'vendor', BASELINE_FILE_NAME)
}

/** 获取 vendor 技能目录的绝对路径 */
function vendorSkillsPath(homeDir: string): string {
  return path.join(homeDir, 'vendor', 'skills')
}

/** 获取 moluoxixi 本地技能投影目录的绝对路径 */
function moluoSkillsPath(moluoHome: string): string {
  return path.join(moluoHome, 'skills')
}

/** 获取全局 .agents/skills 目录的绝对路径 */
function agentsSkillsPath(userHome: string): string {
  return path.join(userHome, '.agents', 'skills')
}

function resetDir(targetDir: string) {
  removePath(targetDir)
  mkdirSync(targetDir, { recursive: true })
}

function removePath(targetPath: string) {
  try {
    const stats = lstatSync(targetPath)
    if (stats.isSymbolicLink()) {
      unlinkSync(targetPath)
      return
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }

    throw error
  }

  rmSync(targetPath, { recursive: true, force: true })
}

function ensureManagedDirectory(targetDir: string) {
  try {
    if (lstatSync(targetDir).isSymbolicLink()) {
      removePath(targetDir)
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  mkdirSync(targetDir, { recursive: true })
}

const windowsCommandShims = new Set(['codegraph', 'npm', 'npx', 'pnpm', 'yarn'])

export function resolveSetupCommandExecutable(command: string): string {
  if (process.platform === 'win32' && windowsCommandShims.has(command)) {
    return `${command}.cmd`
  }

  return command
}

export function shouldUseShellForSetupCommand(command: string): boolean {
  return process.platform === 'win32' && windowsCommandShims.has(command)
}

/**
 * 执行供应商级和 skill 级安装前置命令。
 * 任一命令失败都会抛出错误，避免安装流程伪装成功。
 * @param manifest 已解析的 VendorManifest
 */
export function runSkillSetupCommands(manifest: VendorManifest): void {
  for (const [vendorName, vendor] of Object.entries(manifest.vendors)) {
    if (vendor.setup && vendor.setup.length > 0) {
      console.log(`\n[setup] 执行 ${vendorName} 的安装前置命令...`)
      for (const command of vendor.setup) {
        const commandText = setupCommandText(command)
        console.log(`[setup] > ${commandText}`)
        try {
          execFileSync(resolveSetupCommandExecutable(command.command), command.args ?? [], {
            shell: shouldUseShellForSetupCommand(command.command),
            stdio: 'inherit',
          })
        }
        catch (error) {
          throw new Error(`[setup] ${vendorName} 安装前置命令失败: ${commandText}\n${String(error)}`)
        }
      }
    }

    for (const link of vendor.links) {
      if (!link.setup || link.setup.length === 0)
        continue

      const skillName = path.basename(link.target)
      console.log(`\n[setup] 执行 ${vendorName}/${skillName} 的安装前置命令...`)
      for (const command of link.setup) {
        const commandText = setupCommandText(command)
        console.log(`[setup] > ${commandText}`)
        try {
          execFileSync(resolveSetupCommandExecutable(command.command), command.args ?? [], {
            shell: shouldUseShellForSetupCommand(command.command),
            stdio: 'inherit',
          })
        }
        catch (error) {
          throw new Error(`[setup] ${vendorName}/${skillName} 安装前置命令失败: ${commandText}\n${String(error)}`)
        }
      }
    }
  }
}

function setupCommandText(command: SetupCommand): string {
  return [command.command, ...(command.args ?? [])].join(' ')
}

function copyDirContents(sourceDir: string, targetDir: string, options: { skipSymlinks?: boolean } = {}) {
  mkdirSync(targetDir, { recursive: true })

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name)
    const target = path.join(targetDir, entry.name)
    const sourceStats = lstatSync(source)

    if (options.skipSymlinks && sourceStats.isSymbolicLink()) {
      continue
    }

    const copySource = sourceStats.isSymbolicLink() ? realpathSync(source) : source

    removePath(target)
    cpSync(copySource, target, { recursive: true })
  }
}

function copyRequiredFile(sourceFile: string, targetFile: string) {
  mkdirSync(path.dirname(targetFile), { recursive: true })
  removePath(targetFile)
  cpSync(sourceFile, targetFile)
}

function syncOptionalDir(sourceDir: string, targetDir: string) {
  if (!existsSync(sourceDir)) {
    removePath(targetDir)
    return
  }

  resetDir(targetDir)
  copyDirContents(sourceDir, targetDir)
}

function rememberFlattenedTarget(targets: Map<string, string>, target: string, source: string) {
  const targetKey = path.resolve(target).toLowerCase()
  const previousSource = targets.get(targetKey)
  if (previousSource && !isSamePath(previousSource, source)) {
    throw new Error(`Flattened skill target collision "${target}": ${previousSource} conflicts with ${source}`)
  }

  targets.set(targetKey, source)
}

export function isSamePath(p1: string, p2: string): boolean {
  if (!p1 || !p2)
    return false
  const n1 = path.resolve(p1).toLowerCase().replace(/\\/g, '/').replace(/\/$/, '')
  const n2 = path.resolve(p2).toLowerCase().replace(/\\/g, '/').replace(/\/$/, '')
  return n1 === n2
}

function linkTypeForCurrentPlatform(): 'junction' | 'dir' {
  return process.platform === 'win32' ? 'junction' : 'dir'
}

function linkFileForCurrentPlatform(): 'file' {
  return 'file'
}

export function replaceWithSymlink(source: string, target: string, type: 'junction' | 'dir' | 'file') {
  if (isSamePath(source, target)) {
    return
  }

  // 如果目标已经是一个软链接并指向了源码，则无需重复创建
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    if (isSamePath(realpathSync(target), source)) {
      return
    }
  }

  mkdirSync(path.dirname(target), { recursive: true })
  removePath(target)
  try {
    symlinkSync(source, target, type)
  }
  catch (error) {
    const fileSystemError = error as NodeJS.ErrnoException
    if (type === 'file' && fileSystemError.code === 'EPERM' && process.platform === 'win32') {
      cpSync(source, target)
      return
    }
    throw error
  }
}

export interface InstallPaths {
  userHome: string
  moluoHome: string
  repoRoot: string
  moluoBaselineFile: string
  moluoSkillsHome: string
  globalAgentSkillsHome: string
  [key: string]: string
}

export function getDefaultInstallPaths(userHome = os.homedir()): InstallPaths {
  const moluoHome = path.join(userHome, '.moluoxixi')
  return {
    userHome,
    moluoHome,
    repoRoot: moluoHome,
    moluoBaselineFile: vendorBaselinePath(moluoHome),
    moluoSkillsHome: moluoSkillsPath(moluoHome),
    globalAgentSkillsHome: agentsSkillsPath(userHome),
  }
}

export function ensureInstallRoot(paths: InstallPaths) {
  for (const dir of [
    paths.moluoHome,
    path.join(paths.moluoHome, 'vendor'),
    path.join(paths.moluoHome, 'vendor', 'repos'),
    vendorSkillsPath(paths.moluoHome),
    paths.moluoSkillsHome,
    paths.globalAgentSkillsHome,
  ]) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * 确保全局 Agent 技能目录 (~/.agents/skills) 的链接正确。
 * ~/.agents 是行业标准共享层，始终存在。
 * 链路固定为 vendor/skills → ~/.moluoxixi/skills → ~/.agents/skills。
 * 遵循层级自愈同步逻辑。
 */
export function ensureGlobalSkillLink(paths: InstallPaths) {
  syncFlattenedSkills(vendorSkillsPath(paths.moluoHome), paths.moluoSkillsHome, paths.moluoHome)
  syncFlattenedSkills(paths.moluoSkillsHome, paths.globalAgentSkillsHome, paths.moluoHome)
}

/**
 * 同步展平的技能软链接，并清理过时链接。
 * @param sourceDir 源技能目录
 * @param targetDir 目标链接目录
 * @param moluoHome moluoxixi 根目录（用于识别自愈时需要删除的内部链接）
 */
export function syncFlattenedSkills(sourceDir: string, targetDir: string, moluoHome: string) {
  if (!existsSync(sourceDir)) {
    return
  }
  ensureManagedDirectory(targetDir)

  const skillSources = collectFlattenedSkillSources(sourceDir)
  const currentSkills = new Set(skillSources.map(skill => skill.name))

  // 自愈式同步：清理目标目录中不再需要的技能链接
  if (existsSync(targetDir)) {
    for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
      const targetPath = path.join(targetDir, entry.name)

      if (entry.isSymbolicLink()) {
        const isBroken = !existsSync(targetPath)

        if (isBroken) {
          removePath(targetPath)
          console.log(`[cleanup] 已移除失效的死链接: ${entry.name}`)
          continue
        }

        const resolvedPath = realpathSync(targetPath)
        const normalizedResolved = path.resolve(resolvedPath)
        const normalizedMoluo = path.resolve(moluoHome)
        const normalizedRepo = path.resolve(process.cwd()) // 仓库根目录

        const isInternal = normalizedResolved.startsWith(normalizedMoluo)
          || normalizedResolved.startsWith(normalizedRepo)

        // 如果该链接指向我们的项目，但不在当前技能集合中，则视为过时并移除
        if (isInternal && !currentSkills.has(entry.name)) {
          removePath(targetPath)
        }
      }
    }
  }

  // 为所有当前有效的技能创建或更新软链接
  for (const skill of skillSources) {
    const source = skill.source
    const target = path.join(targetDir, skill.name)

    replaceWithSymlink(source, target, linkTypeForCurrentPlatform())
  }
}

/**
 * 同步第一方（当前仓库内）的 agents 和基线文件到本地 moluoxixi 主目录。
 * skills 统一走 clone → vendor/skills 流程，不在此处理。
 *
 * rules/AGENTS.md 始终复制到 vendor/ 目录下，作为所有宿主基线软链接的统一源。
 * 即使 repoRoot === moluoHome（仓库本身就是安装目录），也需要执行此步骤，
 * 因为软链接最终指向的是 vendor/AGENTS.md。
 */
export function syncFirstPartyToHome(repoRoot: string, moluoHome: string) {
  // rules/AGENTS.md 始终同步到 vendor/ 下（所有宿主基线的软链接源）
  copyRequiredFile(path.join(repoRoot, BASELINE_SOURCE_PATH), vendorBaselinePath(moluoHome))

  if (isSamePath(repoRoot, moluoHome)) {
    return
  }

  syncOptionalDir(path.join(repoRoot, 'agents'), path.join(moluoHome, 'agents'))
}

/**
 * 将第一方 skills 源目录投影到 vendor/skills，作为第三方 vendor 后的本地覆盖层。
 * 该函数只清理曾经指向同一 source skills 根目录的过时链接，不会删除第三方 vendor 技能。
 */
export function syncFirstPartySkillsToVendor(sourceRoot: string, moluoHome: string) {
  const sourceSkillsDir = path.join(sourceRoot, 'skills')
  if (!existsSync(sourceSkillsDir)) {
    return
  }

  const vendorSkillsDir = vendorSkillsPath(moluoHome)
  mkdirSync(vendorSkillsDir, { recursive: true })

  const seenSkillNames = new Map<string, string>()
  const skillSources = discoverSkillDirectories(sourceSkillsDir, { followSymlinks: false }).map((source) => {
    const name = flattenedSkillName(path.basename(source))
    const nameKey = name.toLowerCase()
    const previousSource = seenSkillNames.get(nameKey)
    if (previousSource && path.resolve(previousSource) !== path.resolve(source)) {
      throw new Error(`First-party skill name collision "${name}": ${previousSource} conflicts with ${source}`)
    }

    seenSkillNames.set(nameKey, source)
    return { name, source }
  })
  const currentSkillNames = new Set(skillSources.map(skill => skill.name))
  const normalizedSourceSkillsDir = path.resolve(sourceSkillsDir)

  for (const entry of readdirSync(vendorSkillsDir, { withFileTypes: true })) {
    const targetPath = path.join(vendorSkillsDir, entry.name)
    if (!entry.isSymbolicLink()) {
      continue
    }

    if (!existsSync(targetPath)) {
      removePath(targetPath)
      continue
    }

    const resolvedPath = path.resolve(realpathSync(targetPath))
    if (resolvedPath.startsWith(normalizedSourceSkillsDir) && !currentSkillNames.has(entry.name)) {
      removePath(targetPath)
    }
  }

  for (const skill of skillSources) {
    replaceWithSymlink(
      skill.source,
      path.join(vendorSkillsDir, skill.name),
      linkTypeForCurrentPlatform(),
    )
  }
}

export async function rebuildVendorSkillLinks({ homeDir, manifestPath }: { homeDir: string, manifestPath: string }): Promise<LinkEntry[]> {
  const manifest = await loadVendorManifest(manifestPath)
  const plan = buildLinkPlan(manifest, homeDir)
  const vendorSkillsDir = vendorSkillsPath(homeDir)
  const targetSources = new Map<string, string>()

  resetDir(vendorSkillsDir)

  for (const entry of plan) {
    if (!existsSync(entry.source)) {
      continue
    }

    const linkSources = entry.kind === 'namespace-dir'
      ? collectFlattenedSkillSources(entry.source).map(skill => ({
          source: skill.source,
          target: path.join(vendorSkillsDir, skill.name),
        }))
      : [{
          source: entry.source,
          target: path.join(vendorSkillsDir, flattenedSkillName(path.basename(entry.target))),
        }]

    for (const linkSource of linkSources) {
      rememberFlattenedTarget(targetSources, linkSource.target, linkSource.source)

      if (isSamePath(linkSource.source, linkSource.target)) {
        console.log(`[link] Skip (source === target): ${linkSource.target}`)
        continue
      }

      mkdirSync(path.dirname(linkSource.target), { recursive: true })
      replaceWithSymlink(linkSource.source, linkSource.target, linkTypeForCurrentPlatform())
    }
  }

  // 为 vendor/skills 生成 .gitignore
  const projectedSkillNames = readdirSync(vendorSkillsDir).filter(n => !n.startsWith('.'))

  const gitignoreContent = [
    '# 由 rebuildVendorSkillLinks 自动生成，请勿手动编辑',
    '# 这些 vendor skill 软链接应被 git 忽略',
    ...projectedSkillNames,
    '',
  ].join('\n')

  mkdirSync(vendorSkillsDir, { recursive: true })
  writeFileSync(path.join(vendorSkillsDir, '.gitignore'), gitignoreContent, 'utf8')

  return plan
}

/**
 * 将所有技能投影到宿主软件目录（如 .claude 或 .cursor）。
 * 链路：vendor/skills → ~/.moluoxixi/skills → ~/.agents/skills → 宿主/skills
 * ~/.agents 是行业标准共享层，始终存在（不存在则创建）。
 */
export function projectSkillsToHost(userHome: string, moluoHome: string, hostSkillsHome: string) {
  const vendorSourceSkillsDir = vendorSkillsPath(moluoHome)
  const moluoTargetSkillsDir = moluoSkillsPath(moluoHome)
  const agentsSkillsDir = agentsSkillsPath(userHome)

  // 1. vendor/skills → ~/.moluoxixi/skills
  syncFlattenedSkills(vendorSourceSkillsDir, moluoTargetSkillsDir, moluoHome)

  // 2. ~/.moluoxixi/skills → ~/.agents/skills
  mkdirSync(path.join(userHome, '.agents'), { recursive: true })
  syncFlattenedSkills(moluoTargetSkillsDir, agentsSkillsDir, moluoHome)

  // 3. ~/.agents/skills → 宿主 skills 目录
  syncFlattenedSkills(agentsSkillsDir, hostSkillsHome, moluoHome)
}

function projectSharedSkillsHost(userHome: string, hostHome: string, moluoHome: string, customSkillsDirName: string = 'skills') {
  mkdirSync(hostHome, { recursive: true })
  removePath(path.join(hostHome, 'rules'))
  removePath(path.join(hostHome, 'agents'))

  projectSkillsToHost(userHome, moluoHome, path.join(hostHome, customSkillsDirName))

  if (existsSync(path.join(moluoHome, 'agents'))) {
    const agentsSource = path.join(moluoHome, 'agents')
    const agentsTarget = path.join(hostHome, 'agents')
    replaceWithSymlink(agentsSource, agentsTarget, linkTypeForCurrentPlatform())
  }
}

export function projectToHost({
  userHome,
  moluoHome,
  hostHome,
  hostBaselineFile,
  customSkillsDirName = 'skills',
}: {
  userHome: string
  moluoHome: string
  hostHome: string
  hostBaselineFile: string
  customSkillsDirName?: string
}) {
  projectSharedSkillsHost(userHome, hostHome, moluoHome, customSkillsDirName)
  replaceWithSymlink(
    vendorBaselinePath(moluoHome),
    hostBaselineFile,
    linkFileForCurrentPlatform(),
  )
}

export function linkHostBaseline({ moluoHome, host, userHome = os.homedir() }: { moluoHome: string, host: string, userHome?: string }): string {
  const source = vendorBaselinePath(moluoHome)
  const config = findHostConfig(host)
  if (!config) {
    throw new Error(`Unknown host: ${host}`)
  }

  const { hostBaselineFile } = resolveHostPaths(config, userHome)
  replaceWithSymlink(source, hostBaselineFile, linkFileForCurrentPlatform())
  return hostBaselineFile
}

/**
 * 将技能和基线投影到指定宿主，并返回是否成功（宿主目录不存在则跳过）。
 */
export function projectHostById(
  host: string,
  userHome: string,
  moluoHome: string,
): { success: boolean, hostBaselineFile: string } {
  const config = findHostConfig(host)
  if (!config) {
    throw new Error(`Unknown host: ${host}`)
  }

  const { hostHome, hostBaselineFile, skillsDirName } = resolveHostPaths(config, userHome)

  const hostHomePath = path.resolve(hostHome)
  if (!existsSync(hostHomePath)) {
    console.warn(`[skip] 宿主目录不存在，跳过投影: ${host} (${hostHomePath})`)
    return { success: false, hostBaselineFile }
  }

  projectToHost({
    userHome,
    moluoHome,
    hostHome,
    hostBaselineFile,
    customSkillsDirName: skillsDirName,
  })

  return { success: true, hostBaselineFile }
}
