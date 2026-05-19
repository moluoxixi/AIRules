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

function getOption(args, name) {
  const index = args.indexOf(name)

  if (index === -1)
    throw new Error(`缺少参数 ${name}`)

  const value = args[index + 1]

  if (!value || value.startsWith('--'))
    throw new Error(`参数 ${name} 必须提供值`)

  return value
}

function getListAfter(args, name) {
  const index = args.indexOf(name)

  if (index === -1)
    throw new Error(`缺少参数 ${name}`)

  const values = args.slice(index + 1).filter(value => !value.startsWith('--'))

  if (values.length < 3)
    throw new Error(`${name} 至少需要 3 个独立使用点，用于验证三次原则`)

  return values
}

function pathLooksLikeFile(inputPath) {
  return path.extname(inputPath) !== ''
}

function normalizeDirectory(inputPath) {
  const resolved = path.resolve(process.cwd(), inputPath)

  return pathLooksLikeFile(resolved) ? path.dirname(resolved) : resolved
}

function nearestCommonAncestor(paths) {
  const partsList = paths.map(inputPath => normalizeDirectory(inputPath).split(path.sep))
  const [firstParts] = partsList
  const commonParts = []

  for (const [index, part] of firstParts.entries()) {
    if (!partsList.every(parts => parts[index] === part))
      break

    commonParts.push(part)
  }

  if (commonParts.length === 0)
    throw new Error('无法计算最近公共父级目录，请确认使用点路径属于同一文件系统根')

  return commonParts.join(path.sep)
}

function assertTargetInsideAncestor(target, ancestor, uses) {
  const resolvedTarget = path.resolve(process.cwd(), target)
  const relative = path.relative(ancestor, resolvedTarget)

  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(`抽离目标必须位于最近公共父级目录下：${ancestor}`)

  if (relative === '')
    return

  const directSegments = relative.split(path.sep).filter(Boolean)

  if (uses.some((usePath) => {
    const useRelative = path.relative(ancestor, normalizeDirectory(usePath))
    const [firstSegment] = useRelative.split(path.sep).filter(Boolean)

    return firstSegment === directSegments[0]
  })) {
    throw new Error(`抽离目标必须位于最近公共父级的直接共享 package：${ancestor}`)
  }

  if (directSegments.length === 1)
    return

  throw new Error(`抽离目标必须位于最近公共父级的直接共享 package：${ancestor}`)
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const examples = readSkillFile('examples', 'spring-boot-structure.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(skill, /不得用仓库根级共享脚本替代/, 'SKILL.md 必须声明验证脚本保持 skill-local')
  assertContains(skill, /examples\/spring-boot-structure\.md/, 'SKILL.md 必须声明示例目录')
  assertContains(skill, /validation\/checklist\.md/, 'SKILL.md 必须声明校验清单')
  assertContains(skill, /Java 17\+ 基线、Java 21\/25 LTS、Spring Boot/, 'Java 规范必须声明 Java 与 Spring Boot 适用范围')
  assertContains(skill, /构造函数注入/, 'Java 规范必须保留构造函数注入约束')
  assertContains(skill, /jakarta\.validation/, 'Java 规范必须保留 Bean Validation 契约')
  assertContains(skill, /禁止把 JPA Entity 直接作为外部 API 契约/, 'Java 规范必须隔离 Entity 与 API DTO')
  assertContains(skill, /Flyway 或 Liquibase/, 'Java 规范必须保留迁移要求')
  assertContains(skill, /三次原则/, 'Java 规范必须保留三次原则')
  assertContains(skill, /最近公共父级/, 'Java 规范必须保留最近公共父级约束')
  assertContains(examples, /本文件只提供示例，不定义新规则/, '示例文件不得定义新规则')
  assertContains(examples, /src\/main\/java\/com\/example\/order\//, 'Java 示例必须覆盖领域包结构')
  assertContains(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/, '校验文件不得定义新规则')
  assertContains(checklist, /node skills\/workflow\/java-code-standard\/scripts\/verify-rules\.mjs hoist --target/, '校验文件必须提供脚本用法')

  printPass('java-code-standard self rules are valid')
}

function verifyHoist(args) {
  const target = getOption(args, '--target')
  const uses = getListAfter(args, '--uses')
  const ancestor = nearestCommonAncestor(uses)

  assertTargetInsideAncestor(target, ancestor, uses)

  printPass('java hoist target stays under nearest common ancestor', {
    nearestCommonAncestor: ancestor,
    target: path.resolve(process.cwd(), target),
  })
}

function main() {
  const [command = 'self', ...args] = process.argv.slice(2)

  if (command === 'self')
    return verifySelf()

  if (command === 'hoist')
    return verifyHoist(args)

  throw new Error(`未知命令：${command}`)
}

try {
  main()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
