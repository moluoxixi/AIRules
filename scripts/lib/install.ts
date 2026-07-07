import type { AgentFormat, HookProjection, McpProjection } from '../../constants/hosts.js'
import type { LinkEntry } from './links.js'
import type { SetupCommand, VendorManifest } from './vendors.js'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'

import os from 'node:os'
import path from 'node:path'
import * as smolToml from 'smol-toml'
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js'
import { buildLinkPlan } from './links.js'
import { DEFAULT_ROLE, existingRoleOverlayPaths, roleOverlayOrder } from './roles.js'
import { collectFlattenedSkillSources, discoverSkillDirectories, flattenedSkillName } from './skill-projection.js'
import { loadVendorManifest } from './vendors.js'

// ─── 路径辅助函数：集中管理重复路径模式 ──────────────────────────────────────

/** 基线文件文件名（宿主与 vendor 目录下均使用此名） */
const BASELINE_FILE_NAME = 'AGENTS.md'

/** append 模式托管块标记：用于幂等注入和清理，保证宿主基线文件里只存在一份 AIRules 块 */
const BASELINE_BLOCK_START = '<!-- AIRULES:BASELINE:START -->'
const BASELINE_BLOCK_END = '<!-- AIRULES:BASELINE:END -->'

/**
 * 以幂等托管块把 AIRules 规则注入到宿主基线文件（如 Hermes SOUL.md）。
 * 该文件是身份/人格文件，不能整份覆盖，因此用 START/END 标记包裹规则块：
 * 每次注入先删除已存在的旧块，再把最新规则追加到文件末尾，保证只保留一份。
 * @param baselineSourceFile AIRules 规则源文件（vendor/AGENTS.md）
 * @param targetFile 宿主基线文件（如 SOUL.md），不存在时创建
 */
function injectBaselineBlock(baselineSourceFile: string, targetFile: string) {
  const ruleContent = readFileSync(baselineSourceFile, 'utf8').trim()
  const managedBlock = `${BASELINE_BLOCK_START}\n${ruleContent}\n${BASELINE_BLOCK_END}`

  const existing = existsSync(targetFile) ? readFileSync(targetFile, 'utf8') : ''

  // 删除任何已存在的托管块（含其后多余空行），避免重复注入累积
  const blockPattern = new RegExp(
    `\\n*${escapeRegExp(BASELINE_BLOCK_START)}[\\s\\S]*?${escapeRegExp(BASELINE_BLOCK_END)}\\n*`,
    'g',
  )
  const baseContent = existing.replace(blockPattern, '\n').trimEnd()

  const nextContent = baseContent.length > 0
    ? `${baseContent}\n\n${managedBlock}\n`
    : `${managedBlock}\n`

  mkdirSync(path.dirname(targetFile), { recursive: true })
  // 若目标曾是软链接（历史 symlink 模式遗留），先移除链接再写入真实文件
  if (existsSync(targetFile) && lstatSync(targetFile).isSymbolicLink()) {
    removePath(targetFile)
  }
  writeFileSync(targetFile, nextContent, 'utf8')
}

/** 转义正则元字符，使 HTML 注释标记可安全用于 RegExp */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 获取基线文件在 vendor 目录下的绝对路径（所有宿主软链接的统一源） */
function vendorBaselinePath(moluoHome: string): string {
  return path.join(moluoHome, 'vendor', BASELINE_FILE_NAME)
}

/** 获取 vendor 技能目录的绝对路径 */
function vendorSkillsPath(homeDir: string): string {
  return path.join(homeDir, 'vendor', 'skills')
}

/** 获取 vendor agents 目录的绝对路径 */
function vendorAgentsPath(moluoHome: string): string {
  return path.join(moluoHome, 'vendor', 'agents')
}

/** 获取 vendor MCP 中性源目录的绝对路径 */
function vendorMcpPath(moluoHome: string): string {
  return path.join(moluoHome, 'vendor', 'mcp')
}

/** 获取 vendor hooks 中性源目录的绝对路径 */
function vendorHooksPath(moluoHome: string): string {
  return path.join(moluoHome, 'vendor', 'hooks')
}

/** 获取全局 .agents/skills 目录的绝对路径 */
function agentsSkillsPath(userHome: string): string {
  return path.join(userHome, '.agents', 'skills')
}

function agentsMdSubagentsPath(userHome: string): string {
  return path.join(userHome, '.agents', 'subagents')
}

interface MarkdownAgent {
  fileName: string
  name: string
  description?: string
  model?: string
  body: string
}

interface NativeTomlAgentAsMarkdown {
  fileName: string
  frontmatter: Array<[string, string]>
  body: string
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
    const stats = lstatSync(targetDir)
    // 目标是软链接，或是真实文件等非目录占位物时，先移除再建目录，避免 mkdir 抛 EEXIST。
    // 真实目录保留，供自愈式同步清理其中过时条目。
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
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

function isSetupCommandAvailable(command: string): boolean {
  const lookupCommand = process.platform === 'win32' ? 'where.exe' : 'which'

  try {
    execFileSync(lookupCommand, [resolveSetupCommandExecutable(command)], {
      stdio: 'ignore',
    })
    return true
  }
  catch {
    return false
  }
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
        if (command.skipIfCommandAvailable && isSetupCommandAvailable(command.skipIfCommandAvailable)) {
          console.log(`[setup] 跳过 ${commandText}，已检测到 ${command.skipIfCommandAvailable}`)
          continue
        }

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
        if (command.skipIfCommandAvailable && isSetupCommandAvailable(command.skipIfCommandAvailable)) {
          console.log(`[setup] 跳过 ${commandText}，已检测到 ${command.skipIfCommandAvailable}`)
          continue
        }

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

function syncOptionalFile(sourceFile: string, targetFile: string) {
  if (!existsSync(sourceFile)) {
    removePath(targetFile)
    return
  }

  copyRequiredFile(sourceFile, targetFile)
}

function syncOptionalDir(sourceDir: string, targetDir: string) {
  if (!existsSync(sourceDir)) {
    removePath(targetDir)
    return
  }

  resetDir(targetDir)
  copyDirContents(sourceDir, targetDir)
}

function syncVendorResourceLink(entry: LinkEntry) {
  if (isSamePath(entry.source, entry.target)) {
    console.log(`[link] Skip (source === target): ${entry.target}`)
    return
  }

  mkdirSync(path.dirname(entry.target), { recursive: true })
  replaceWithSymlink(entry.source, entry.target, entry.kind === 'mcp-file' ? linkFileForCurrentPlatform() : linkTypeForCurrentPlatform())
}

function mergeOptionalDir(sourceDir: string, targetDir: string) {
  if (!existsSync(sourceDir)) {
    return
  }

  mkdirSync(targetDir, { recursive: true })
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
    globalAgentSkillsHome: agentsSkillsPath(userHome),
  }
}

export function ensureInstallRoot(paths: InstallPaths) {
  for (const dir of [
    paths.moluoHome,
    path.join(paths.moluoHome, 'vendor'),
    path.join(paths.moluoHome, 'vendor', 'repos'),
    vendorSkillsPath(paths.moluoHome),
    vendorAgentsPath(paths.moluoHome),
    vendorMcpPath(paths.moluoHome),
    vendorHooksPath(paths.moluoHome),
    paths.globalAgentSkillsHome,
    agentsMdSubagentsPath(paths.userHome),
  ]) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * 确保全局 Agent 技能目录 (~/.agents/skills) 的链接正确。
 * ~/.agents 是行业标准共享层，始终存在。
 * 链路固定为 vendor/skills → ~/.agents/skills。
 * 遵循层级自愈同步逻辑。
 */
export function ensureGlobalSkillLink(paths: InstallPaths) {
  syncFlattenedSkills(vendorSkillsPath(paths.moluoHome), paths.globalAgentSkillsHome, paths.moluoHome)
}

/**
 * 同步展平的技能软链接，并清理过时链接。
 * @param sourceDir 源技能目录
 * @param targetDir 目标链接目录
 * @param moluoHome moluoxixi 根目录（用于识别自愈时需要删除的内部链接）
 */
interface SyncFlattenedSkillsOptions {
  excludedSkills?: string[]
}

export function syncFlattenedSkills(
  sourceDir: string,
  targetDir: string,
  moluoHome: string,
  options: SyncFlattenedSkillsOptions = {},
) {
  if (!existsSync(sourceDir)) {
    return
  }
  ensureManagedDirectory(targetDir)

  const excludedSkills = new Set(options.excludedSkills ?? [])
  const skillSources = collectFlattenedSkillSources(sourceDir)
    .filter(skill => !excludedSkills.has(skill.name))
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
 * 同步第一方角色资产（agents、rules、MCP、hooks）到本地 vendor 目录。
 * skills 统一走 clone → vendor/skills 流程，不在此处理。
 *
 * roles/<role>/rules/AGENTS.md 存在时复制到 vendor/ 目录下，作为宿主基线软链接的统一源。
 * roles/<role>/agents、mcp、hooks 存在时也复制到 vendor/agents、vendor/mcp、vendor/hooks，避免安装产物散落在顶层目录。
 * 同步顺序为 roles/common → roles/<role>，目标角色同名资产覆盖 common。
 * product 等轻量角色可以只提供 skills，不强制带 rules/agents/mcp/hooks。
 */
export function syncFirstPartyToHome(repoRoot: string, moluoHome: string, role = DEFAULT_ROLE) {
  const rolePathsList = existingRoleOverlayPaths(repoRoot, role)
  removePath(vendorBaselinePath(moluoHome))
  removePath(vendorAgentsPath(moluoHome))
  removePath(vendorMcpPath(moluoHome))
  removePath(vendorHooksPath(moluoHome))

  for (const rolePaths of rolePathsList) {
    syncOptionalFile(path.join(rolePaths.rulesDir, BASELINE_FILE_NAME), vendorBaselinePath(moluoHome))
    mergeOptionalDir(rolePaths.agentsDir, vendorAgentsPath(moluoHome))
    // 中性 MCP 源（rulesync 风格 { mcpServers: {} }）同步到 vendor，供各宿主按格式投影。
    mergeOptionalDir(rolePaths.mcpDir, vendorMcpPath(moluoHome))
    // hook 脚本源（如 session-log.mjs）同步到 vendor/hooks，供支持 hook 的宿主投影。
    mergeOptionalDir(rolePaths.hooksDir, vendorHooksPath(moluoHome))
  }
}

/**
 * 将第一方 skills 源目录投影到 vendor/skills，作为第三方 vendor 后的本地覆盖层。
 * 该函数只清理曾经指向同一 source skills 根目录的过时链接，不会删除第三方 vendor 技能。
 */
export function syncFirstPartySkillsToVendor(sourceRoot: string, moluoHome: string, role = DEFAULT_ROLE) {
  const legacySkillsDir = path.join(sourceRoot, 'skills')
  const rolesRoot = path.join(sourceRoot, 'roles')
  const sourceSkillRoots = roleOverlayOrder(role)
    .map(roleName => path.join(sourceRoot, 'roles', roleName, 'skills'))
    .filter(existsSync)

  if (sourceSkillRoots.length === 0 && existsSync(legacySkillsDir)) {
    sourceSkillRoots.push(legacySkillsDir)
  }

  if (sourceSkillRoots.length === 0) {
    return
  }

  const vendorSkillsDir = vendorSkillsPath(moluoHome)
  mkdirSync(vendorSkillsDir, { recursive: true })

  const seenSkillNames = new Map<string, { name: string, source: string, root: string }>()

  for (const sourceSkillsDir of sourceSkillRoots) {
    for (const source of discoverSkillDirectories(sourceSkillsDir, { followSymlinks: false })) {
      const name = flattenedSkillName(path.basename(source))
      const nameKey = name.toLowerCase()
      const previousSource = seenSkillNames.get(nameKey)
      if (
        previousSource
        && path.resolve(previousSource.source) !== path.resolve(source)
        && path.resolve(previousSource.root) === path.resolve(sourceSkillsDir)
      ) {
        throw new Error(`First-party skill name collision "${name}": ${previousSource.source} conflicts with ${source}`)
      }

      seenSkillNames.set(nameKey, { name, source, root: sourceSkillsDir })
    }
  }

  const skillSources = [...seenSkillNames.values()].map(({ name, source }) => ({ name, source }))
  const currentSkillNames = new Set(skillSources.map(skill => skill.name))
  const normalizedSourceSkillRoots = sourceSkillRoots.map(sourceSkillsDir => path.resolve(sourceSkillsDir))
  const normalizedManagedSkillRoots = existsSync(rolesRoot)
    ? readdirSync(rolesRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(rolesRoot, entry.name, 'skills'))
        .filter(existsSync)
        .map(skillRoot => path.resolve(skillRoot))
    : normalizedSourceSkillRoots

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
    if (normalizedManagedSkillRoots.some(sourceSkillsDir => resolvedPath.startsWith(sourceSkillsDir)) && !currentSkillNames.has(entry.name)) {
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
      throw new Error(`Vendor "${entry.vendorId}" missing configured source directory: ${entry.source} -> ${entry.target}`)
    }

    if (entry.kind === 'agents-dir' || entry.kind === 'mcp-file') {
      syncVendorResourceLink(entry)
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
 * 链路：vendor/skills → ~/.agents/skills → 宿主/skills
 * ~/.agents 是行业标准共享层，始终存在（不存在则创建）。
 */
export function projectSkillsToHost(
  userHome: string,
  moluoHome: string,
  hostSkillsHome: string,
  options: SyncFlattenedSkillsOptions = {},
) {
  const vendorSourceSkillsDir = vendorSkillsPath(moluoHome)
  const agentsSkillsDir = agentsSkillsPath(userHome)

  // 1. vendor/skills → ~/.agents/skills
  mkdirSync(path.join(userHome, '.agents'), { recursive: true })
  syncFlattenedSkills(vendorSourceSkillsDir, agentsSkillsDir, moluoHome)

  // 2. ~/.agents/skills → 宿主 skills 目录
  syncFlattenedSkills(agentsSkillsDir, hostSkillsHome, moluoHome, options)
}

function parseSimpleYamlValue(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return ''
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function readMarkdownAgent(sourceFile: string): MarkdownAgent {
  const raw = readFileSync(sourceFile, 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw)
  if (!match) {
    throw new Error(`Agent 缺少 YAML frontmatter: ${sourceFile}`)
  }

  const frontmatter: Record<string, string | undefined> = {}
  for (const line of match[1].split(/\r?\n/u)) {
    const colonIndex = line.indexOf(':')
    if (colonIndex <= 0) {
      continue
    }
    const key = line.slice(0, colonIndex)
    if (!/^\w[\w-]*$/u.test(key)) {
      continue
    }
    frontmatter[key] = parseSimpleYamlValue(line.slice(colonIndex + 1))
  }
  const name = frontmatter.name?.trim()
  if (!name) {
    throw new Error(`Agent frontmatter 缺少 name: ${sourceFile}`)
  }

  return {
    fileName: path.basename(sourceFile),
    name,
    description: frontmatter.description?.trim(),
    model: frontmatter.model?.trim(),
    body: match[2].trim(),
  }
}

function readVendorMarkdownAgents(moluoHome: string): MarkdownAgent[] {
  return readVendorMarkdownAgentFiles(moluoHome)
    .map(sourceFile => readMarkdownAgent(sourceFile))
}

function readVendorMarkdownAgentFiles(moluoHome: string): string[] {
  const agentsDir = vendorAgentsPath(moluoHome)
  if (!existsSync(agentsDir)) {
    return []
  }

  return readdirSync(agentsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => path.join(agentsDir, entry.name))
}

function readVendorTomlAgentFiles(moluoHome: string): string[] {
  const agentsDir = vendorAgentsPath(moluoHome)
  if (!existsSync(agentsDir)) {
    return []
  }

  return readdirSync(agentsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.toml'))
    .map(entry => path.join(agentsDir, entry.name))
}

function formatYamlScalar(value: string): string {
  if (/^[\w./-]+$/u.test(value) && !/^(?:true|false|null|~)$/iu.test(value)) {
    return value
  }
  return JSON.stringify(value)
}

function stringifyMarkdownAgent(frontmatter: Array<[string, string]>, body: string): string {
  const header = frontmatter.map(([key, value]) => `${key}: ${formatYamlScalar(value)}`).join('\n')
  return `---\n${header}\n---\n\n${body.trimEnd()}\n`
}

function readNativeTomlAgentAsMarkdown(sourceFile: string): NativeTomlAgentAsMarkdown {
  const raw = readFileSync(sourceFile, 'utf8')
  const parsed = smolToml.parse(raw) as Record<string, unknown>
  const developerInstructions = parsed.developer_instructions
  if (typeof developerInstructions !== 'string') {
    throw new TypeError(`Codex TOML agent 缺少 developer_instructions: ${sourceFile}`)
  }

  const name = typeof parsed.name === 'string' && parsed.name.trim()
    ? parsed.name.trim()
    : path.basename(sourceFile, '.toml')
  const frontmatter: Array<[string, string]> = [['name', name]]
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'developer_instructions' || key === 'name') {
      continue
    }
    if (!/^\w[\w-]*$/u.test(key)) {
      throw new Error(`Codex TOML agent 字段名无法转成 Markdown frontmatter: ${sourceFile} (${key})`)
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new TypeError(`Codex TOML agent 字段无法转成 Markdown frontmatter: ${sourceFile} (${key})`)
    }
    frontmatter.push([key, String(value)])
  }

  return {
    fileName: `${path.basename(sourceFile, '.toml')}.md`,
    frontmatter,
    body: developerInstructions,
  }
}

function readNativeTomlAgentsAsMarkdown(moluoHome: string): NativeTomlAgentAsMarkdown[] {
  return readVendorTomlAgentFiles(moluoHome)
    .map(sourceFile => readNativeTomlAgentAsMarkdown(sourceFile))
}

function projectMarkdownAgentsToDirectory(moluoHome: string, targetDir: string, includeNativeTomlAgentsAsMarkdown = false) {
  const agentFiles = readVendorMarkdownAgentFiles(moluoHome)
  const nativeTomlAgents = includeNativeTomlAgentsAsMarkdown ? readNativeTomlAgentsAsMarkdown(moluoHome) : []
  if (agentFiles.length === 0 && nativeTomlAgents.length === 0) {
    removePath(targetDir)
    return
  }

  resetDir(targetDir)
  for (const sourceFile of agentFiles) {
    replaceWithSymlink(sourceFile, path.join(targetDir, path.basename(sourceFile)), linkFileForCurrentPlatform())
  }
  for (const agent of nativeTomlAgents) {
    writeFileSync(path.join(targetDir, agent.fileName), stringifyMarkdownAgent(agent.frontmatter, agent.body), 'utf8')
  }
}

function projectAgentsMdSubagents(userHome: string, moluoHome: string) {
  projectMarkdownAgentsToDirectory(moluoHome, agentsMdSubagentsPath(userHome))
}

function stringifyCodexAgentToml(agent: MarkdownAgent): string {
  const tomlObj: Record<string, string> = { name: agent.name }
  if (agent.description) {
    tomlObj.description = agent.description
  }
  if (agent.model) {
    tomlObj.model = agent.model
  }

  const restToml = smolToml.stringify(tomlObj).trimEnd()
  if (!agent.body) {
    return restToml
  }
  const tripleSingleQuote = `'`.repeat(3)
  const developerInstructionsToml = agent.body.includes(tripleSingleQuote)
    ? smolToml.stringify({ developer_instructions: agent.body }).trimEnd()
    : `developer_instructions = ${tripleSingleQuote}\n${agent.body}\n${tripleSingleQuote}`

  return `${restToml}\n${developerInstructionsToml}`
}

function projectCodexAgents(moluoHome: string, hostHome: string) {
  const markdownAgents = readVendorMarkdownAgents(moluoHome)
  const tomlAgentFiles = readVendorTomlAgentFiles(moluoHome)
  const targetDir = path.join(hostHome, 'agents')
  if (markdownAgents.length === 0 && tomlAgentFiles.length === 0) {
    removePath(targetDir)
    return
  }

  const nativeTomlNames = new Set(tomlAgentFiles.map(file => path.basename(file, '.toml')))
  const markdownNames = new Set(markdownAgents.map(agent => path.basename(agent.fileName, '.md')))
  for (const name of markdownNames) {
    if (nativeTomlNames.has(name)) {
      throw new Error(`Codex agent name collision: ${name}.md conflicts with native ${name}.toml`)
    }
  }

  resetDir(targetDir)
  for (const sourceFile of tomlAgentFiles) {
    copyRequiredFile(sourceFile, path.join(targetDir, path.basename(sourceFile)))
  }
  for (const agent of markdownAgents) {
    const targetFile = path.join(targetDir, agent.fileName.replace(/\.md$/u, '.toml'))
    writeFileSync(targetFile, `${stringifyCodexAgentToml(agent)}\n`, 'utf8')
  }
}

function projectSharedSkillsHost(
  userHome: string,
  hostHome: string,
  moluoHome: string,
  customSkillsDirName: string = 'skills',
  excludedSkills: string[] = [],
  agentFormat: AgentFormat = 'markdown',
  includeNativeTomlAgentsAsMarkdown = false,
) {
  mkdirSync(hostHome, { recursive: true })
  removePath(path.join(hostHome, 'rules'))
  removePath(path.join(hostHome, 'agents'))

  projectSkillsToHost(userHome, moluoHome, path.join(hostHome, customSkillsDirName), { excludedSkills })

  if (agentFormat === 'agentsmd') {
    projectAgentsMdSubagents(userHome, moluoHome)
    return
  }

  if (agentFormat === 'markdown') {
    projectMarkdownAgentsToDirectory(moluoHome, path.join(hostHome, 'agents'), includeNativeTomlAgentsAsMarkdown)
    return
  }

  if (agentFormat === 'toml') {
    projectCodexAgents(moluoHome, hostHome)
    return
  }

  if (agentFormat === 'json' && existsSync(vendorAgentsPath(moluoHome))) {
    console.warn(`[skip] 宿主 agent 格式为 ${agentFormat}，转译层未实现，跳过 agents 投影: ${hostHome}`)
  }
}

/** 转义 TOML 基础字符串字面量：反斜杠、双引号、以及换行等控制字符（TOML 基础字符串不允许裸控制字符）。 */
function escapeTomlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    // 其余 C0 控制字符（除已处理的 \\n \\r \\t）按 TOML 规范用 \\uXXXX 转义
    // eslint-disable-next-line no-control-regex -- 故意匹配控制字符以转义，防止裸控制字符破坏 TOML
    .replace(/[\u0000-\u0008\v\f\u000E-\u001F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

/** TOML 裸键仅允许 A-Za-z0-9_-；否则用引号键并转义，避免 name/env-key 破坏表头结构。 */
function tomlKey(key: string): string {
  return /^[\w-]+$/.test(key) ? key : `"${escapeTomlString(key)}"`
}

/**
 * 读取中性 MCP 源（~/.moluoxixi/vendor/mcp/mcp.json，rulesync 风格 { mcpServers: {...} }）。
 * 源不存在或无服务时返回 undefined，调用方据此做 no-op（无服务可分发，非失败）。
 */
function readNeutralMcpServers(moluoHome: string): Record<string, unknown> | undefined {
  const sourceFile = path.join(vendorMcpPath(moluoHome), 'mcp.json')
  if (!existsSync(sourceFile)) {
    return undefined
  }
  const raw = readFileSync(sourceFile, 'utf8').trim()
  if (raw.length === 0) {
    return undefined
  }
  let parsed: { mcpServers?: Record<string, unknown> }
  try {
    parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> }
  }
  catch (error) {
    throw new Error(`中性 MCP 源解析失败 ${sourceFile}: ${String(error)}`)
  }
  const servers = parsed.mcpServers
  if (!servers || Object.keys(servers).length === 0) {
    return undefined
  }
  return servers
}

/**
 * 读取宿主已有配置文件用于合并。
 * 若目标是软链接，先移除链接再按不存在处理，避免后续 writeFileSync 写穿到链接目标污染共享配置。
 * 返回 { content }：content 为去链接后文件的真实文本（不存在则空串）。
 */
function readHostConfigForMerge(targetFile: string): string {
  if (existsSync(targetFile) && lstatSync(targetFile).isSymbolicLink()) {
    removePath(targetFile)
    return ''
  }
  return existsSync(targetFile) ? readFileSync(targetFile, 'utf8').replace(/^\uFEFF/u, '') : ''
}

/**
 * 把中性 MCP 源按宿主规格写到宿主对应的 MCP 配置文件。
 * - JSON 宿主：用 mcp.serversKey 作为服务表键名（多数为 mcpServers，OpenCode 为 mcp）；
 *   保留文件已有其它顶层字段，且对 serversKey 做浅合并，不清掉用户手写的其它 server。
 * - TOML 宿主（Codex）：以 AIRULES 托管块写 [mcp_servers.<name>] 表，幂等替换，保留块外内容。
 * 源缺失时 no-op（不写文件、不报错）。映射依据见 knowledge/架构/host-agent-mcp-mapping.md。
 */
function applyMcpServerOverrides(servers: Record<string, unknown>, overrides: McpProjection['serverOverrides']): Record<string, unknown> {
  if (!overrides || Object.keys(overrides).length === 0) {
    return servers
  }

  const projected: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(servers)) {
    const override = overrides[name]
    if (!override) {
      projected[name] = value
      continue
    }
    const base = typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    projected[name] = { ...base, ...override }
  }
  return projected
}

function projectMcpToHost(moluoHome: string, mcpHome: string, mcp: McpProjection) {
  const servers = readNeutralMcpServers(moluoHome)
  if (!servers) {
    return
  }
  const projectedServers = applyMcpServerOverrides(servers, mcp.serverOverrides)

  const targetDir = mcp.relDir === '.' ? mcpHome : path.join(mcpHome, mcp.relDir)
  const targetFile = path.join(targetDir, mcp.fileName)
  mkdirSync(targetDir, { recursive: true })

  if (mcp.format === 'json') {
    const prev = readHostConfigForMerge(targetFile)
    let existing: Record<string, unknown> = {}
    if (prev.trim().length > 0) {
      try {
        existing = JSON.parse(prev) as Record<string, unknown>
      }
      catch (error) {
        throw new Error(`宿主 MCP 配置解析失败 ${targetFile}（请修复其 JSON 语法后重试）: ${String(error)}`)
      }
    }
    if (mcp.defaultTopLevel) {
      existing = { ...mcp.defaultTopLevel, ...existing }
    }
    // 浅合并，用户优先：只补用户尚未配置的 server，绝不覆盖用户手写的同名 server（含其调过的参数）。
    const existingServers = (typeof existing[mcp.serversKey] === 'object' && existing[mcp.serversKey] !== null)
      ? existing[mcp.serversKey] as Record<string, unknown>
      : {}
    existing[mcp.serversKey] = { ...projectedServers, ...existingServers }
    writeFileSync(targetFile, `${JSON.stringify(existing, null, 2)}\n`, 'utf8')
    return
  }

  // TOML（Codex）：先清理本工具的旧托管块，再探测用户在块外手写的 server，用户优先不覆盖。
  const prev = readHostConfigForMerge(targetFile)
  // 托管块清理：匹配 START 到 END 或文件尾，兼容上次写入被截断（只剩 START 无 END）的残块，避免重复 server 定义。
  const cleaned = prev.replace(/\n*# >>> AIRULES MCP >>>[\s\S]*?(?:# <<< AIRULES MCP <<<|$)\n*/g, '\n').trimEnd()
  // 探测块外用户已声明的 server 名（裸键或引号键），这些不再由 AIRULES 注入，避免覆盖用户配置。
  const serversKeyPattern = mcp.serversKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const userDeclared = new Set<string>()
  const tableRe = new RegExp(`^\\s*\\[${serversKeyPattern}\\.(?:"([^"]+)"|([\\w-]+))\\]`, 'gm')
  for (const m of cleaned.matchAll(tableRe)) {
    userDeclared.add(m[1] ?? m[2])
  }

  const tomlLines: string[] = []
  for (const [name, value] of Object.entries(projectedServers)) {
    if (userDeclared.has(name)) {
      continue
    }
    const server = value as { command?: string, args?: string[], env?: Record<string, string> }
    tomlLines.push(`[${mcp.serversKey}.${tomlKey(name)}]`)
    if (server.command) {
      tomlLines.push(`command = "${escapeTomlString(server.command)}"`)
    }
    if (Array.isArray(server.args)) {
      tomlLines.push(`args = [${server.args.map(a => `"${escapeTomlString(String(a))}"`).join(', ')}]`)
    }
    if (server.env && Object.keys(server.env).length > 0) {
      const envLiteral = Object.entries(server.env)
        .map(([k, v]) => `${tomlKey(k)} = "${escapeTomlString(String(v))}"`)
        .join(', ')
      tomlLines.push(`env = { ${envLiteral} }`)
    }
    tomlLines.push('')
  }

  // 全部 server 都已被用户声明时不写空托管块。
  if (tomlLines.length === 0) {
    if (cleaned !== prev.trimEnd()) {
      writeFileSync(targetFile, cleaned.length > 0 ? `${cleaned}\n` : '', 'utf8')
    }
    return
  }

  const block = `# >>> AIRULES MCP >>>\n${tomlLines.join('\n')}# <<< AIRULES MCP <<<\n`
  const next = cleaned.length > 0 ? `${cleaned}\n\n${block}` : block
  writeFileSync(targetFile, next, 'utf8')
}

/** 受管条目识别：command 串含本脚本名即视为 AIRULES 受管（兼容扁平/嵌套两种条目形态）。 */
function isManagedHookCommand(value: unknown, scriptName: string): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const cmd = value as { command?: unknown, args?: unknown }
  const inArgs = Array.isArray(cmd.args) && cmd.args.some(a => typeof a === 'string' && a.includes(scriptName))
  const inCommand = typeof cmd.command === 'string' && cmd.command.includes(scriptName)
  return inArgs || inCommand
}

/**
 * 把会话自动记录 Stop hook 投影到宿主配置文件。
 * - 先把 vendor/hooks/<scriptName> 拷到宿主 hooks 目录（稳定绝对路径）。
 * - JSON 宿主（Claude/Qoder/Trae/Cursor settings.json|hooks.json）：浅合并 hooks.<event>，幂等
 *   替换指向本脚本的受管条目，保留用户手写的其它 hook 与其它顶层键。按 version/nesting/includeType
 *   适配各宿主结构差异。
 * - TOML 宿主（Codex config.toml）：用 AIRULES HOOK 受管块写 [[hooks.<event>]]，幂等替换，
 *   保留块外用户内容。
 * 中性源脚本缺失时 no-op（不写文件、不报错）。映射依据见 knowledge/架构/host-hook-mapping.md。
 */
function projectHooksToHost(moluoHome: string, hooksHome: string, hooks: HookProjection) {
  const sourceScript = path.join(vendorHooksPath(moluoHome), hooks.scriptName)
  if (!existsSync(sourceScript)) {
    return
  }

  // 1. 脚本拷到宿主 hooks 目录，配置里引用其绝对路径。
  const hostHooksDir = path.join(hooksHome, 'hooks')
  const hostScript = path.join(hostHooksDir, hooks.scriptName)
  copyRequiredFile(sourceScript, hostScript)

  const targetDir = hooks.relDir === '.' ? hooksHome : path.join(hooksHome, hooks.relDir)
  const targetFile = path.join(targetDir, hooks.fileName)
  mkdirSync(targetDir, { recursive: true })

  if (hooks.format === 'json') {
    projectHooksJson(targetFile, hooks, hostScript)
    return
  }
  projectHooksToml(targetFile, hooks.event, hostScript, hooks.scriptName)
}

/** 构造一条受管条目：command 统一用 shell 串 `node "<脚本>"`（各 JSON 宿主都接受 command 串）。 */
function buildManagedJsonEntry(hooks: HookProjection, hostScript: string): Record<string, unknown> {
  const entry: Record<string, unknown> = { command: `node "${hostScript}"` }
  if (hooks.includeType) {
    entry.type = 'command'
  }
  // flat 宿主（Cursor）：event 下直接是 [{command}]；group 宿主：包一层 { hooks: [entry] }。
  return hooks.nesting === 'flat' ? entry : { hooks: [entry] }
}

/** JSON 宿主：在 hooks.<event>[] 里幂等放置一条受管条目，保留用户内容。 */
function projectHooksJson(targetFile: string, hooks: HookProjection, hostScript: string) {
  const { event, scriptName, nesting = 'group', version } = hooks
  const prev = readHostConfigForMerge(targetFile)
  let root: Record<string, unknown> = {}
  if (prev.trim().length > 0) {
    try {
      root = JSON.parse(prev) as Record<string, unknown>
    }
    catch (error) {
      throw new Error(`宿主 hooks 配置解析失败 ${targetFile}（请修复其 JSON 语法后重试）: ${String(error)}`)
    }
  }

  // 顶层 version：宿主要求且用户未声明时补齐（不覆盖用户已写的 version）。
  if (typeof version === 'number' && root.version === undefined) {
    root.version = version
  }

  const hooksObj = (typeof root.hooks === 'object' && root.hooks !== null && !Array.isArray(root.hooks))
    ? root.hooks as Record<string, unknown>
    : {}
  const eventEntries = Array.isArray(hooksObj[event]) ? hooksObj[event] as unknown[] : []

  // 自愈：剔除任何"指向本脚本"的受管条目，再追加最新一条。
  const cleaned: unknown[] = []
  for (const item of eventEntries) {
    if (nesting === 'flat') {
      // 扁平：条目本身就是 {command}。
      if (!isManagedHookCommand(item, scriptName)) {
        cleaned.push(item)
      }
      continue
    }
    // 嵌套：条目是 { hooks: [...] }，剔除其内层受管条目。
    if (typeof item !== 'object' || item === null) {
      cleaned.push(item)
      continue
    }
    const g = item as { hooks?: unknown }
    if (!Array.isArray(g.hooks)) {
      cleaned.push(item)
      continue
    }
    const keptInner = g.hooks.filter(h => !isManagedHookCommand(h, scriptName))
    if (keptInner.length > 0) {
      cleaned.push({ ...item, hooks: keptInner })
    }
    else if (g.hooks.length === keptInner.length) {
      cleaned.push(item) // 本来就没有受管条目，原样保留
    }
    // 否则该 group 只含受管条目，整组丢弃，避免堆积空 group。
  }

  cleaned.push(buildManagedJsonEntry(hooks, hostScript))
  hooksObj[event] = cleaned
  root.hooks = hooksObj
  writeFileSync(targetFile, `${JSON.stringify(root, null, 2)}\n`, 'utf8')
}

/** 迁移兼容：清理旧版无 scriptName 的通用受管块（`# >>> AIRULES HOOK >>>` 后直接 `>>>`）。 */
const LEGACY_HOOK_BLOCK_REGEX = /\n*# >>> AIRULES HOOK >>>[\s\S]*?(?:# <<< AIRULES HOOK <<<|$)\n*/g

/** TOML 宿主（Codex）：用受管块写 [[hooks.<event>]]，幂等替换、保留块外用户内容。 */
function projectHooksToml(targetFile: string, event: string, hostScript: string, scriptName: string) {
  const prev = readHostConfigForMerge(targetFile)
  // 受管块按 scriptName 作唯一标识，使同一文件的多事件投影（Stop / SubagentStop / PreToolUse）
  // 各自独立幂等——只替换本脚本的块，不误删其它脚本的块。旧版无 scriptName 的通用块一并清理（迁移兼容）。
  const marker = scriptMarker(scriptName)
  const cleaned = prev
    .replace(scopedHookBlockRegex(marker), '\n')
    .replace(LEGACY_HOOK_BLOCK_REGEX, '\n')
    .trimEnd()

  // command 是 shell 命令串：node "<脚本绝对路径>"（.mjs 非直接可执行，必须经 node 启动）。
  // 整串用单引号 TOML 字面量（不转义反斜杠，Windows 路径安全）；脚本路径含单引号时回退双引号转义。
  const shellCommand = `node "${hostScript}"`
  const commandLiteral = shellCommand.includes('\'')
    ? `"${escapeTomlString(shellCommand)}"`
    : `'${shellCommand}'`
  const blockBody = [
    `[[hooks.${event}]]`,
    '',
    `[[hooks.${event}.hooks]]`,
    'type = "command"',
    `command = ${commandLiteral}`,
    '',
  ].join('\n')
  const block = `# >>> ${marker} >>>\n${blockBody}# <<< ${marker} <<<\n`
  const next = cleaned.length > 0 ? `${cleaned}\n\n${block}` : block
  mkdirSync(path.dirname(targetFile), { recursive: true })
  writeFileSync(targetFile, next, 'utf8')
}

/** 受管块标识：按 scriptName 区分，使同一 TOML 文件多事件投影互不覆盖。 */
function scriptMarker(scriptName: string): string {
  return `AIRULES HOOK ${scriptName}`
}

/** 匹配某脚本专属受管块（含起止哨兵）。 */
function scopedHookBlockRegex(marker: string): RegExp {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\n*# >>> ${escaped} >>>[\\s\\S]*?(?:# <<< ${escaped} <<<|$)\\n*`, 'g')
}

export function projectToHost({
  userHome,
  moluoHome,
  hostHome,
  hostBaselineFile,
  projectBaseline = true,
  baselineMode = 'symlink',
  customSkillsDirName = 'skills',
  excludedSkills = [],
  agentFormat = 'markdown',
  projectSharedResources = true,
  mcpHome = hostHome,
  mcp,
  hooksHome = hostHome,
  hooks,
  includeNativeTomlAgentsAsMarkdown = false,
}: {
  userHome: string
  moluoHome: string
  hostHome: string
  hostBaselineFile: string
  projectBaseline?: boolean
  baselineMode?: 'symlink' | 'append'
  customSkillsDirName?: string
  excludedSkills?: string[]
  agentFormat?: AgentFormat
  projectSharedResources?: boolean
  mcpHome?: string
  mcp?: McpProjection
  hooksHome?: string
  hooks?: HookProjection[]
  includeNativeTomlAgentsAsMarkdown?: boolean
}) {
  if (projectSharedResources) {
    projectSharedSkillsHost(userHome, hostHome, moluoHome, customSkillsDirName, excludedSkills, agentFormat, includeNativeTomlAgentsAsMarkdown)
  }
  if (mcp) {
    projectMcpToHost(moluoHome, mcpHome, mcp)
  }
  // 一个宿主可声明多条 hook 投影（多事件）；受管条目按 scriptName + event 各自幂等。
  for (const hook of hooks ?? []) {
    projectHooksToHost(moluoHome, hooksHome, hook)
  }
  const baselineSource = vendorBaselinePath(moluoHome)
  if (!projectBaseline || !existsSync(baselineSource)) {
    return
  }
  if (baselineMode === 'append') {
    injectBaselineBlock(baselineSource, hostBaselineFile)
    return
  }
  replaceWithSymlink(
    baselineSource,
    hostBaselineFile,
    linkFileForCurrentPlatform(),
  )
}

export function linkHostBaseline({ moluoHome, host, userHome = os.homedir() }: { moluoHome: string, host: string, userHome?: string }): string | undefined {
  const source = vendorBaselinePath(moluoHome)
  const config = findHostConfig(host)
  if (!config) {
    throw new Error(`Unknown host: ${host}`)
  }

  const { hostBaselineFile, projectBaseline, baselineMode } = resolveHostPaths(config, userHome)
  if (!projectBaseline || !existsSync(source)) {
    return undefined
  }
  if (baselineMode === 'append') {
    injectBaselineBlock(source, hostBaselineFile)
    return hostBaselineFile
  }
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
): { success: boolean, hostBaselineFile: string, baselineProjected: boolean } {
  const config = findHostConfig(host)
  if (!config) {
    throw new Error(`Unknown host: ${host}`)
  }

  const { hostHome, hostBaselineFile, projectBaseline, projectSharedResources, baselineMode, skillsDirName, excludedSkills, agentFormat, includeNativeTomlAgentsAsMarkdown, mcpHome, mcp, hooksHome, hooks } = resolveHostPaths(config, userHome)

  const hostHomePath = path.resolve(hostHome)
  const mcpHomePath = path.resolve(mcpHome)
  const hasHostHome = existsSync(hostHomePath)
  const hasMcpHome = Boolean(mcp && existsSync(mcpHomePath))
  const shouldProjectHostHome = hasHostHome || (hasMcpHome && Boolean(config.mcpHomeImpliesHostHome) && (projectBaseline || projectSharedResources || hooks.length > 0))

  if (!hasHostHome && !hasMcpHome) {
    console.warn(`[skip] 宿主目录不存在，跳过投影: ${host} (${hostHomePath})`)
    return { success: false, hostBaselineFile, baselineProjected: false }
  }

  projectToHost({
    userHome,
    moluoHome,
    hostHome,
    hostBaselineFile,
    projectBaseline: projectBaseline && shouldProjectHostHome,
    baselineMode,
    customSkillsDirName: skillsDirName,
    excludedSkills,
    agentFormat,
    includeNativeTomlAgentsAsMarkdown,
    projectSharedResources: projectSharedResources && shouldProjectHostHome,
    mcpHome,
    mcp,
    hooksHome,
    // mcpHome 可作为宿主存在证据；完整宿主不能静默退化为 MCP-only。
    hooks: shouldProjectHostHome ? hooks : undefined,
  })

  return { success: true, hostBaselineFile, baselineProjected: projectBaseline && shouldProjectHostHome && existsSync(vendorBaselinePath(moluoHome)) }
}
