#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ENTRY_FILENAMES = ['index.ts', 'index.js']
const STYLE_ENTRY_FILENAMES = ['index.css', 'index.scss', 'index.less']
const MODULE_IMPLEMENTATION_FILENAMES = ['index.vue', 'index.tsx', 'index.jsx']

function readSkillFile(...segments) {
  return fs.readFileSync(path.join(skillRoot, ...segments), 'utf8')
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content))
    throw new Error(message)
}

function findExistingFiles(directory, filenames) {
  return filenames.filter(filename => fs.existsSync(path.join(directory, filename)))
}

function relativeDirectory(root, directory) {
  const relative = path.relative(root, directory)

  return relative === '' ? '.' : relative.split(path.sep).join('/')
}

function assertSingleExistingFile(directory, filenames, label) {
  const existingFiles = findExistingFiles(directory, filenames)

  if (existingFiles.length === 0)
    throw new Error(`${label} 缺少唯一入口：${filenames.join('、')}`)

  if (existingFiles.length > 1)
    throw new Error(`${label} 只能存在一个入口：${filenames.join('、')}`)

  return existingFiles[0]
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

function assertCodeDirectoryEntries(directory, root) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory())
      continue

    const childDirectory = path.join(directory, entry.name)
    const relative = relativeDirectory(root, childDirectory)

    if (entry.name === 'styles')
      assertSingleExistingFile(childDirectory, STYLE_ENTRY_FILENAMES, `样式目录 ${relative}/ 入口`)
    else
      assertSingleExistingFile(childDirectory, PUBLIC_ENTRY_FILENAMES, `目录 ${relative}/ 聚合入口`)

    assertCodeDirectoryEntries(childDirectory, root)
  }
}

function assertModule(root) {
  const moduleRoot = path.resolve(process.cwd(), root)
  const srcPath = path.join(moduleRoot, 'src')
  const implementationEntry = assertSingleExistingFile(moduleRoot, MODULE_IMPLEMENTATION_FILENAMES, '模块根目录实现入口')
  const publicEntries = findExistingFiles(moduleRoot, PUBLIC_ENTRY_FILENAMES)

  if (fs.existsSync(srcPath))
    throw new Error('单个模块不得再嵌套 src/ 目录')

  if (publicEntries.length > 0)
    throw new Error(`单个模块根目录不得创建公共入口：${publicEntries.join('、')}`)

  assertCodeDirectoryEntries(moduleRoot, moduleRoot)

  printPass('frontend module structure is valid', {
    moduleRoot,
    implementationEntry,
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const businessModuleExample = readSkillFile('examples', 'business-module.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /允许直接替换旧模块结构/, 'SKILL.md 必须声明允许直接替换旧模块结构')
  assertContains(skill, /不为历史兼容保留中间层/, 'SKILL.md 必须声明不保留中间层兼容结构')
  assertContains(skill, /business-module/, 'SKILL.md 必须覆盖 business-module')
  assertContains(skill, /ordinary-module/, 'SKILL.md 必须覆盖 ordinary-module')
  assertContains(skill, /三次原则/, 'SKILL.md 必须覆盖三次原则')
  assertContains(skill, /最近公共父级/, 'SKILL.md 必须覆盖最近公共父级')
  assertContains(skill, /路径别名优先/, 'SKILL.md 必须覆盖路径别名规则')
  assertContains(skill, /禁止 deep import/, 'SKILL.md 必须覆盖 deep import 规则')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(businessModuleExample, /views\//, '模块示例必须覆盖页面模块结构')
  assertContains(businessModuleExample, /最近公共父级/, '模块示例必须覆盖最近公共父级说明')
  assertContains(checklist, /只为兼容旧路径存在的中间层目录、双出口或伪共享目录/, '校验文件必须覆盖兼容路径检查')
  assertContains(checklist, /公共代码抽离是否满足三次原则，并落在最近公共父级/, '校验文件必须覆盖三次原则检查')

  printPass('frontend-module-standard self rules are valid')
}

function verifyHoist(args) {
  const target = getOption(args, '--target')
  const uses = getListAfter(args, '--uses')
  const ancestor = nearestCommonAncestor(uses)

  assertTargetInsideAncestor(target, ancestor, uses)

  printPass('frontend module hoist target stays under nearest common ancestor', {
    nearestCommonAncestor: ancestor,
    target: path.resolve(process.cwd(), target),
  })
}

function main() {
  const [command = 'self', ...args] = process.argv.slice(2)

  if (command === 'self')
    return verifySelf()

  if (command === 'module')
    return assertModule(getOption(args, '--root'))

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
