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
  const examples = readSkillFile('examples', 'nestjs-module-structure.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /^---[\s\S]*name: nestjs-backend-standard/m, 'SKILL.md 必须声明正确的 skill name')
  assertContains(skill, /用于新写或重构 NestJS 后端模块/, 'SKILL.md 必须明确触发场景')
  assertContains(skill, /backend-implementation-standard/, 'SKILL.md 必须引用通用后端实现标准')
  assertContains(skill, /模块自治/, 'SKILL.md 必须包含模块自治原则')
  assertContains(skill, /禁止绕过 DI/, 'SKILL.md 必须包含 DI 约束')
  assertContains(skill, /class DTO、`class-validator` 和 `ValidationPipe`/, 'SKILL.md 必须提供默认校验建议')
  assertContains(skill, /横切职责单一/, 'SKILL.md 必须包含横切职责约束')
  assertContains(skill, /配置类型化/, 'SKILL.md 必须包含配置约束')
  assertContains(skill, /异常映射清晰/, 'SKILL.md 必须包含异常映射约束')
  assertContains(examples, /本文件只提供示例，不定义新规则/, '示例文件不得定义新规则')
  assertContains(examples, /orders\.module\.ts/, '示例必须覆盖模块结构')
  assertContains(examples, /构造函数注入/, '示例必须覆盖 DI 边界')
  assertContains(checklist, /本文件只提供检查清单，不定义新规则/, '校验文件不得定义新规则')
  assertContains(checklist, /class DTO、`class-validator` 和 `ValidationPipe`/, '校验文件必须覆盖校验方案')

  printPass('nestjs-backend-standard self rules are valid')
}

try {
  verifySelf()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
