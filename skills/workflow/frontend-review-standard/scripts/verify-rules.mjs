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

function printPass(message) {
  console.log(`PASS ${message}`)
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const reviewOutput = readSkillFile('examples', 'review-output.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /frontend-component-standard/, 'SKILL.md 必须引用组件实现标准')
  assertContains(skill, /frontend-module-standard/, 'SKILL.md 必须引用模块实现标准')
  assertContains(skill, /frontend-library-standard/, 'SKILL.md 必须引用库实现标准')
  assertContains(skill, /目标分类/, 'SKILL.md 必须覆盖目标分类')
  assertContains(skill, /检查范围/, 'SKILL.md 必须覆盖检查范围')
  assertContains(skill, /改动建议汇总/, 'SKILL.md 必须覆盖改动建议汇总')
  assertContains(skill, /只写“建议优化”/, 'SKILL.md 必须禁止空泛建议')
  assertContains(reviewOutput, /目标分类：component-package/, '评审示例必须覆盖组件评审')
  assertContains(reviewOutput, /目标分类：utility-library/, '评审示例必须覆盖工具包评审')
  assertContains(reviewOutput, /改动建议汇总：/, '评审示例必须覆盖改动建议汇总')
  assertContains(checklist, /结构校验脚本的 `PASS` 错写成实现整体 `PASS`/, '校验清单必须覆盖脚本边界')

  printPass('frontend-review-standard self rules are valid')
}

try {
  verifySelf()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
