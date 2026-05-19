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

  printPass('frontend complex component package structure is valid', {
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

  printPass(options.requireComponents ? 'frontend UI component library structure is valid' : 'frontend utility library structure is valid', {
    libraryRoot,
    entry: publicEntry,
    srcEntry,
  })
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

function assertSimpleComponent(root) {
  const componentPath = path.resolve(process.cwd(), root)
  const filename = path.basename(componentPath)

  if (!/^[A-Z][\w-]*\.(vue|tsx|jsx)$/.test(filename))
    throw new Error('简单组件必须使用 ComponentName.vue、ComponentName.tsx 或 ComponentName.jsx 文件')

  if (!fs.existsSync(componentPath) || !fs.statSync(componentPath).isFile())
    throw new Error('简单组件路径必须指向真实文件')

  printPass('frontend simple component structure is valid', {
    componentPath,
  })
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const businessModuleExample = readSkillFile('examples', 'business-module.md')
  const componentExample = readSkillFile('examples', 'component.md')
  const utilityExample = readSkillFile('examples', 'utility.md')
  const checklist = readSkillFile('validation', 'checklist.md')

  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(skill, /JavaScript/, '前端规范说明必须声明 JavaScript 支持范围')
  assertContains(skill, /工具库和 UI 组件库/, '前端规范入口必须覆盖前端工具库和 UI 组件库')
  assertContains(skill, /examples\/business-module\.md/, 'SKILL.md 必须声明业务模块示例')
  assertContains(skill, /examples\/component\.md/, 'SKILL.md 必须声明组件示例')
  assertContains(skill, /examples\/utility\.md/, 'SKILL.md 必须声明工具示例')
  assertContains(skill, /examples\/types-and-imports\.md/, 'SKILL.md 必须声明类型与导入示例')
  assertContains(skill, /validation\/checklist\.md/, 'SKILL.md 必须声明校验清单')
  assertContains(skill, /入口模型：前端目录统一遵循“单一入口，按需拆分”/, 'SKILL.md 必须声明入口模型')
  assertContains(skill, /满足三次原则后只能提取到最近公共父级/, 'SKILL.md 必须保留三次原则和最近公共父级约束')
  assertContains(skill, /简单组件结构、复杂组件包结构、前端工具库结构和 UI 组件库结构/, 'SKILL.md 必须同时声明简单组件和复杂组件包结构校验')
  assertContains(skill, /只有复杂组件包、前端工具库和 UI 组件库允许通过 `index\.ts` 或 `index\.js`/, 'SKILL.md 必须限制公共入口只属于包级结构')
  assertContains(skill, /普通代码目录用 `index\.ts` \/ `\.js`/, 'SKILL.md 必须声明普通代码目录入口')
  assertContains(skill, /`styles\/` 用 `index\.css` \/ `\.scss` \/ `\.less`/, 'SKILL.md 必须声明 styles 样式入口')
  assertContains(skill, /类型边界：复杂组件的 Props、Emits、Expose、Ref/, 'SKILL.md 必须声明类型边界')
  assertContains(businessModuleExample, /本文件只提供示例，不定义新规则/, '业务模块示例文件不得定义新规则')
  assertContains(componentExample, /本文件只提供示例，不定义新规则/, '组件示例文件不得定义新规则')
  assertContains(utilityExample, /本文件只提供示例，不定义新规则/, '工具示例文件不得定义新规则')
  assertContains(componentExample, /Sparkline\.jsx/, '简单组件示例必须覆盖 JSX 文件形态')
  assertContains(componentExample, /HeaderCell\.vue/, '复杂组件示例必须覆盖内部子组件')
  assertContains(componentExample, /normalize-column\.ts/, '复杂组件示例必须覆盖内部工具目录')
  assertContains(componentExample, /DataTableReact\/\n {2}README\.md\n {2}index\.ts\n {2}src\/\n {4}index\.tsx\n {4}hooks\//, '组件示例必须覆盖 React 复杂组件形态')
  assertContains(utilityExample, /## 简单工具/, '工具示例必须区分简单工具')
  assertContains(utilityExample, /## 复杂工具/, '工具示例必须区分复杂工具')
  assertContains(utilityExample, /ClipboardToolkit\/\n {2}README\.md\n {2}index\.ts\n {2}src\/\n {4}index\.ts\n {4}clipboard\/\n {6}index\.ts/, '复杂工具示例必须使用 index.ts + src/ 结构')
  assertContains(utilityExample, /utils\/\n {8}index\.ts\n {8}normalize-text\.ts\n {8}copy-text\.ts/, '复杂工具示例必须把内部工具放入 utils/ 目录')
  assertContains(utilityExample, /clipboard-api\.ts/, '复杂工具示例必须覆盖 API 子目录')
  assertContains(utilityExample, /clipboard-options\.ts/, '复杂工具示例必须覆盖 constants 子目录')
  assertContains(businessModuleExample, /AuditDialog\/\n {8}README\.md\n {8}index\.ts\n {8}src\/\n {10}index\.vue/, '复杂子组件示例必须使用 index.ts + src/ 结构')
  assertContains(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/, '校验文件不得定义新规则')
  assertContains(checklist, /node skills\/workflow\/frontend-code-standard\/scripts\/verify-rules\.mjs module --root/, '校验文件必须提供脚本用法')
  assertContains(checklist, /入口是否唯一/, '校验文件必须提供检查清单')

  printPass('frontend-code-standard self rules are valid')
}

function verifyHoist(args) {
  const target = getOption(args, '--target')
  const uses = getListAfter(args, '--uses')
  const ancestor = nearestCommonAncestor(uses)

  assertTargetInsideAncestor(target, ancestor, uses)

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

  if (command === 'module')
    return assertModule(getOption(args, '--root'))

  if (command === 'simple-component' || command === 'simple')
    return assertSimpleComponent(getOption(args, '--root'))

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
