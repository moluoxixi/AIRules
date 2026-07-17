import type { McpProjection } from '../../constants/hosts.js'
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
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js'
import { buildLinkPlan } from './links.js'
import { requireRoleName } from './role-assets.js'
import { DEFAULT_ROLE, roleOverlayOrder } from './roles.js'
import { collectFlattenedSkillSources, discoverSkillDirectories, flattenedSkillName } from './skill-projection.js'
import { loadVendorManifest } from './vendors.js'

/** 获取 vendor 技能目录的绝对路径 */
function vendorSkillsPath(homeDir: string): string {
  return path.join(homeDir, 'vendor', 'skills')
}

/** 获取全局 .agents/skills 目录的绝对路径 */
function agentsSkillsPath(userHome: string): string {
  const config = findHostConfig('agentsmd')
  if (!config)
    throw new Error('Missing public agentsmd host configuration')
  const { hostHome, skillsDirName } = resolveHostPaths(config, userHome)
  return path.join(hostHome, skillsDirName)
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
  globalAgentSkillsHome: string
  [key: string]: string
}

export function getDefaultInstallPaths(userHome = os.homedir()): InstallPaths {
  const moluoHome = path.join(userHome, '.moluoxixi')
  return {
    userHome,
    moluoHome,
    repoRoot: moluoHome,
    globalAgentSkillsHome: agentsSkillsPath(userHome),
  }
}

export function ensureInstallRoot(paths: InstallPaths) {
  for (const dir of [
    paths.moluoHome,
    path.join(paths.moluoHome, 'vendor'),
    path.join(paths.moluoHome, 'vendor', 'repos'),
    vendorSkillsPath(paths.moluoHome),
    paths.globalAgentSkillsHome,
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
 * 将第一方 skills 源目录投影到 vendor/skills，作为第三方 vendor 后的本地覆盖层。
 * 该函数只清理曾经指向同一 source skills 根目录的过时链接，不会删除第三方 vendor 技能。
 */
export async function syncFirstPartySkillsToVendor(sourceRoot: string, moluoHome: string, role = DEFAULT_ROLE) {
  const legacySkillsDir = path.join(sourceRoot, 'skills')
  const rolesRoot = path.join(sourceRoot, 'roles')
  const sourceSkillRoots = existsSync(rolesRoot)
    ? (await roleOverlayOrder(sourceRoot, role))
        .map(roleName => path.join(sourceRoot, 'roles', roleName, 'skills'))
        .filter(existsSync)
    : []

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
  mkdirSync(path.dirname(agentsSkillsDir), { recursive: true })
  syncFlattenedSkills(vendorSourceSkillsDir, agentsSkillsDir, moluoHome)

  // 2. ~/.agents/skills → 宿主 skills 目录
  syncFlattenedSkills(agentsSkillsDir, hostSkillsHome, moluoHome, options)
}

function escapeTomlString(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/"/gu, '\\"')
    .replace(/\n/gu, '\\n')
    .replace(/\r/gu, '\\r')
    .replace(/\t/gu, '\\t')
    // eslint-disable-next-line no-control-regex -- TOML basic strings cannot contain raw C0 controls.
    .replace(/[\u0000-\u0008\v\f\u000E-\u001F]/gu, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

function tomlKey(key: string): string {
  return /^[\w-]+$/u.test(key) ? key : `"${escapeTomlString(key)}"`
}

function readRoleMcpServers(moluoHome: string, role: string): Record<string, unknown> | undefined {
  if (!role)
    return undefined
  const sourceFile = path.join(moluoHome, 'roles', requireRoleName(role), 'mcp', 'mcp.json')
  if (!existsSync(sourceFile))
    return undefined
  const stats = lstatSync(sourceFile)
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new Error(`Role MCP source must be a plain file: ${sourceFile}`)
  const raw = readFileSync(sourceFile, 'utf8').trim()
  if (!raw)
    return undefined
  let parsed: { mcpServers?: Record<string, unknown> }
  try {
    parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> }
  }
  catch (error) {
    throw new Error(`Role MCP source is invalid JSON: ${sourceFile}`, { cause: error })
  }
  return parsed.mcpServers && Object.keys(parsed.mcpServers).length > 0 ? parsed.mcpServers : undefined
}

function readHostConfigForMerge(targetFile: string): string {
  if (existsSync(targetFile) && lstatSync(targetFile).isSymbolicLink()) {
    removePath(targetFile)
    return ''
  }
  return existsSync(targetFile) ? readFileSync(targetFile, 'utf8').replace(/^\uFEFF/u, '') : ''
}

function applyMcpServerOverrides(servers: Record<string, unknown>, overrides: McpProjection['serverOverrides']): Record<string, unknown> {
  if (!overrides)
    return servers
  return Object.fromEntries(Object.entries(servers).map(([name, value]) => {
    const override = overrides[name]
    if (!override)
      return [name, value]
    const base = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
    return [name, { ...base, ...override }]
  }))
}

function projectMcpToHost(moluoHome: string, role: string, mcpHome: string, mcp: McpProjection): void {
  const servers = readRoleMcpServers(moluoHome, role)
  if (!servers)
    return
  const projectedServers = applyMcpServerOverrides(servers, mcp.serverOverrides)
  const targetDir = mcp.relDir === '.' ? mcpHome : path.join(mcpHome, mcp.relDir)
  const targetFile = path.join(targetDir, mcp.fileName)
  mkdirSync(targetDir, { recursive: true })

  if (mcp.format === 'json') {
    const previous = readHostConfigForMerge(targetFile)
    let existing: Record<string, unknown> = {}
    if (previous.trim()) {
      try {
        existing = JSON.parse(previous) as Record<string, unknown>
      }
      catch (error) {
        throw new Error(`Host MCP configuration is invalid JSON: ${targetFile}`, { cause: error })
      }
    }
    existing = { ...(mcp.defaultTopLevel ?? {}), ...existing }
    const existingServers = typeof existing[mcp.serversKey] === 'object' && existing[mcp.serversKey] !== null && !Array.isArray(existing[mcp.serversKey])
      ? existing[mcp.serversKey] as Record<string, unknown>
      : {}
    existing[mcp.serversKey] = { ...projectedServers, ...existingServers }
    writeFileSync(targetFile, `${JSON.stringify(existing, null, 2)}\n`, 'utf8')
    return
  }

  const previous = readHostConfigForMerge(targetFile)
  const cleaned = previous.replace(/\n*# >>> AIRULES MCP >>>[\s\S]*?(?:# <<< AIRULES MCP <<<|$)\n*/gu, '\n').trimEnd()
  const serversKeyPattern = mcp.serversKey.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const userDeclared = new Set<string>()
  const tablePattern = new RegExp(`^\\s*\\[${serversKeyPattern}\\.(?:"([^"]+)"|([\\w-]+))\\]`, 'gmu')
  for (const match of cleaned.matchAll(tablePattern))
    userDeclared.add(match[1] ?? match[2])

  const lines: string[] = []
  for (const [name, value] of Object.entries(projectedServers)) {
    if (userDeclared.has(name))
      continue
    const server = value as { command?: string, args?: string[], env?: Record<string, string> }
    lines.push(`[${mcp.serversKey}.${tomlKey(name)}]`)
    if (server.command)
      lines.push(`command = "${escapeTomlString(server.command)}"`)
    if (Array.isArray(server.args))
      lines.push(`args = [${server.args.map(argument => `"${escapeTomlString(String(argument))}"`).join(', ')}]`)
    if (server.env && Object.keys(server.env).length > 0) {
      const environment = Object.entries(server.env)
        .map(([key, value]) => `${tomlKey(key)} = "${escapeTomlString(String(value))}"`)
        .join(', ')
      lines.push(`env = { ${environment} }`)
    }
    lines.push('')
  }
  if (lines.length === 0) {
    if (cleaned !== previous.trimEnd())
      writeFileSync(targetFile, cleaned ? `${cleaned}\n` : '', 'utf8')
    return
  }
  const block = `# >>> AIRULES MCP >>>\n${lines.join('\n')}# <<< AIRULES MCP <<<\n`
  writeFileSync(targetFile, cleaned ? `${cleaned}\n\n${block}` : block, 'utf8')
}

export function projectToHost({
  userHome,
  moluoHome,
  hostHome,
  customSkillsDirName = 'skills',
  excludedSkills = [],
  projectSkills = true,
  role = DEFAULT_ROLE,
  mcpHome = hostHome,
  mcp,
}: {
  userHome: string
  moluoHome: string
  hostHome: string
  customSkillsDirName?: string
  excludedSkills?: string[]
  projectSkills?: boolean
  role?: string
  mcpHome?: string
  mcp?: McpProjection
}) {
  if (projectSkills) {
    projectSkillsToHost(
      userHome,
      moluoHome,
      path.join(hostHome, customSkillsDirName),
      { excludedSkills },
    )
  }
  if (mcp)
    projectMcpToHost(moluoHome, role, mcpHome, mcp)
}

/**
 * 将 skills 投影到指定宿主，并返回是否成功（宿主目录不存在则跳过）。
 */
export function projectHostById(
  host: string,
  userHome: string,
  moluoHome: string,
  role = DEFAULT_ROLE,
): { success: boolean } {
  const config = findHostConfig(host)
  if (!config) {
    throw new Error(`Unknown host: ${host}`)
  }

  const { hostHome, projectSkills, skillsDirName, excludedSkills, mcpHome, mcp } = resolveHostPaths(config, userHome)
  const hostHomePath = path.resolve(hostHome)
  const hasHostHome = existsSync(hostHomePath)
  const hasMcpHome = Boolean(role && mcp && existsSync(path.resolve(mcpHome)))

  if (!hasHostHome && !hasMcpHome) {
    console.warn(`[skip] 宿主目录不存在，跳过投影: ${host} (${hostHomePath})`)
    return { success: false }
  }

  projectToHost({
    userHome,
    moluoHome,
    hostHome,
    customSkillsDirName: skillsDirName,
    excludedSkills,
    projectSkills,
    role,
    mcpHome,
    mcp: hasMcpHome ? mcp : undefined,
  })

  return { success: true }
}
