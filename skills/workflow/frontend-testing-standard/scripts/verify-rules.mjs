#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSkillFile(...segments) {
  return fs.readFileSync(path.join(skillRoot, ...segments), 'utf8')
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content))
    throw new Error(message)
}

function printPass(message, details = {}) {
  console.log(`PASS ${message}`)

  for (const [key, value] of Object.entries(details))
    console.log(`${key}: ${value}`)
}

function printHelp() {
  console.log(`用法: node verify-rules.mjs [command]

命令:
  self      校验本 skill 的规则完整性（默认）
  --help    显示帮助信息

示例:
  node scripts/verify-rules.mjs
  node scripts/verify-rules.mjs self
`)
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const testDimensions = readSkillFile('validation', 'test-dimensions.md')
  const commandDiscovery = readSkillFile('validation', 'command-discovery.md')
  const browserVerification = readSkillFile('validation', 'browser-verification.md')
  const accessibility = readSkillFile('validation', 'accessibility.md')
  const coverageAndRisk = readSkillFile('validation', 'coverage-and-risk.md')

  assertContains(skill, /name: frontend-testing-standard/, 'SKILL.md 必须声明正确的 skill name')
  assertContains(skill, /前端验证范围/, 'SKILL.md 必须声明用途')
  assertContains(skill, /唯一规则源/, 'SKILL.md 必须声明唯一规则源')
  assertContains(skill, /静态质量/, 'SKILL.md 必须覆盖静态质量维度')
  assertContains(skill, /类型正确性/, 'SKILL.md 必须覆盖类型正确性维度')
  assertContains(skill, /单元逻辑/, 'SKILL.md 必须覆盖单元逻辑维度')
  assertContains(skill, /组件行为/, 'SKILL.md 必须覆盖组件行为维度')
  assertContains(skill, /浏览器运行时/, 'SKILL.md 必须覆盖浏览器运行时维度')
  assertContains(skill, /可访问性/, 'SKILL.md 必须覆盖可访问性维度')
  assertContains(skill, /覆盖率/, 'SKILL.md 必须覆盖覆盖率维度')
  assertContains(skill, /`MISSING`.*`NOT RUN`.*`N\/A`/s, 'SKILL.md 必须覆盖状态定义')
  assertContains(skill, /vue-testing-best-practices/, 'SKILL.md 必须关联 Vue 测试 skill')
  assertContains(skill, /vitest/, 'SKILL.md 必须关联 vitest skill')
  assertContains(skill, /playwright/, 'SKILL.md 必须关联 playwright skill')
  assertContains(skill, /web-design-guidelines/, 'SKILL.md 必须关联 web-design-guidelines skill')
  assertContains(skill, /validation\/test-dimensions\.md/, 'SKILL.md 必须索引测试维度文件')
  assertContains(skill, /validation\/command-discovery\.md/, 'SKILL.md 必须索引命令发现文件')
  assertContains(skill, /validation\/browser-verification\.md/, 'SKILL.md 必须索引浏览器验证文件')
  assertContains(skill, /validation\/accessibility\.md/, 'SKILL.md 必须索引可访问性文件')
  assertContains(skill, /validation\/coverage-and-risk\.md/, 'SKILL.md 必须索引覆盖率文件')

  assertContains(testDimensions, /静态质量|静态检查|lint/i, '测试维度必须覆盖静态检查')
  assertContains(testDimensions, /类型正确性|类型检查|typecheck/i, '测试维度必须覆盖类型检查')
  assertContains(testDimensions, /单元逻辑|单元测试|unit/i, '测试维度必须覆盖单元测试')
  assertContains(testDimensions, /组件行为|组件测试|component/i, '测试维度必须覆盖组件测试')

  assertContains(commandDiscovery, /package\.json|scripts/i, '命令发现必须覆盖 package.json')

  assertContains(browserVerification, /浏览器|browser/i, '浏览器验证必须覆盖浏览器相关内容')
  assertContains(browserVerification, /交互|interaction/i, '浏览器验证必须覆盖交互相关内容')

  assertContains(accessibility, /可访问性|accessibility|a11y/i, '可访问性文件必须覆盖可访问性内容')
  assertContains(accessibility, /键盘|keyboard|焦点|focus|label/i, '可访问性文件必须覆盖交互可访问性')

  assertContains(coverageAndRisk, /覆盖率|coverage/i, '覆盖率文件必须覆盖覆盖率内容')
  assertContains(coverageAndRisk, /风险|risk/i, '覆盖率文件必须覆盖风险评估')

  printPass('frontend-testing-standard self rules are valid')
}

function main() {
  const [command = 'self'] = process.argv.slice(2)

  if (command === '--help' || command === '-h')
    return printHelp()

  if (command === 'self')
    return verifySelf()

  throw new Error(`未知命令：${command}，使用 --help 查看帮助`)
}

try {
  main()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
