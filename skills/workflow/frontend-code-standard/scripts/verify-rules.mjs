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

function assertTargetInsideAncestor(target, ancestor) {
  const resolvedTarget = path.resolve(process.cwd(), target)
  const relative = path.relative(ancestor, resolvedTarget)

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)))
    return

  throw new Error(`抽离目标必须位于最近公共父级目录下：${ancestor}`)
}

function assertComponentPackage(root) {
  const componentRoot = path.resolve(process.cwd(), root)
  const readmePath = path.join(componentRoot, 'README.md')
  const entryPath = path.join(componentRoot, 'index.ts')
  const srcPath = path.join(componentRoot, 'src')

  if (!fs.existsSync(readmePath))
    throw new Error('组件包根目录缺少 README.md')

  if (!fs.existsSync(entryPath))
    throw new Error('组件包根目录缺少 index.ts')

  if (!fs.statSync(srcPath).isDirectory())
    throw new Error('组件包根目录缺少 src/ 实现目录')

  const readme = fs.readFileSync(readmePath, 'utf8').trim()

  if (readme.length === 0)
    throw new Error('组件 README.md 不得为空，必须描述组件如何使用')

  if (!/(使用|用法|Usage|Props|Events|Emits|Expose|Slots|API)/.test(readme))
    throw new Error('组件 README.md 必须包含使用方式或接口契约说明')

  printPass('frontend component package structure is valid', {
    componentRoot,
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const standard = readSkillFile('references', 'fractal-frontend-standard.md')

  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(standard, /至少 3 个独立的地方/, '前端规范必须保留三次原则')
  assertContains(standard, /最近公共父级目录/, '前端规范必须保留最近公共父级约束')
  assertContains(standard, /README\.md/, '前端组件包结构必须强制 README.md')
  assertContains(standard, /index\.ts/, '前端组件包结构必须强制 index.ts')
  assertContains(standard, /src\//, '前端组件包结构必须强制 src/ 实现目录')
  assertContains(standard, /禁止穿透 `src\/`/, '前端组件包必须禁止外部穿透 src/')

  printPass('frontend-code-standard self rules are valid')
}

function verifyHoist(args) {
  const target = getOption(args, '--target')
  const uses = getListAfter(args, '--uses')
  const ancestor = nearestCommonAncestor(uses)

  assertTargetInsideAncestor(target, ancestor)

  printPass('frontend hoist target stays under nearest common ancestor', {
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

  if (command === 'component')
    return assertComponentPackage(getOption(args, '--root'))

  throw new Error(`未知命令：${command}`)
}

try {
  main()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
