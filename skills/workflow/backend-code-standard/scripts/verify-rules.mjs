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
    throw new Error(`抽离目标必须位于最近公共父级的直接共享目录：${ancestor}`)
  }

  if (directSegments.length === 1)
    return

  throw new Error(`抽离目标必须位于最近公共父级的直接共享目录：${ancestor}`)
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const nodeExamples = readSkillFile('examples', 'node-backend-structure.md')
  const nestExamples = readSkillFile('examples', 'nestjs-module-structure.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(skill, /examples\/node-backend-structure\.md/, 'SKILL.md 必须声明 Node 示例目录')
  assertContains(skill, /examples\/nestjs-module-structure\.md/, 'SKILL.md 必须声明 NestJS 示例目录')
  assertContains(skill, /validation\/checklist\.md/, 'SKILL.md 必须声明校验清单')
  assertContains(skill, /满足三次原则后只能提取到最近公共父级/, 'SKILL.md 必须保留三次原则和最近公共父级约束')
  assertContains(skill, /运行时校验/, 'SKILL.md 必须声明后端运行时校验')
  assertContains(skill, /协议错误边界/, 'SKILL.md 必须声明协议错误边界')
  assertContains(skill, /生产边界/, 'SKILL.md 必须声明生产边界')
  assertContains(skill, /NestJS 必须使用 class DTO、`class-validator` 和 ValidationPipe/, 'SKILL.md 必须声明 NestJS DTO 校验契约')
  assertContains(nodeExamples, /本文件只提供 Fastify、Express、Koa、Nitro\/H3 示例，不定义新规则/, 'Node 示例文件不得定义新规则')
  assertContains(nodeExamples, /modules\/\n {2}orders\/\n {4}controller\.ts/, 'Node 示例必须覆盖垂直切片结构')
  assertContains(nestExamples, /本文件只提供示例，不定义新规则/, 'NestJS 示例文件不得定义新规则')
  assertContains(nestExamples, /src\/modules\/orders\/\n {2}orders\.controller\.ts/, 'NestJS 示例必须覆盖模块结构')
  assertContains(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/, '校验文件不得定义新规则')
  assertContains(checklist, /node skills\/workflow\/backend-code-standard\/scripts\/verify-rules\.mjs hoist --target/, '校验文件必须提供脚本用法')

  printPass('backend-code-standard self rules are valid')
}

function verifyHoist(args) {
  const target = getOption(args, '--target')
  const uses = getListAfter(args, '--uses')
  const ancestor = nearestCommonAncestor(uses)

  assertTargetInsideAncestor(target, ancestor, uses)

  printPass('backend hoist target stays under nearest common ancestor', {
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
