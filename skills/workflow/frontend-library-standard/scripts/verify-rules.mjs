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

function assertCodeDirectoryEntries(directory, root, options = {}) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const parentHasPublicEntry = findExistingFiles(directory, PUBLIC_ENTRY_FILENAMES).length > 0

  for (const entry of entries) {
    if (!entry.isDirectory())
      continue

    const childDirectory = path.join(directory, entry.name)
    const relative = relativeDirectory(root, childDirectory)
    const childPublicEntries = findExistingFiles(childDirectory, PUBLIC_ENTRY_FILENAMES)
    const childImplementationEntries = findExistingFiles(childDirectory, MODULE_IMPLEMENTATION_FILENAMES)
    const isImplementationSrc = entry.name === 'src' && parentHasPublicEntry && childImplementationEntries.length === 1

    if (entry.name === 'styles')
      assertSingleExistingFile(childDirectory, STYLE_ENTRY_FILENAMES, `样式目录 ${relative}/ 入口`)
    else if (!isImplementationSrc)
      assertSingleExistingFile(childDirectory, PUBLIC_ENTRY_FILENAMES, `目录 ${relative}/ 聚合入口`)

    if (childPublicEntries.length > 0 || isImplementationSrc || options.descendIntoMissingEntryDirectory)
      assertCodeDirectoryEntries(childDirectory, root, options)
  }
}

function assertComponentPackage(root) {
  const componentRoot = path.resolve(process.cwd(), root)
  const readmePath = path.join(componentRoot, 'README.md')
  const srcPath = path.join(componentRoot, 'src')
  const publicEntry = assertSingleExistingFile(componentRoot, PUBLIC_ENTRY_FILENAMES, '复杂组件包根目录公共入口')
  const rootImplementationEntries = findExistingFiles(componentRoot, MODULE_IMPLEMENTATION_FILENAMES)

  if (!fs.existsSync(readmePath))
    throw new Error('复杂组件包根目录缺少 README.md')

  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory())
    throw new Error('复杂组件包根目录缺少 src/ 实现目录')

  if (rootImplementationEntries.length > 0)
    throw new Error(`复杂组件包根目录不得放置实现入口：${rootImplementationEntries.join('、')}`)

  const srcImplementationEntry = assertSingleExistingFile(srcPath, MODULE_IMPLEMENTATION_FILENAMES, '复杂组件包 src/ 实现入口')
  const readme = fs.readFileSync(readmePath, 'utf8').trim()

  if (readme.length === 0)
    throw new Error('复杂组件 README.md 不得为空，必须描述组件如何使用')

  if (!/(使用|用法|Usage|Props|Events|Emits|Expose|Slots|API)/.test(readme))
    throw new Error('复杂组件 README.md 必须包含使用方式或接口契约说明')

  assertCodeDirectoryEntries(componentRoot, componentRoot)

  printPass('frontend library component package structure is valid', {
    componentRoot,
    entry: publicEntry,
    implementationEntry: srcImplementationEntry,
  })
}

function assertLibraryPackage(root, options = {}) {
  const libraryRoot = path.resolve(process.cwd(), root)
  const readmePath = path.join(libraryRoot, 'README.md')
  const srcPath = path.join(libraryRoot, 'src')
  const publicEntry = assertSingleExistingFile(libraryRoot, PUBLIC_ENTRY_FILENAMES, '库根目录公共入口')
  const rootImplementationEntries = findExistingFiles(libraryRoot, MODULE_IMPLEMENTATION_FILENAMES)

  if (!fs.existsSync(readmePath))
    throw new Error('库根目录缺少 README.md')

  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory())
    throw new Error('库根目录缺少 src/ 实现目录')

  if (rootImplementationEntries.length > 0)
    throw new Error(`库根目录不得放置组件实现入口：${rootImplementationEntries.join('、')}`)

  const srcEntry = assertSingleExistingFile(srcPath, PUBLIC_ENTRY_FILENAMES, '库 src/ 聚合入口')
  const readme = fs.readFileSync(readmePath, 'utf8').trim()

  if (readme.length === 0)
    throw new Error('库 README.md 不得为空，必须描述库如何使用')

  if (!/(使用|用法|Usage|API|Exports|组件|工具|安装|Install)/.test(readme))
    throw new Error('库 README.md 必须包含使用方式或公开 API 说明')

  if (options.requireComponents) {
    const componentsPath = path.join(srcPath, 'components')

    if (!fs.existsSync(componentsPath) || !fs.statSync(componentsPath).isDirectory())
      throw new Error('UI 组件库缺少 src/components/ 组件目录')

    const componentDirs = fs.readdirSync(componentsPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory())

    if (componentDirs.length === 0)
      throw new Error('UI 组件库 src/components/ 下至少需要一个复杂组件包')

    for (const componentDir of componentDirs)
      assertComponentPackage(path.join(componentsPath, componentDir.name))
  }

  assertCodeDirectoryEntries(libraryRoot, libraryRoot)

  printPass(options.requireComponents ? 'frontend UI library structure is valid' : 'frontend utility library structure is valid', {
    libraryRoot,
    entry: publicEntry,
    srcEntry,
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const libraryExample = readSkillFile('examples', 'library.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /允许完全重写旧库结构/, 'SKILL.md 必须声明允许完全重写旧库结构')
  assertContains(skill, /不为兼容保留过渡出口/, 'SKILL.md 必须声明不保留过渡出口')
  assertContains(skill, /utility-library/, 'SKILL.md 必须覆盖 utility-library')
  assertContains(skill, /ui-library/, 'SKILL.md 必须覆盖 ui-library')
  assertContains(skill, /component-package/, 'SKILL.md 必须覆盖 component-package')
  assertContains(skill, /README 必须说明使用方式/, 'SKILL.md 必须覆盖 README 约束')
  assertContains(skill, /禁止 deep import/, 'SKILL.md 必须覆盖 deep import 约束')
  assertContains(skill, /副作用显式/, 'SKILL.md 必须覆盖副作用边界')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(libraryExample, /ClipboardToolkit\//, '库示例必须覆盖工具包结构')
  assertContains(libraryExample, /MoluoxixiUI\//, '库示例必须覆盖 UI 组件库结构')
  assertContains(libraryExample, /涉及浏览器 API 的工具显式接收依赖/, '库示例必须覆盖副作用边界')
  assertContains(checklist, /只为兼容旧导出存在的双 barrel、镜像目录或过渡出口/, '校验文件必须覆盖兼容导出检查')
  assertContains(checklist, /README 是否覆盖使用方式、公共 API、主要约束和典型示例/, '校验文件必须覆盖 README 检查')

  printPass('frontend-library-standard self rules are valid')
}

function main() {
  const [command = 'self', ...args] = process.argv.slice(2)

  if (command === 'self')
    return verifySelf()

  if (command === 'component' || command === 'package' || command === 'project')
    return assertComponentPackage(getOption(args, '--root'))

  if (command === 'utility' || command === 'tool-library')
    return assertLibraryPackage(getOption(args, '--root'))

  if (command === 'ui-library' || command === 'component-library')
    return assertLibraryPackage(getOption(args, '--root'), { requireComponents: true })

  throw new Error(`未知命令：${command}`)
}

try {
  main()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
