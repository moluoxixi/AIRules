import type { AgentFormat, McpProjection } from '../../constants/hosts.js'
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
  readFileSync,
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
  // 中性 MCP 源（rulesync 风格 { mcpServers: {} }）同步到 home，供各宿主按格式投影。
  syncOptionalDir(path.join(repoRoot, 'mcp'), path.join(moluoHome, 'mcp'))
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
export function projectSkillsToHost(
  userHome: string,
  moluoHome: string,
  hostSkillsHome: string,
  options: SyncFlattenedSkillsOptions = {},
) {
  const vendorSourceSkillsDir = vendorSkillsPath(moluoHome)
  const moluoTargetSkillsDir = moluoSkillsPath(moluoHome)
  const agentsSkillsDir = agentsSkillsPath(userHome)

  // 1. vendor/skills → ~/.moluoxixi/skills
  syncFlattenedSkills(vendorSourceSkillsDir, moluoTargetSkillsDir, moluoHome)

  // 2. ~/.moluoxixi/skills → ~/.agents/skills
  mkdirSync(path.join(userHome, '.agents'), { recursive: true })
  syncFlattenedSkills(moluoTargetSkillsDir, agentsSkillsDir, moluoHome)

  // 3. ~/.agents/skills → 宿主 skills 目录
  syncFlattenedSkills(agentsSkillsDir, hostSkillsHome, moluoHome, options)
}

function projectSharedSkillsHost(
  userHome: string,
  hostHome: string,
  moluoHome: string,
  customSkillsDirName: string = 'skills',
  excludedSkills: string[] = [],
  agentFormat: AgentFormat = 'markdown',
) {
  mkdirSync(hostHome, { recursive: true })
  removePath(path.join(hostHome, 'rules'))
  removePath(path.join(hostHome, 'agents'))

  projectSkillsToHost(userHome, moluoHome, path.join(hostHome, customSkillsDirName), { excludedSkills })

  // 第一方 agent 当前均为 Markdown。仅 Markdown 兼容宿主直接软链；
  // TOML（Codex）/ JSON（Kiro）宿主格式不兼容，转译层未实现前显式跳过 + 告警，不静默软链错误格式。
  if (existsSync(path.join(moluoHome, 'agents'))) {
    if (agentFormat === 'markdown') {
      const agentsSource = path.join(moluoHome, 'agents')
      const agentsTarget = path.join(hostHome, 'agents')
      replaceWithSymlink(agentsSource, agentsTarget, linkTypeForCurrentPlatform())
    }
    else {
      console.warn(`[skip] 宿主 agent 格式为 ${agentFormat}，与第一方 Markdown agent 不兼容，转译层未实现，跳过 agents 投影: ${hostHome}`)
    }
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
 * 读取中性 MCP 源（~/.moluoxixi/mcp/mcp.json，rulesync 风格 { mcpServers: {...} }）。
 * 源不存在或无服务时返回 undefined，调用方据此做 no-op（无服务可分发，非失败）。
 */
function readNeutralMcpServers(moluoHome: string): Record<string, unknown> | undefined {
  const sourceFile = path.join(moluoHome, 'mcp', 'mcp.json')
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
  return existsSync(targetFile) ? readFileSync(targetFile, 'utf8') : ''
}

/**
 * 把中性 MCP 源按宿主规格写到宿主对应的 MCP 配置文件。
 * - JSON 宿主：用 mcp.serversKey 作为服务表键名（多数为 mcpServers，OpenCode 为 mcp）；
 *   保留文件已有其它顶层字段，且对 serversKey 做浅合并，不清掉用户手写的其它 server。
 * - TOML 宿主（Codex）：以 AIRULES 托管块写 [mcp_servers.<name>] 表，幂等替换，保留块外内容。
 * 源缺失时 no-op（不写文件、不报错）。映射依据见 docs/architecture/host-agent-mcp-mapping.md。
 */
function projectMcpToHost(moluoHome: string, hostHome: string, mcp: McpProjection) {
  const servers = readNeutralMcpServers(moluoHome)
  if (!servers) {
    return
  }

  const targetDir = mcp.relDir === '.' ? hostHome : path.join(hostHome, mcp.relDir)
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
    // 浅合并，用户优先：只补用户尚未配置的 server，绝不覆盖用户手写的同名 server（含其调过的参数）。
    const existingServers = (typeof existing[mcp.serversKey] === 'object' && existing[mcp.serversKey] !== null)
      ? existing[mcp.serversKey] as Record<string, unknown>
      : {}
    existing[mcp.serversKey] = { ...servers, ...existingServers }
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
  for (const [name, value] of Object.entries(servers)) {
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
  mcp,
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
  mcp?: McpProjection
}) {
  projectSharedSkillsHost(userHome, hostHome, moluoHome, customSkillsDirName, excludedSkills, agentFormat)
  if (mcp) {
    projectMcpToHost(moluoHome, hostHome, mcp)
  }
  if (!projectBaseline) {
    return
  }
  if (baselineMode === 'append') {
    injectBaselineBlock(vendorBaselinePath(moluoHome), hostBaselineFile)
    return
  }
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

  const { hostBaselineFile, projectBaseline, baselineMode } = resolveHostPaths(config, userHome)
  if (!projectBaseline) {
    throw new Error(`Host ${host} does not support AIRules baseline projection: ${hostBaselineFile}`)
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
): { success: boolean, hostBaselineFile: string } {
  const config = findHostConfig(host)
  if (!config) {
    throw new Error(`Unknown host: ${host}`)
  }

  const { hostHome, hostBaselineFile, projectBaseline, baselineMode, skillsDirName, excludedSkills, agentFormat, mcp } = resolveHostPaths(config, userHome)

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
    projectBaseline,
    baselineMode,
    customSkillsDirName: skillsDirName,
    excludedSkills,
    agentFormat,
    mcp,
  })

  return { success: true, hostBaselineFile }
}
