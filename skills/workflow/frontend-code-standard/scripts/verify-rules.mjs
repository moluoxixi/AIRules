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

function assertTargetInsideAncestor(target, ancestor) {
  const resolvedTarget = path.resolve(process.cwd(), target)
  const relative = path.relative(ancestor, resolvedTarget)

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)))
    return

  throw new Error(`抽离目标必须位于最近公共父级目录下：${ancestor}`)
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
  const standard = readSkillFile('references', 'fractal-frontend-standard.md')

  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(skill, /JavaScript/, '前端规范说明必须声明 JavaScript 支持范围')
  assertContains(skill, /工具库和 UI 组件库/, '前端规范入口必须覆盖前端工具库和 UI 组件库')
  assertContains(standard, /至少 3 个独立的地方/, '前端规范必须保留三次原则')
  assertContains(standard, /最近公共父级目录/, '前端规范必须保留最近公共父级约束')
  assertContains(skill, /简单组件结构、复杂组件包结构、前端工具库结构和 UI 组件库结构/, 'SKILL.md 必须同时声明简单组件和复杂组件包结构校验')
  assertContains(skill, /只有复杂组件包、前端工具库和 UI 组件库允许通过 `index\.ts` 或 `index\.js`/, 'SKILL.md 必须限制公共入口只属于包级结构')
  assertContains(skill, /目录入口/, 'SKILL.md 必须声明目录入口规则')
  assertContains(skill, /除简单组件文件、单个业务模块根目录和 `styles\/` 目录外/, 'SKILL.md 必须声明目录入口例外')
  assertContains(skill, /`styles\/` 目录一旦创建，必须提供唯一 `index\.css`、`index\.scss` 或 `index\.less`/, 'SKILL.md 必须声明 styles 样式入口')
  assertContains(standard, /README\.md/, '前端复杂组件包结构必须强制 README.md')
  assertContains(standard, /index\.(ts|js)/, '前端复杂组件包结构必须强制单一公共入口')
  assertContains(standard, /src\//, '前端复杂组件包结构必须强制 src/ 实现目录')
  assertContains(standard, /index\.(vue|tsx|jsx)/, '前端规范必须覆盖 Vue、TypeScript 和 JSX 入口')
  assertContains(standard, /单个业务模块直接在根目录组织，不再额外创建 `src\/`/, '前端规范必须区分单个模块与组件包的目录层级')
  assertContains(standard, /除简单组件文件、单个业务模块根目录和 `styles\/` 目录外/, '前端规范必须声明通用目录入口规则')
  assertContains(standard, /styles\/index\.css`、`styles\/index\.scss` 或 `styles\/index\.less`/, '前端规范必须要求 styles 样式入口')
  assertContains(standard, /模块根目录只保留 `index\.vue` \/ `index\.tsx` \/ `index\.jsx` 作为唯一实现入口/, '单个模块必须只保留实现入口')
  assertContains(standard, /简单组件应直接使用 `ComponentName\.vue`、`ComponentName\.tsx` 或 `ComponentName\.jsx`/, '简单组件必须使用文件级组件结构')
  assertContains(standard, /Sparkline\.jsx/, '简单组件示例必须覆盖 JSX 文件形态')
  assertContains(standard, /复杂组件包或项目级组件封装必须使用独立组件包结构/, '前端规范必须用复杂组件包区分简单组件')
  assertContains(standard, /AuditDialog\/\n        README\.md\n        index\.ts\n        src\/\n          index\.vue/, '复杂子组件示例必须使用 index.ts + src/ 结构')
  assertContains(standard, /禁止穿透 `src\/`/, '前端复杂组件包必须禁止外部穿透 src/')
  assertContains(standard, /前端工具库必须使用库包结构/, '前端规范必须覆盖工具库结构')
  assertContains(standard, /UI 组件库必须使用库包结构/, '前端规范必须覆盖 UI 组件库结构')
  assertContains(standard, /src\/index\.ts` 或 `src\/index\.js/, '前端库包必须声明 src 聚合入口')

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
