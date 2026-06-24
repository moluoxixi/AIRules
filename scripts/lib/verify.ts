import type { McpProjection } from '../../constants/hosts.js'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import kleur from 'kleur'
import * as smolToml from 'smol-toml'
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js'

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
 * 验证指定宿主的技能链接完整性
 * @param host 宿主名称
 * @param moluoHome AIRules 的本地安装目录
 * @returns 是否验证通过
 */
export async function verifyHost(host: string, moluoHome: string, userHome = os.homedir()): Promise<boolean> {
  console.log(`\n--- 正在验证宿主: ${host} ---`)

  const config = findHostConfig(host)
  if (!config)
    return false

  const { hostHome, skillsDirName, excludedSkills, projectSharedResources, mcpHome, mcp } = resolveHostPaths(config, userHome)

  const resolvedHostHome = path.resolve(hostHome)
  const resolvedMcpHome = path.resolve(mcpHome)
  const hasHostHome = existsSync(resolvedHostHome)
  const hasMcpHome = Boolean(mcp && existsSync(resolvedMcpHome))

  if (!hasHostHome && !hasMcpHome) {
    console.warn(`[SKIP] 宿主目录不存在: ${resolvedHostHome}`)
    return true // 跳过但不视为失败
  }

  const mcpSuccess = verifyMcpProjection(host, moluoHome, resolvedMcpHome, mcp)
  const shouldVerifySharedResources = projectSharedResources && hasHostHome

  if (!shouldVerifySharedResources) {
    console.log('[info] 宿主未启用 skills/agents 投影，跳过 skills/agents 链接校验')
    return mcpSuccess
  }

  const targetSkillsDir = path.join(resolvedHostHome, skillsDirName)

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

  const success = missingCount === 0 && brokenCount === 0 && mcpSuccess
  if (success) {
    console.log(kleur.green(`✅ ${host} 验证通过`))
  }
  else {
    console.log(kleur.red(`❌ ${host} 验证失败`))
  }

  return success
}
