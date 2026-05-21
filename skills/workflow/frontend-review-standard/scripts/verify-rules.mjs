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
  const reviewOutput = readSkillFile('examples', 'review-output.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /vue-component-standard.*react-component-standard/s, 'SKILL.md 必须引用 Vue 和 React 组件实现标准')
  assertContains(skill, /vue-module-standard.*react-module-standard/s, 'SKILL.md 必须引用 Vue 和 React 模块实现标准')
  assertContains(skill, /frontend-library-standard/, 'SKILL.md 必须引用库实现标准')
  assertContains(skill, /目标分类/, 'SKILL.md 必须覆盖目标分类')
  assertContains(skill, /检查范围/, 'SKILL.md 必须覆盖检查范围')
  assertContains(skill, /总结论/, 'SKILL.md 必须覆盖总结论')
  assertContains(skill, /问题列表/, 'SKILL.md 必须覆盖问题列表')
  assertContains(skill, /改动建议汇总/, 'SKILL.md 必须覆盖改动建议汇总')
  assertContains(skill, /只写[“”]建议优化/, 'SKILL.md 必须禁止空泛建议')
  assertContains(skill, /严重级别.*critical.*major.*minor/s, 'SKILL.md 必须定义严重级别')
  assertContains(skill, /规则点/, 'SKILL.md 必须要求规则点')
  assertContains(skill, /证据/, 'SKILL.md 必须要求证据')

  assertContains(reviewOutput, /本文件只提供示例，不定义新规则/, '评审示例必须声明不定义新规则')
  assertContains(reviewOutput, /目标分类：component-package/, '评审示例必须覆盖组件评审')
  assertContains(reviewOutput, /目标分类：utility-library/, '评审示例必须覆盖工具包评审')
  assertContains(reviewOutput, /检查范围：/, '评审示例必须包含检查范围')
  assertContains(reviewOutput, /总结论：FAIL/, '评审示例必须包含总结论')
  assertContains(reviewOutput, /\[major\]/, '评审示例必须包含 major 级别问题')
  assertContains(reviewOutput, /\[minor\]/, '评审示例必须包含 minor 级别问题')
  assertContains(reviewOutput, /规则点：/, '评审示例必须包含规则点')
  assertContains(reviewOutput, /证据：/, '评审示例必须包含证据')
  assertContains(reviewOutput, /问题说明：/, '评审示例必须包含问题说明')
  assertContains(reviewOutput, /改动建议：/, '评审示例必须包含改动建议')
  assertContains(reviewOutput, /改动建议汇总：/, '评审示例必须覆盖改动建议汇总')

  assertContains(checklist, /本文件只提供检查清单，不定义新规则/, '校验清单必须声明不定义新规则')
  assertContains(checklist, /结构校验脚本的 `PASS` 错写成实现整体 `PASS`/, '校验清单必须覆盖脚本边界')

  printPass('frontend-review-standard self rules are valid')
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
