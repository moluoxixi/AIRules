#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ENTRY_FILENAMES = ['index.ts', 'index.js']
const STYLE_ENTRY_FILENAMES = ['index.css', 'index.scss', 'index.less']
const COMPONENT_IMPLEMENTATION_FILENAMES = ['index.vue', 'index.tsx', 'index.jsx']
const MODULE_IMPLEMENTATION_FILENAMES = ['index.vue', 'index.tsx', 'index.jsx']
const MAX_DEPTH = 10
const IGNORED_DIRECTORIES = ['node_modules', '.git', 'dist', 'build', '.nuxt', '.output', '.next', '.turbo', '__tests__', '__demos__', '__stories__']
const NON_AGGREGATE_DIRECTORIES = ['schemas']

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

  if (values.length < 2)
    throw new Error(`${name} 至少需要 2 个明确使用点，用于验证复用与提升边界`)

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

function assertCodeDirectoryEntries(directory, root, options = {}, depth = 0) {
  if (depth > MAX_DEPTH)
    throw new Error(`目录深度超过 ${MAX_DEPTH} 层，可能存在循环引用或目录结构异常`)

  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const parentHasPublicEntry = findExistingFiles(directory, PUBLIC_ENTRY_FILENAMES).length > 0
  const implementationEntries = options.implementationEntries ?? COMPONENT_IMPLEMENTATION_FILENAMES

  for (const entry of entries) {
    if (!entry.isDirectory())
      continue

    if (IGNORED_DIRECTORIES.includes(entry.name))
      continue

    const childDirectory = path.join(directory, entry.name)
    const relative = relativeDirectory(root, childDirectory)
    const childPublicEntries = findExistingFiles(childDirectory, PUBLIC_ENTRY_FILENAMES)
    const childImplementationEntries = findExistingFiles(childDirectory, implementationEntries)
    const isImplementationSrc = entry.name === 'src' && parentHasPublicEntry && childImplementationEntries.length === 1

    if (NON_AGGREGATE_DIRECTORIES.includes(entry.name)) {
      assertCodeDirectoryEntries(childDirectory, root, options, depth + 1)
    }
    else if (entry.name === 'styles') {
      assertSingleExistingFile(childDirectory, STYLE_ENTRY_FILENAMES, `样式目录 ${relative}/ 入口`)
    }
    else if (!isImplementationSrc) {
      assertSingleExistingFile(childDirectory, PUBLIC_ENTRY_FILENAMES, `目录 ${relative}/ 聚合入口`)
    }

    if (childPublicEntries.length > 0 || isImplementationSrc || options.descendIntoMissingEntryDirectory)
      assertCodeDirectoryEntries(childDirectory, root, options, depth + 1)
  }
}

function assertComponentPackage(root) {
  const componentRoot = path.resolve(process.cwd(), root)
  const readmePath = path.join(componentRoot, 'README.md')
  const srcPath = path.join(componentRoot, 'src')
  const publicEntry = assertSingleExistingFile(componentRoot, PUBLIC_ENTRY_FILENAMES, '复杂组件包根目录公共入口')
  const rootImplementationEntries = findExistingFiles(componentRoot, COMPONENT_IMPLEMENTATION_FILENAMES)

  if (!fs.existsSync(readmePath))
    throw new Error('复杂组件包根目录缺少 README.md')

  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory())
    throw new Error('复杂组件包根目录缺少 src/ 实现目录')

  if (rootImplementationEntries.length > 0)
    throw new Error(`复杂组件包根目录不得放置实现入口：${rootImplementationEntries.join('、')}`)

  const srcImplementationEntry = assertSingleExistingFile(srcPath, COMPONENT_IMPLEMENTATION_FILENAMES, '复杂组件包 src/ 实现入口')
  const readme = fs.readFileSync(readmePath, 'utf8').trim()

  if (readme.length === 0)
    throw new Error('复杂组件 README.md 不得为空，必须描述组件如何使用')

  if (!/(使用|用法|Usage|Props|Events|Emits|Expose|Slots|API|Ref|Children)/.test(readme))
    throw new Error('复杂组件 README.md 必须包含使用方式或接口契约说明')

  assertCodeDirectoryEntries(componentRoot, componentRoot, { implementationEntries: COMPONENT_IMPLEMENTATION_FILENAMES })

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
  const rootImplementationEntries = findExistingFiles(libraryRoot, COMPONENT_IMPLEMENTATION_FILENAMES)

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

  assertCodeDirectoryEntries(libraryRoot, libraryRoot, { implementationEntries: COMPONENT_IMPLEMENTATION_FILENAMES })

  printPass(options.requireComponents ? 'frontend UI component library structure is valid' : 'frontend utility library structure is valid', {
    libraryRoot,
    entry: publicEntry,
    srcEntry,
  })
}

function assertModule(root) {
  const moduleRoot = path.resolve(process.cwd(), root)
  const srcPath = path.join(moduleRoot, 'src')
  const implementationEntry = assertSingleExistingFile(moduleRoot, MODULE_IMPLEMENTATION_FILENAMES, '单个模块根目录实现入口')
  const publicEntries = findExistingFiles(moduleRoot, PUBLIC_ENTRY_FILENAMES)

  if (fs.existsSync(srcPath))
    throw new Error('单个模块不得再嵌套 src/ 目录')

  if (publicEntries.length > 0)
    throw new Error(`单个模块根目录不得创建公共入口：${publicEntries.join('、')}`)

  assertCodeDirectoryEntries(moduleRoot, moduleRoot, { implementationEntries: MODULE_IMPLEMENTATION_FILENAMES })

  printPass('frontend module structure is valid', {
    moduleRoot,
    implementationEntry,
  })
}

function assertSimpleComponent(root) {
  const componentPath = path.resolve(process.cwd(), root)
  const filename = path.basename(componentPath)
  const componentDirectory = path.dirname(componentPath)
  const componentName = path.basename(filename, path.extname(filename))

  if (!/^[A-Z][\w-]*\.(vue|tsx|jsx)$/.test(filename))
    throw new Error('简单组件必须使用 ComponentName.vue、ComponentName.tsx 或 ComponentName.jsx 文件')

  if (!fs.existsSync(componentPath) || !fs.statSync(componentPath).isFile())
    throw new Error('简单组件路径必须指向真实文件')

  for (const entry of fs.readdirSync(componentDirectory, { withFileTypes: true })) {
    if (entry.name === filename)
      continue

    if (entry.isDirectory()) {
      if (!['__tests__', '__demos__', '__stories__'].includes(entry.name) && entry.name === componentName)
        throw new Error('简单组件出现同名目录，必须升级为 component-package 结构')

      continue
    }

    const siblingExt = path.extname(entry.name)
    const siblingBase = path.basename(entry.name, siblingExt)
    const isSameNameStyle = siblingBase === componentName && STYLE_ENTRY_FILENAMES.includes(`index${siblingExt}`)
    const isAnotherSimpleComponent = /^[A-Z][\w-]*\.(vue|tsx|jsx)$/.test(entry.name)
    const isDedicatedCodeFile = /\.(ts|js|vue|tsx|jsx)$/.test(entry.name)

    if (!isSameNameStyle && !isAnotherSimpleComponent && isDedicatedCodeFile)
      throw new Error(`简单组件同级存在专属附属文件：${entry.name}，必须升级为 component-package`)
  }

  printPass('frontend simple component structure is valid', {
    componentPath,
  })
}

function printHelp() {
  console.log(`用法: node verify-rules.mjs [command] [options]

命令:
  self                        校验本 skill 的规则完整性（默认）
  simple-component, simple    校验简单组件结构
  component, package          校验复杂组件包结构
  module                      校验业务模块结构
  utility, tool-library       校验工具库结构
  ui-library, component-library  校验 UI 组件库结构
  hoist                       校验公共代码抽离位置是否符合复用与提升边界
  --help                      显示帮助信息

选项:
  --root <path>               指定组件、模块或库根目录
  --target <path>             指定抽离目标目录
  --uses <path1> <path2> ...  指定至少 2 个使用点路径
`)
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')

  assertContains(skill, /frontend-code-standard/, 'SKILL.md 必须声明 skill 名称')
  assertContains(skill, /Vue 3 \/ React TypeScript\/JavaScript/, 'SKILL.md 必须覆盖前端技术范围')
  assertContains(skill, /组件、业务模块、前端工具包和 UI 组件库/, 'SKILL.md 必须覆盖前端范围')
  assertContains(skill, /实现质量、目录边界、公共导出、import 路径、类型契约和交付检查/, 'SKILL.md 必须说明规则覆盖范围')
  assertContains(skill, /不是只管目录拆分的窄规则/, 'SKILL.md 必须说明不是窄目录规则')
  assertContains(skill, /simple-component/, 'SKILL.md 必须覆盖 simple-component')
  assertContains(skill, /component-package/, 'SKILL.md 必须覆盖 component-package')
  assertContains(skill, /business-module/, 'SKILL.md 必须覆盖 business-module')
  assertContains(skill, /ordinary-module/, 'SKILL.md 必须覆盖 ordinary-module')
  assertContains(skill, /utility-library/, 'SKILL.md 必须覆盖 utility-library')
  assertContains(skill, /ui-library/, 'SKILL.md 必须覆盖 ui-library')
  assertContains(skill, /物理边界约束/, 'SKILL.md 必须覆盖简单组件物理边界')
  assertContains(skill, /升级阈值/, 'SKILL.md 必须覆盖简单组件升级阈值')
  assertContains(skill, /契约优先/, 'SKILL.md 必须覆盖契约优先')
  assertContains(skill, /文件与目录命名约束/, 'SKILL.md 必须覆盖命名约束')
  assertContains(skill, /UI 与逻辑解耦/, 'SKILL.md 必须覆盖 UI 与逻辑解耦')
  assertContains(skill, /配置与元数据隔离/, 'SKILL.md 必须覆盖配置与元数据隔离')
  assertContains(skill, /就近内聚/, 'SKILL.md 必须覆盖就近内聚')
  assertContains(skill, /状态就近/, 'SKILL.md 必须覆盖状态就近')
  assertContains(skill, /逻辑贴近使用点/, 'SKILL.md 必须覆盖逻辑贴近使用点')
  assertContains(skill, /聚合导出/, 'SKILL.md 必须覆盖聚合导出')
  assertContains(skill, /内部引用隔离/, 'SKILL.md 必须覆盖内部引用隔离')
  assertContains(skill, /失败显性与异常语义化/, 'SKILL.md 必须覆盖失败显性与异常语义化')
  assertContains(skill, /类型扩展性与显式返回/, 'SKILL.md 必须覆盖类型扩展性与显式返回')
  assertContains(skill, /抽象要付账/, 'SKILL.md 必须覆盖抽象要付账')
  assertContains(skill, /注释解释意图/, 'SKILL.md 必须覆盖注释解释意图')
  assertContains(skill, /## 评审输出/, 'SKILL.md 必须覆盖评审输出')
  assertContains(skill, /## 检查清单/, 'SKILL.md 必须覆盖检查清单')
  assertContains(skill, /## 示例/, 'SKILL.md 必须覆盖示例')
  assertContains(skill, /简单组件（simple-component）/, 'SKILL.md 必须覆盖简单组件示例')
  assertContains(skill, /复杂组件包（component-package）/, 'SKILL.md 必须覆盖复杂组件包示例')
  assertContains(skill, /工具包（utility-library）/, 'SKILL.md 必须覆盖工具包示例')
  assertContains(skill, /UI 组件库（ui-library）/, 'SKILL.md 必须覆盖 UI 组件库示例')
  assertContains(skill, /页面模块/, 'SKILL.md 必须覆盖页面模块示例')
  assertContains(skill, /类型组织与导入隔离/, 'SKILL.md 必须覆盖类型组织与导入隔离示例')
  assertContains(skill, /scripts\/verify-rules\.mjs/, 'SKILL.md 必须声明本 skill 自带的验证脚本')
  assertContains(skill, /未执行标记 `NOT RUN`/, 'SKILL.md 必须覆盖 NOT RUN')
  assertContains(skill, /简单组件的类型优先贴近使用点/, 'SKILL.md 必须覆盖类型贴近使用点')
  assertContains(skill, /复杂组件可按职责拆分/, 'SKILL.md 必须覆盖复杂组件类型拆分')
  assertContains(skill, /强制使用 `export type` 或 `export type \*`/, 'SKILL.md 必须覆盖 type-only re-export')
  assertContains(skill, /路径别名优先/, 'SKILL.md 必须覆盖路径别名')
  assertContains(skill, /禁止 deep import/, 'SKILL.md 必须覆盖 deep import')
  assertContains(skill, /前端目录遵循单一入口、按需拆分/, 'SKILL.md 必须覆盖单一入口')
  assertContains(skill, /普通模块根目录不得额外创建 `index\.ts` \/ `index\.js`/, 'SKILL.md 必须覆盖普通模块根目录限制')
  assertContains(skill, /只有 `component-package`、`utility-library` 和 `ui-library` 允许通过根 `index\.ts` \/ `index\.js` 暴露包级公共 API/, 'SKILL.md 必须覆盖公共入口限制')
  assertContains(skill, /`styles\/` 只使用一个 `index\.css`、`index\.scss` 或 `index\.less`/, 'SKILL.md 必须覆盖样式入口限制')
  assertContains(skill, /Tree-shaking 契约/, 'SKILL.md 必须覆盖 Tree-shaking 契约')
  assertContains(skill, /peerDependencies/, 'SKILL.md 必须覆盖依赖声明隔离')

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

  if (command === '--help' || command === '-h')
    return printHelp()

  if (command === 'self')
    return verifySelf()

  if (command === 'simple-component' || command === 'simple')
    return assertSimpleComponent(getOption(args, '--root'))

  if (command === 'component' || command === 'package' || command === 'project')
    return assertComponentPackage(getOption(args, '--root'))

  if (command === 'module')
    return assertModule(getOption(args, '--root'))

  if (command === 'utility' || command === 'tool-library')
    return assertLibraryPackage(getOption(args, '--root'))

  if (command === 'ui-library' || command === 'component-library')
    return assertLibraryPackage(getOption(args, '--root'), { requireComponents: true })

  if (command === 'hoist')
    return verifyHoist(args)

  throw new Error(`未知命令：${command}，使用 --help 查看帮助`)
}

try {
  main()
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
