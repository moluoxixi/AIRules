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
const IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'generated',
  '.nuxt',
  '.output',
  '.next',
  '.turbo',
  '__test__',
  '__mocks__',
  '__fixtures__',
  '__snapshots__',
  '__demos__',
  '__stories__',
  '__e2e__',
  'assets',
  'images',
  'icons',
  'fonts',
  'styles',
  'public',
]

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

function getListAfter(args, name, options = {}) {
  const index = args.indexOf(name)

  if (index === -1)
    throw new Error(`缺少参数 ${name}`)

  const values = args.slice(index + 1).filter(value => !value.startsWith('--'))

  if (values.length === 2 && options.allowStableTwoUse)
    return values

  if (values.length < 3)
    throw new Error(`${name} 至少需要 3 个明确使用点；仅 2 个使用点时必须显式传入 --stable-two-use，表示这是复杂且稳定的拆分例外`)

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
    throw new Error('无法计算共享边界，请确认使用点路径属于同一文件系统根')

  return commonParts.join(path.sep)
}

function assertTargetInsideAncestor(target, ancestor, uses) {
  const resolvedTarget = path.resolve(process.cwd(), target)
  const relative = path.relative(ancestor, resolvedTarget)

  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(`抽离目标必须位于共享边界内：${ancestor}`)

  if (relative === '')
    return

  const directSegments = relative.split(path.sep).filter(Boolean)

  if (uses.some((usePath) => {
    const useRelative = path.relative(ancestor, normalizeDirectory(usePath))
    const [firstSegment] = useRelative.split(path.sep).filter(Boolean)

    return firstSegment === directSegments[0]
  })) {
    throw new Error(`抽离目标必须位于允许的共享边界目录：${ancestor}`)
  }

  if (directSegments.length === 1)
    return

  throw new Error(`抽离目标必须位于允许的共享边界目录：${ancestor}`)
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

    if (!isImplementationSrc) {
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
      if (!['__test__', '__demos__', '__stories__'].includes(entry.name))
        throw new Error(`简单组件同级只允许 __test__、__demos__、__stories__ 目录；发现：${entry.name}`)

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
  hoist                       校验公共代码抽离位置是否落在允许的共享边界内
  --help                      显示帮助信息

选项:
  --root <path>               指定组件、模块或库根目录
  --target <path>             指定抽离目标目录
  --uses <path1> <path2> ...  指定至少 3 个使用点路径
  --stable-two-use            仅 2 个使用点时，声明这是复杂且稳定的拆分例外
`)
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')

  assertContains(skill, /frontend-code-standard/, 'SKILL.md 必须声明 skill 名称')
  assertContains(skill, /Vue\/React 前端组件/, 'SKILL.md 必须覆盖前端技术范围')
  assertContains(skill, /前端组件、业务模块、工具库和 UI 组件库/, 'SKILL.md 必须覆盖前端范围')
  assertContains(skill, /门面出口、类型契约、测试边界和 Deep Import 禁止标准/, 'SKILL.md 必须说明规则覆盖范围')
  assertContains(skill, /严苛且务实的资深前端架构师/, 'SKILL.md 必须覆盖角色设定')
  assertContains(skill, /主动防御架构腐化/, 'SKILL.md 必须覆盖架构防腐职责')
  assertContains(skill, /simple-component/, 'SKILL.md 必须覆盖 simple-component')
  assertContains(skill, /component-package/, 'SKILL.md 必须覆盖 component-package')
  assertContains(skill, /business-module/, 'SKILL.md 必须覆盖 business-module')
  if (/ordinary-module/.test(skill))
    throw new Error('SKILL.md 不得包含 ordinary-module')
  assertContains(skill, /utility-library/, 'SKILL.md 必须覆盖 utility-library')
  assertContains(skill, /ui-library/, 'SKILL.md 必须覆盖 ui-library')
  assertContains(skill, /物理职责边界与防腐/, 'SKILL.md 必须覆盖物理职责边界')
  assertContains(skill, /拆解巨石文件/, 'SKILL.md 必须覆盖巨石文件拆解')
  assertContains(skill, /抽离出的工具函数必须被严格放置在专属的 `utils\/` 文件夹/, 'SKILL.md 必须覆盖 utils 纯函数归位')
  assertContains(skill, /允许在组件内部保留仅服务于当前渲染的极小型局部 inline helper/, 'SKILL.md 必须覆盖 inline helper 例外')
  assertContains(skill, /Teardown\/Reset Mechanisms/, 'SKILL.md 必须覆盖状态清理契约')
  assertContains(skill, /代码职责目录必须提供 `index\.ts`/, 'SKILL.md 必须覆盖默认目录门面')
  assertContains(skill, /门面例外/, 'SKILL.md 必须覆盖门面例外')
  assertContains(skill, /Deep Import 路径穿透/, 'SKILL.md 必须覆盖 Deep Import 禁止规则')
  assertContains(skill, /严禁无脑 `export \*`/, 'SKILL.md 必须覆盖显式导出契约')
  assertContains(skill, /export type \*/, 'SKILL.md 必须覆盖 type-only re-export')
  assertContains(skill, /快速失败/, 'SKILL.md 必须覆盖快速失败')
  assertContains(skill, /正常的 UI 状态分支、可选渲染和加载态不属于错误绕行/, 'SKILL.md 必须覆盖 UI 状态分支例外')
  assertContains(skill, /公共 API（导出函数、Hooks、Composables、类的公共方法）必须显式声明返回类型/, 'SKILL.md 必须覆盖公共 API 返回类型')
  assertContains(skill, /目标代码必须严格匹配以下五个标签之一/, 'SKILL.md 必须覆盖目标分类要求')
  assertContains(skill, /若内部演化出专属的 `utils\/`、`types\/`、`hooks\/`、`composables\/` 或 `components\/` 等职责目录，必须升级为 `component-package`/, 'SKILL.md 必须覆盖简单组件升级条件')
  assertContains(skill, /根 `index\.ts`（包的唯一公共出口）/, 'SKILL.md 必须覆盖组件包公共出口')
  assertContains(skill, /不包含 `src\/` 容器/, 'SKILL.md 必须覆盖业务模块结构边界')
  assertContains(skill, /`README\.md`、根 `index\.ts`、`src\/` 和 `package\.json`/, 'SKILL.md 必须覆盖库结构入口')
  assertContains(skill, /sideEffects/, 'SKILL.md 必须覆盖 Tree-shaking 契约')
  assertContains(skill, /peerDependencies/, 'SKILL.md 必须覆盖依赖声明隔离')
  assertContains(skill, /测试与质量边界/, 'SKILL.md 必须覆盖测试质量边界')
  assertContains(skill, /单元\/非浏览器集成测试/, 'SKILL.md 必须覆盖单元与非浏览器集成测试边界')
  assertContains(skill, /Vitest/, 'SKILL.md 必须覆盖 Vitest 测试栈')
  assertContains(skill, /jsdom\/happy-dom/, 'SKILL.md 必须覆盖基础渲染契约环境')
  assertContains(skill, /props、事件回调、组件状态/, 'SKILL.md 必须覆盖通用组件挂载测试契约')
  assertContains(skill, /统一放置在目标目录就近的 `__test__\/`/, 'SKILL.md 必须覆盖 __test__ 单元测试目录')
  assertContains(skill, /@playwright\/test/, 'SKILL.md 必须覆盖 Playwright 交互测试')
  assertContains(skill, /Snapshot 或 DOM Mock 替代/, 'SKILL.md 必须禁止伪造交互覆盖')
  assertContains(skill, /项目根级的 `__e2e__\/` 目录/, 'SKILL.md 必须覆盖全局 E2E 目录')
  assertContains(skill, /缺少 Vitest 或 `@playwright\/test`/, 'SKILL.md 必须覆盖测试依赖缺失阻断')
  assertContains(skill, /工作流与交付契约/, 'SKILL.md 必须覆盖工作流与交付契约')
  assertContains(skill, /按任务风险执行项目已有的 `lint`、`typecheck`、`test`、`build` 或浏览器验证/, 'SKILL.md 必须覆盖验证命令范围')
  assertContains(skill, /FAIL > MISSING > NOT RUN > PASS/, 'SKILL.md 必须覆盖最终状态优先级')
  assertContains(skill, /Playwright、验证脚本入口/, 'SKILL.md 必须覆盖验证入口缺失状态')

  printPass('frontend-code-standard self rules are valid')
}

function verifyHoist(args) {
  const target = getOption(args, '--target')
  const uses = getListAfter(args, '--uses', {
    allowStableTwoUse: args.includes('--stable-two-use'),
  })
  const ancestor = nearestCommonAncestor(uses)

  assertTargetInsideAncestor(target, ancestor, uses)

  printPass('frontend hoist target stays within shared boundary', {
    sharedBoundary: ancestor,
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
