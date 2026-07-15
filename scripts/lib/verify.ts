import type { AgentFormat, HookHostAdapter, HookProjection, McpProjection } from '../../constants/hosts.js'
import type { AgentCardProjectionRenderer } from './role-runtime.js'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import kleur from 'kleur'
import * as smolToml from 'smol-toml'
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js'
import { managedHookCommand, resolveHookDispatches } from './hook-dispatch.js'
import { renderCodexMarkdownAgentFile, renderNativeTomlAgentAsMarkdownFile } from './install.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNeutralMcpServers(moluoHome: string): Record<string, unknown> | undefined {
  const sourceFile = path.join(moluoHome, 'vendor', 'mcp', 'mcp.json')
  if (!existsSync(sourceFile)) {
    return undefined
  }

  const raw = readFileSync(sourceFile, 'utf8').trim()
  if (!raw) {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch (error) {
    throw new Error(`中性 MCP 源解析失败 ${sourceFile}: ${String(error)}`)
  }

  if (!isRecord(parsed) || !isRecord(parsed.mcpServers) || Object.keys(parsed.mcpServers).length === 0) {
    return undefined
  }

  return parsed.mcpServers
}

function readHostMcpServers(targetFile: string, mcp: McpProjection): Record<string, unknown> | undefined {
  const raw = readFileSync(targetFile, 'utf8').replace(/^\uFEFF/u, '')
  const parsed = mcp.format === 'json'
    ? JSON.parse(raw) as unknown
    : smolToml.parse(raw) as unknown

  if (!isRecord(parsed)) {
    return undefined
  }

  const servers = parsed[mcp.serversKey]
  if (!isRecord(servers)) {
    return undefined
  }

  return servers
}

function verifyMcpProjection(host: string, moluoHome: string, mcpHome: string, mcp?: McpProjection): boolean {
  if (!mcp) {
    return true
  }

  const expectedServers = readNeutralMcpServers(moluoHome)
  if (!expectedServers) {
    console.log('[info] 未发现中性 MCP 源，跳过 MCP 配置校验')
    return true
  }

  if (!existsSync(mcpHome)) {
    console.error(`[FAIL] MCP 目录不存在: ${mcpHome}`)
    return false
  }

  const targetFile = path.join(mcpHome, mcp.relDir, mcp.fileName)
  if (!existsSync(targetFile)) {
    console.error(`[FAIL] MCP 配置缺失: ${targetFile}`)
    return false
  }

  let actualServers: Record<string, unknown> | undefined
  try {
    actualServers = readHostMcpServers(targetFile, mcp)
  }
  catch (error) {
    console.error(`[FAIL] MCP 配置解析失败 ${targetFile}: ${String(error)}`)
    return false
  }

  if (!actualServers) {
    console.error(`[FAIL] MCP 配置缺少服务表 ${mcp.serversKey}: ${targetFile}`)
    return false
  }

  const missingServers = Object.keys(expectedServers).filter(serverName => !Object.hasOwn(actualServers, serverName))
  if (missingServers.length > 0) {
    console.error(`[FAIL] MCP 配置缺少 AIRules server: ${missingServers.join(', ')}`)
    return false
  }

  console.log(`[info] MCP 配置校验通过: ${host}`)
  return true
}

/**
 * 验证宿主 hook 投影：角色清单声明的每个 hook 都必须具有精确的受管配置条目，
 * 且宿主脚本须与角色源一致。未声明 hook 的宿主跳过（不算失败）。
 * 宿主可声明多条投影（多事件）：逐条校验，全部通过才算 PASS。
 */
function verifyHookProjection(
  host: string,
  hooksHome: string,
  vendorHooksRoot: string,
  adapter: HookHostAdapter | undefined,
  hooks: HookProjection[],
): boolean {
  if (!adapter) {
    return true
  }
  return hooks.every(hook => verifyOneHook(host, hooksHome, vendorHooksRoot, hook))
    && verifyExactManagedHookSet(host, hooksHome, adapter, hooks)
}

/** 校验单条 hook 投影：脚本就位 + 配置含指向该脚本的受管条目。 */
function verifyOneHook(host: string, hooksHome: string, vendorHooksRoot: string, hooks: HookProjection): boolean {
  const hostScript = path.join(hooksHome, 'hooks', hooks.scriptName)
  const hostScriptStats = lstatSync(hostScript, { throwIfNoEntry: false })
  if (!hostScriptStats?.isFile() || hostScriptStats.isSymbolicLink()) {
    console.error(`[FAIL] hook 脚本缺失或不是普通文件: ${hostScript} (${host})`)
    return false
  }
  const vendorScript = path.join(vendorHooksRoot, hooks.scriptName)
  if (!existsSync(vendorScript) || fileHash(vendorScript) !== fileHash(hostScript)) {
    console.error(`[FAIL] hook 脚本内容与角色源不一致: ${hostScript}`)
    return false
  }
  for (const supportFile of hooks.supportFiles ?? []) {
    const vendorSupport = path.join(vendorHooksRoot, supportFile)
    const hostSupport = path.join(hooksHome, 'hooks', supportFile)
    const hostSupportStats = lstatSync(hostSupport, { throwIfNoEntry: false })
    if (!hostSupportStats?.isFile() || hostSupportStats.isSymbolicLink()
      || !existsSync(vendorSupport) || fileHash(vendorSupport) !== fileHash(hostSupport)) {
      console.error(`[FAIL] hook 辅助模块缺失或与角色源不一致: ${hostSupport}`)
      return false
    }
  }

  const targetFile = path.join(hooksHome, hooks.relDir, hooks.fileName)
  if (!existsSync(targetFile)) {
    console.error(`[FAIL] hook 配置缺失: ${targetFile}`)
    return false
  }

  const raw = readFileSync(targetFile, 'utf8').replace(/^\uFEFF/u, '')
  const expectedCommands = [managedHookCommand(hostScript)]

  // TOML（Codex）：断言受管块存在且块内引用脚本名。
  if (hooks.format === 'toml') {
    const marker = `AIRULES HOOK ${hooks.event} ${hooks.scriptName}`
    const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const block = raw.match(new RegExp(`# >>> ${escapedMarker} >>>\\r?\\n([\\s\\S]*?)# <<< ${escapedMarker} <<<`, 'u'))
    let parsedBlock: unknown
    try {
      parsedBlock = block ? smolToml.parse(block[1]) : undefined
    }
    catch {
      parsedBlock = undefined
    }
    if (!block || !containsTomlHookCommand(parsedBlock, hooks.event, expectedCommands)) {
      console.error(`[FAIL] hook 配置未含指向 ${hooks.scriptName} 的 ${hooks.event} 受管块: ${targetFile}`)
      return false
    }
    console.log(`[info] hook 配置校验通过: ${host}`)
    return true
  }

  // JSON：解析后按结构断言——受管条目须挂在正确的 event 键下且 command 引用脚本名，
  // 而非全文子串（防止脚本名恰好出现在别处、或条目挂错 event/嵌套形态）。
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch (error) {
    console.error(`[FAIL] hook 配置解析失败 ${targetFile}: ${String(error)}`)
    return false
  }

  const matchesCommand = (entry: unknown): boolean => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return false
    }
    const command = entry as { command?: unknown, type?: unknown }
    return expectedCommands.includes(String(command.command))
      && (!hooks.includeType || command.type === 'command')
  }

  if (!isRecord(parsed)) {
    console.error(`[FAIL] hook 配置根节点必须是对象: ${targetFile}`)
    return false
  }
  const root = parsed
  const rootHooks = isRecord(root.hooks) ? root.hooks : undefined
  const eventEntries = rootHooks && Array.isArray(rootHooks[hooks.event]) ? rootHooks[hooks.event] as unknown[] : []
  const hasExpectedEntry = hooks.nesting === 'flat'
    ? eventEntries.some(matchesCommand)
    : eventEntries.some((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          return false
        }
        const group = entry as { hooks?: unknown }
        return Array.isArray(group.hooks) && group.hooks.some(matchesCommand)
      })
  if (!hasExpectedEntry) {
    console.error(`[FAIL] hook 配置 ${hooks.event} 下未含指向 ${hooks.scriptName} 的受管条目: ${targetFile}`)
    return false
  }
  if (typeof hooks.version === 'number' && root.version !== hooks.version) {
    console.error(`[FAIL] hook 配置缺顶层 version=${hooks.version}: ${targetFile}`)
    return false
  }

  console.log(`[info] hook 配置校验通过: ${host}`)
  return true
}

interface ManagedHookScan {
  dispatches: string[]
  invalid: boolean
}

function verifyExactManagedHookSet(
  host: string,
  hooksHome: string,
  adapter: HookHostAdapter,
  hooks: HookProjection[],
): boolean {
  const targetDir = adapter.relDir === '.' ? hooksHome : path.join(hooksHome, adapter.relDir)
  const targetFile = path.join(targetDir, adapter.fileName)
  if (!existsSync(targetFile)) {
    if (hooks.length === 0) {
      return true
    }
    console.error(`[FAIL] hook 配置缺失: ${targetFile}`)
    return false
  }

  const raw = readFileSync(targetFile, 'utf8').replace(/^\uFEFF/u, '')
  const hostHooksDir = path.join(hooksHome, 'hooks')
  const scan = adapter.format === 'json'
    ? scanManagedJsonHooks(raw, adapter, hostHooksDir)
    : scanManagedTomlHooks(raw, hostHooksDir)
  const expected = hooks.map(hook => managedDispatchKey(hook.event, hook.scriptName)).sort()
  const actual = [...scan.dispatches].sort()

  if (scan.invalid || expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
    console.error(`[FAIL] hook 受管集合与角色清单不一致: ${targetFile} (${host})`)
    return false
  }
  return true
}

function scanManagedJsonHooks(raw: string, adapter: HookHostAdapter, hostHooksDir: string): ManagedHookScan {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return { dispatches: [], invalid: true }
  }
  if (!isRecord(parsed)) {
    return { dispatches: [], invalid: true }
  }

  const allManaged = collectManagedJsonCommands(parsed)
  const accepted = new Set<Record<string, unknown>>()
  const dispatches: string[] = []
  const hooksRoot = isRecord(parsed.hooks) ? parsed.hooks : undefined
  if (hooksRoot) {
    for (const [event, value] of Object.entries(hooksRoot)) {
      if (!Array.isArray(value)) {
        continue
      }
      for (const entry of value) {
        if ((adapter.nesting ?? 'group') === 'flat') {
          const managed = managedJsonCommand(entry, hostHooksDir)
          if (managed && isExactManagedJsonCommand(entry, managed, adapter.includeType ?? false, hostHooksDir)) {
            accepted.add(entry as Record<string, unknown>)
            dispatches.push(managedDispatchKey(event, managed.scriptName))
          }
          continue
        }

        if (!isRecord(entry) || !hasExactFields(entry, ['hooks']) || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) {
          continue
        }
        const command = entry.hooks[0]
        const managed = managedJsonCommand(command, hostHooksDir)
        if (managed && isExactManagedJsonCommand(command, managed, adapter.includeType ?? false, hostHooksDir)) {
          accepted.add(command as Record<string, unknown>)
          dispatches.push(managedDispatchKey(event, managed.scriptName))
        }
      }
    }
  }

  return {
    dispatches,
    invalid: allManaged.some(managed => !accepted.has(managed.entry)),
  }
}

function scanManagedTomlHooks(raw: string, hostHooksDir: string): ManagedHookScan {
  const openingPattern = /^# >>> AIRULES HOOK ([A-Za-z][\w-]{0,63}) ([^\W_][\w.-]*\.mjs) >>>\r?$/gmu
  const closingPattern = /^# <<< AIRULES HOOK ([A-Za-z][\w-]{0,63}) ([^\W_][\w.-]*\.mjs) <<<\r?$/gmu
  const blockPattern = /^# >>> AIRULES HOOK ([A-Za-z][\w-]{0,63}) ([^\W_][\w.-]*\.mjs) >>>\r?\n([\s\S]*?)^# <<< AIRULES HOOK \1 \2 <<<\r?$/gmu
  const openings = [...raw.matchAll(openingPattern)]
  const closings = [...raw.matchAll(closingPattern)]
  const blocks = [...raw.matchAll(blockPattern)]
  const dispatches: string[] = []
  let invalid = openings.length !== closings.length || openings.length !== blocks.length

  for (const block of blocks) {
    const event = block[1]
    const scriptName = block[2]
    const command = managedHookCommand(path.join(hostHooksDir, scriptName))
    let parsed: unknown
    try {
      parsed = smolToml.parse(block[3])
    }
    catch {
      parsed = undefined
    }
    if (!isExactTomlHookBlock(parsed, event, command)) {
      invalid = true
      continue
    }
    dispatches.push(managedDispatchKey(event, scriptName))
  }

  return { dispatches, invalid }
}

function collectManagedJsonCommands(
  value: unknown,
  output: Array<{ entry: Record<string, unknown> }> = [],
): Array<{ entry: Record<string, unknown> }> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectManagedJsonCommands(item, output)
    }
    return output
  }
  if (!isRecord(value)) {
    return output
  }

  if (hasManagedHookArgument(value)) {
    output.push({ entry: value })
  }
  for (const child of Object.values(value)) {
    collectManagedJsonCommands(child, output)
  }
  return output
}

function hasManagedHookArgument(value: Record<string, unknown>): boolean {
  return typeof value.command === 'string'
    && /(?:^|\s)--airules-managed-hook(?:\s|$)/u.test(value.command)
}

function managedJsonCommand(
  value: unknown,
  hostHooksDir: string,
): { scriptName: string, command: string } | undefined {
  if (!isRecord(value) || typeof value.command !== 'string') {
    return undefined
  }
  const match = /^node "([^"]+\.mjs)" --airules-managed-hook$/u.exec(value.command)
  if (!match) {
    return undefined
  }
  const scriptTarget = path.resolve(match[1])
  if (path.dirname(scriptTarget) !== path.resolve(hostHooksDir)) {
    return undefined
  }
  return { scriptName: path.basename(scriptTarget), command: value.command }
}

function isExactManagedJsonCommand(
  value: unknown,
  managed: { scriptName: string, command: string },
  includeType: boolean,
  hostHooksDir: string,
): boolean {
  if (!isRecord(value)) {
    return false
  }
  const fields = includeType ? ['command', 'type'] : ['command']
  return hasExactFields(value, fields)
    && managed.command === managedHookCommand(path.join(hostHooksDir, managed.scriptName))
    && (!includeType || value.type === 'command')
}

function isExactTomlHookBlock(value: unknown, event: string, command: string): boolean {
  if (!isRecord(value) || !hasExactFields(value, ['hooks']) || !isRecord(value.hooks)) {
    return false
  }
  if (!hasExactFields(value.hooks, [event])) {
    return false
  }
  const groups = value.hooks[event]
  if (!Array.isArray(groups) || groups.length !== 1 || !isRecord(groups[0]) || !hasExactFields(groups[0], ['hooks'])) {
    return false
  }
  const commands = groups[0].hooks
  if (!Array.isArray(commands) || commands.length !== 1 || !isRecord(commands[0])) {
    return false
  }
  return hasExactFields(commands[0], ['command', 'type'])
    && commands[0].type === 'command'
    && commands[0].command === command
}

function hasExactFields(value: Record<string, unknown>, fields: string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...fields].sort()
  return actual.length === expected.length && actual.every((field, index) => field === expected[index])
}

function managedDispatchKey(event: string, scriptName: string): string {
  return `${event}\u0000${scriptName}`
}

function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function containsTomlHookCommand(value: unknown, event: string, expectedCommands: string[]): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const hooks = (value as Record<string, unknown>).hooks
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
    return false
  }
  const eventHooks = (hooks as Record<string, unknown>)[event]
  if (!Array.isArray(eventHooks)) {
    return false
  }
  return eventHooks.some((group) => {
    if (typeof group !== 'object' || group === null || Array.isArray(group)) {
      return false
    }
    const commands = (group as Record<string, unknown>).hooks
    return Array.isArray(commands) && commands.some((command) => {
      return typeof command === 'object'
        && command !== null
        && !Array.isArray(command)
        && (command as Record<string, unknown>).type === 'command'
        && expectedCommands.includes(String((command as Record<string, unknown>).command))
    })
  })
}

function verifyAgentProjection(
  userHome: string,
  hostHome: string,
  moluoHome: string,
  agentFormat: AgentFormat,
  includeNativeTomlAgentsAsMarkdown: boolean,
  agentCardRenderer?: AgentCardProjectionRenderer,
): boolean {
  const vendorAgents = path.join(moluoHome, 'vendor', 'agents')
  const targetAgents = agentFormat === 'agentsmd'
    ? path.join(userHome, '.agents', 'subagents')
    : path.join(hostHome, 'agents')
  const sourceEntries = existsSync(vendorAgents)
    ? readdirSync(vendorAgents, { withFileTypes: true }).filter(entry => entry.isFile())
    : []
  const expected = new Map<string, { content?: string, source?: string }>()
  const add = (fileName: string, value: { content?: string, source?: string }) => {
    const key = fileName.toLowerCase()
    if (expected.has(key)) {
      console.error(`[FAIL] agent 投影存在名称冲突: ${fileName}`)
      return false
    }
    expected.set(key, value)
    return true
  }

  if (agentFormat !== 'json') {
    for (const entry of sourceEntries) {
      const source = path.join(vendorAgents, entry.name)
      if (entry.name.endsWith('.agent.yaml')) {
        if (agentCardRenderer === undefined) {
          throw new Error('Canonical .agent.yaml files require a selected AIRules role runtime renderer')
        }
        const rendered = agentCardRenderer(source, agentFormat === 'toml' ? 'toml' : 'markdown')
        if (!add(rendered.fileName, { content: rendered.content })) {
          return false
        }
      }
      else if (entry.name.endsWith('.md')) {
        const fileName = agentFormat === 'toml' ? entry.name.replace(/\.md$/u, '.toml') : entry.name
        const expectation = agentFormat === 'toml'
          ? { content: renderCodexMarkdownAgentFile(source) }
          : { source }
        if (!add(fileName, expectation)) {
          return false
        }
      }
      else if (entry.name.endsWith('.toml') && agentFormat === 'toml') {
        if (!add(entry.name, { source })) {
          return false
        }
      }
      else if (
        entry.name.endsWith('.toml')
        && includeNativeTomlAgentsAsMarkdown
        && (agentFormat === 'markdown' || agentFormat === 'agentsmd')
      ) {
        if (!add(entry.name.replace(/\.toml$/u, '.md'), {
          content: renderNativeTomlAgentAsMarkdownFile(source),
        })) {
          return false
        }
      }
    }
  }

  if (expected.size === 0) {
    if (existsSync(targetAgents) && readdirSync(targetAgents).length > 0) {
      console.error(`[FAIL] 宿主存在未预期 agent 文件: ${targetAgents}`)
      return false
    }
    return true
  }
  if (!existsSync(targetAgents) || !lstatSync(targetAgents).isDirectory()) {
    console.error(`[FAIL] agent 目录缺失: ${targetAgents}`)
    return false
  }
  const actualEntries = readdirSync(targetAgents, { withFileTypes: true })
  const actualNames = new Map(actualEntries.map(entry => [entry.name.toLowerCase(), entry]))
  let success = true
  for (const [key, expectation] of expected) {
    const entry = actualNames.get(key)
    const target = entry && path.join(targetAgents, entry.name)
    if (!entry || (!entry.isFile() && !entry.isSymbolicLink()) || !target || !existsSync(target)) {
      console.error(`[FAIL] agent 投影缺失或损坏: ${key}`)
      success = false
      continue
    }
    const expectedContent = expectation.content
      ?? (expectation.source === undefined ? undefined : readFileSync(expectation.source, 'utf8'))
    if (expectedContent !== undefined && readFileSync(target, 'utf8') !== expectedContent) {
      console.error(`[FAIL] agent 投影内容漂移: ${target}`)
      success = false
    }
  }
  for (const entry of actualEntries) {
    if (!expected.has(entry.name.toLowerCase())) {
      console.error(`[FAIL] agent 目录包含未受管文件: ${entry.name}`)
      success = false
    }
  }
  return success
}

/**
 * 验证指定宿主的技能链接完整性
 * @param host 宿主名称
 * @param moluoHome AIRules 的本地安装目录
 * @returns 是否验证通过
 */
export async function verifyHost(
  host: string,
  moluoHome: string,
  userHome = os.homedir(),
  agentCardRenderer?: AgentCardProjectionRenderer,
): Promise<boolean> {
  console.log(`\n--- 正在验证宿主: ${host} ---`)

  const config = findHostConfig(host)
  if (!config)
    return false

  const { hostHome, skillsDirName, excludedSkills, projectSharedResources, agentFormat, includeNativeTomlAgentsAsMarkdown, mcpHome, mcp, hooksHome, hookAdapter } = resolveHostPaths(config, userHome)
  const vendorHooksRoot = path.join(moluoHome, 'vendor', 'hooks')
  const resolvedHooks = resolveHookDispatches(vendorHooksRoot, host, hookAdapter)

  const resolvedHostHome = path.resolve(hostHome)
  const resolvedMcpHome = path.resolve(mcpHome)
  const hasHostHome = existsSync(resolvedHostHome)
  const hasMcpHome = Boolean(mcp && existsSync(resolvedMcpHome))
  const requiresHostHome = Boolean(config.mcpHomeImpliesHostHome) && (projectSharedResources || resolvedHooks.length > 0)

  if (!hasHostHome && !hasMcpHome) {
    console.warn(`[SKIP] 宿主目录不存在: ${resolvedHostHome}`)
    return true // 跳过但不视为失败
  }

  const mcpSuccess = verifyMcpProjection(host, moluoHome, resolvedMcpHome, mcp)
  if (!hasHostHome && requiresHostHome) {
    console.error(`[FAIL] 宿主共享资源目录缺失，不能只验证 MCP: ${resolvedHostHome}`)
    return false
  }

  // mcpHome-only 证据不等同于所有宿主都启用 host-home 校验；Trae 等宿主仍可只验 MCP。
  const hookSuccess = hasHostHome ? verifyHookProjection(host, path.resolve(hooksHome), vendorHooksRoot, hookAdapter, resolvedHooks) : true
  const shouldVerifySharedResources = projectSharedResources && hasHostHome

  if (!shouldVerifySharedResources) {
    console.log('[info] 宿主未启用 skills/agents 投影，跳过 skills/agents 链接校验')
    return mcpSuccess && hookSuccess
  }

  const targetSkillsDir = path.join(resolvedHostHome, skillsDirName)
  const agentSuccess = verifyAgentProjection(
    userHome,
    resolvedHostHome,
    moluoHome,
    agentFormat,
    includeNativeTomlAgentsAsMarkdown,
    agentCardRenderer,
  )

  if (!existsSync(targetSkillsDir)) {
    console.error(`[FAIL] 技能目录缺失: ${targetSkillsDir}`)
    return false
  }

  // 1. 获取预期技能列表 (从 vendor/skills)
  const expectedSkills = new Set<string>()

  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')
  if (existsSync(vendorSkillsDir)) {
    readdirSync(vendorSkillsDir).forEach((name) => {
      if (name !== '.gitignore')
        expectedSkills.add(name)
    })
  }
  for (const skillName of excludedSkills) {
    expectedSkills.delete(skillName)
  }

  console.log(`[info] 预期技能总数: ${expectedSkills.size}`)

  // 2. 检查实际存在的链接
  let missingCount = 0
  let brokenCount = 0
  let validCount = 0
  const targetSkillNames = new Set(readdirSync(targetSkillsDir))

  for (const skill of expectedSkills) {
    const skillPath = path.join(targetSkillsDir, skill)

    if (!targetSkillNames.has(skill)) {
      console.error(`[FAIL] 缺失技能链接 (Missing): ${skill}`)
      missingCount++
      continue
    }

    const stats = lstatSync(skillPath)
    if (stats.isSymbolicLink() && !existsSync(skillPath)) {
      console.error(`[FAIL] 损坏的软链接 (Broken Link): ${skill}`)
      brokenCount++
      continue
    }

    if (!stats.isSymbolicLink()) {
      console.warn(`[WARN] 技能不是软链接 (可能是物理拷贝): ${skill}`)
      validCount++
    }
    else {
      const real = realpathSync(skillPath)
      const normalizedReal = path.resolve(real)
      const normalizedMoluo = path.resolve(moluoHome)
      const normalizedRepo = path.resolve(process.cwd())

      // 验证指向是否在 moluoxixi 内部或仓库根目录
      if (normalizedReal.startsWith(normalizedMoluo) || normalizedReal.startsWith(normalizedRepo)) {
        validCount++
      }
      else {
        console.warn(`[WARN] 链接指向外部路径: ${skill} -> ${real}`)
        validCount++
      }
    }
  }

  console.log(`[result] 有效=${validCount}, 缺失=${missingCount}, 损坏=${brokenCount}`)

  const success = missingCount === 0 && brokenCount === 0 && agentSuccess && mcpSuccess && hookSuccess
  if (success) {
    console.log(kleur.green(`✅ ${host} 验证通过`))
  }
  else {
    console.log(kleur.red(`❌ ${host} 验证失败`))
  }

  return success
}
