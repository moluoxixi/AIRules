import { existsSync, lstatSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import kleur from 'kleur'
import { findHostConfig, resolveHostPaths } from '../../constants/hosts.js'

/** Verify only the skills managed by AIRules. Host-native assets belong to project initializers. */
export async function verifyHost(
  host: string,
  moluoHome: string,
  userHome = os.homedir(),
): Promise<boolean> {
  console.log(`\n--- 正在验证宿主: ${host} ---`)

  const config = findHostConfig(host)
  if (!config)
    return false

  const { hostHome, skillsDirName, excludedSkills, projectSkills } = resolveHostPaths(config, userHome)
  const resolvedHostHome = path.resolve(hostHome)
  if (!existsSync(resolvedHostHome)) {
    console.warn(`[SKIP] 宿主目录不存在: ${resolvedHostHome}`)
    return true
  }
  if (!projectSkills) {
    console.log('[info] 宿主未启用 skills 投影，跳过 skills 链接校验')
    return true
  }

  const targetSkillsDir = path.join(resolvedHostHome, skillsDirName)
  if (!existsSync(targetSkillsDir)) {
    console.error(`[FAIL] 技能目录缺失: ${targetSkillsDir}`)
    return false
  }

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
  console.log(success ? kleur.green(`✅ ${host} 验证通过`) : kleur.red(`❌ ${host} 验证失败`))
  return success
}
