import type { McpProjection } from '../../constants/hosts.js'
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import kleur from 'kleur'
import { findHostConfig, resolveGlobalAgentSkillsPath, resolveHostPaths } from '../../constants/hosts.js'
import { applyMcpServerProjection, readInstalledMcpServers, readTomlMcpServerNames } from './install.js'
import { DEFAULT_ROLE } from './roles.js'

/** Verify the mandatory canonical skills layer shared by every role and host. */
export async function verifyGlobalAgentSkills(
  moluoHome: string,
  userHome = os.homedir(),
): Promise<boolean> {
  console.log('\n--- 正在验证公共 Agent skills 层 ---')
  const targetSkillsDir = resolveGlobalAgentSkillsPath(userHome)
  if (!existsSync(targetSkillsDir)) {
    console.error(`[FAIL] 公共技能目录缺失: ${targetSkillsDir}`)
    return false
  }
  return verifyProjectedSkills('公共 Agent skills 层', moluoHome, targetSkillsDir, [])
}

/** Verify only the skills managed by AIRules. Host-native assets belong to project initializers. */
export async function verifyHost(
  host: string,
  moluoHome: string,
  userHome = os.homedir(),
  role = DEFAULT_ROLE,
): Promise<boolean> {
  console.log(`\n--- 正在验证宿主: ${host} ---`)

  const config = findHostConfig(host)
  if (!config)
    return false

  const { hostHome, skillsDirName, excludedSkills, projectSkills, mcpHome, mcp } = resolveHostPaths(config, userHome)
  const resolvedHostHome = path.resolve(hostHome)
  const hasHostHome = existsSync(resolvedHostHome)
  const hasMcpHome = Boolean(
    mcp
    && existsSync(path.resolve(mcpHome))
    && (mcp.requireHostHome !== true || hasHostHome),
  )
  if (!hasHostHome && !hasMcpHome) {
    console.warn(`[SKIP] 宿主目录不存在: ${resolvedHostHome}`)
    return true
  }
  let skillsValid = true
  if (projectSkills && hasHostHome) {
    const targetSkillsDir = path.join(resolvedHostHome, skillsDirName)
    if (!existsSync(targetSkillsDir)) {
      console.error(`[FAIL] 技能目录缺失: ${targetSkillsDir}`)
      skillsValid = false
    }
    else {
      skillsValid = verifyProjectedSkills(host, moluoHome, targetSkillsDir, excludedSkills)
    }
  }
  else {
    console.log('[info] 宿主未启用 skills 投影，跳过 skills 链接校验')
  }

  const mcpValid = hasMcpHome && mcp ? verifyProjectedMcp(host, moluoHome, role, mcpHome, mcp) : true
  return skillsValid && mcpValid
}

function verifyProjectedMcp(
  host: string,
  moluoHome: string,
  role: string,
  mcpHome: string,
  mcp: McpProjection,
): boolean {
  const installed = readInstalledMcpServers(moluoHome, role)
  if (!installed)
    return true
  const expected = applyMcpServerProjection(installed, mcp)
  const targetDir = mcp.relDir === '.' ? mcpHome : path.join(mcpHome, mcp.relDir)
  const targetFile = path.join(targetDir, mcp.fileName)
  if (!existsSync(targetFile)) {
    console.error(`[FAIL] MCP 配置缺失: ${targetFile}`)
    return false
  }

  try {
    const content = readFileSync(targetFile, 'utf8').replace(/^\uFEFF/u, '')
    let actualNames: Set<string>
    if (mcp.format === 'json') {
      const parsed = JSON.parse(content) as Record<string, unknown>
      const servers = parsed[mcp.serversKey]
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers))
        throw new Error(`missing "${mcp.serversKey}" object`)
      actualNames = new Set(Object.keys(servers))
    }
    else {
      actualNames = readTomlMcpServerNames(content, mcp.serversKey)
    }
    const missing = Object.keys(expected).filter(name => !actualNames.has(name))
    if (missing.length > 0) {
      console.error(`[FAIL] 缺失 MCP server: ${missing.join(', ')}`)
      return false
    }
    console.log(`[info] ${host} MCP servers 验证通过: ${Object.keys(expected).length}`)
    return true
  }
  catch (error) {
    console.error(`[FAIL] MCP 配置无效: ${targetFile}\n${String(error)}`)
    return false
  }
}

function verifyProjectedSkills(label: string, moluoHome: string, targetSkillsDir: string, excludedSkills: string[]): boolean {
  const vendorSkillsDir = path.join(moluoHome, 'vendor', 'skills')
  const expectedSkills = new Set<string>()
  if (existsSync(vendorSkillsDir)) {
    for (const name of readdirSync(vendorSkillsDir)) {
      if (name !== '.gitignore')
        expectedSkills.add(name)
    }
  }
  for (const skillName of excludedSkills)
    expectedSkills.delete(skillName)

  const targetSkillNames = new Set(readdirSync(targetSkillsDir))
  let missingCount = 0
  let brokenCount = 0
  let validCount = 0
  for (const skill of expectedSkills) {
    const skillPath = path.join(targetSkillsDir, skill)
    if (!targetSkillNames.has(skill)) {
      console.error(`[FAIL] 缺失技能链接 (Missing): ${skill}`)
      missingCount += 1
      continue
    }
    const stats = lstatSync(skillPath)
    if (stats.isSymbolicLink() && !existsSync(skillPath)) {
      console.error(`[FAIL] 损坏的软链接 (Broken Link): ${skill}`)
      brokenCount += 1
      continue
    }
    if (!stats.isSymbolicLink())
      console.warn(`[WARN] 技能不是软链接 (可能是物理拷贝): ${skill}`)
    validCount += 1
  }

  console.log(`[info] 预期技能总数: ${expectedSkills.size}`)
  console.log(`[result] 有效=${validCount}, 缺失=${missingCount}, 损坏=${brokenCount}`)
  const success = missingCount === 0 && brokenCount === 0
  console.log(success ? kleur.green(`✅ ${label} 验证通过`) : kleur.red(`❌ ${label} 验证失败`))
  return success
}
