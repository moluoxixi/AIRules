#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_ENTRY_FILENAMES = ['index.ts']
const STYLE_ENTRY_FILENAMES = ['index.css', 'index.scss', 'index.less']
const COMPONENT_IMPLEMENTATION_FILENAMES = ['index.vue', 'index.tsx']
const MODULE_IMPLEMENTATION_FILENAMES = ['index.vue', 'index.tsx']
const HOST_FRAMEWORK_DEPENDENCIES = ['vue', 'react', 'react-dom']
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

function assertExplicitValueExports(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf8')
  const wildcardExportLine = content
    .split('\n')
    .map(line => line.trimStart())
    .find(line => line.startsWith('export *'))

  if (wildcardExportLine)
    throw new Error(`${label} 严禁使用 value wildcard export，请改为显式命名导出或 export type *`)
}

function assertEntryContract(directory, entryFilename, label) {
  assertExplicitValueExports(path.join(directory, entryFilename), label)
}

// 组件包的类型门面属于公共 API 契约，必须由根入口显式暴露。
function assertComponentTypeFacade(componentRoot, srcPath) {
  const typesPath = path.join(srcPath, 'types')

  if (!fs.existsSync(typesPath) || !fs.statSync(typesPath).isDirectory())
    throw new Error('组件包缺少 src/types/ 类型契约目录')

  const typeEntry = assertSingleExistingFile(typesPath, PUBLIC_ENTRY_FILENAMES, '组件包 src/types 类型门面')
  const rootEntryContent = fs.readFileSync(path.join(componentRoot, 'index.ts'), 'utf8')

  assertEntryContract(typesPath, typeEntry, '组件包 src/types 类型门面')

  if (!rootEntryContent.includes('export type') || !rootEntryContent.includes('./src/types'))
    throw new Error('组件包根目录 index.ts 必须通过 export type * from \'./src/types\' 暴露类型契约')

  return typeEntry
}

function readPackageJson(directory, label) {
  const packagePath = path.join(directory, 'package.json')

  if (!fs.existsSync(packagePath))
    throw new Error(`${label} 缺少 package.json`)

  return JSON.parse(fs.readFileSync(packagePath, 'utf8'))
}

function assertHostFrameworkDepsInPeerDependencies(packageJson, label) {
  const dependencies = packageJson.dependencies ?? {}

  for (const dependencyName of HOST_FRAMEWORK_DEPENDENCIES) {
    if (Object.hasOwn(dependencies, dependencyName))
      throw new Error(`${label} 宿主框架依赖 ${dependencyName} 必须放在 peerDependencies 中`)
  }
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
      const childEntry = assertSingleExistingFile(childDirectory, PUBLIC_ENTRY_FILENAMES, `目录 ${relative}/ 聚合入口`)
      assertEntryContract(childDirectory, childEntry, `目录 ${relative}/ 聚合入口`)
    }

    if (childPublicEntries.length > 0 || isImplementationSrc || options.descendIntoMissingEntryDirectory)
      assertCodeDirectoryEntries(childDirectory, root, options, depth + 1)
  }
}

function assertComponentPackage(root, options = {}) {
  const componentRoot = path.resolve(process.cwd(), root)
  const readmePath = path.join(componentRoot, 'README.md')
  const srcPath = path.join(componentRoot, 'src')
  const publicEntry = assertSingleExistingFile(componentRoot, PUBLIC_ENTRY_FILENAMES, '复杂组件包根目录公共入口')
  const rootImplementationEntries = findExistingFiles(componentRoot, COMPONENT_IMPLEMENTATION_FILENAMES)
  const requiresReadme = !options.privatePackage

  assertEntryContract(componentRoot, publicEntry, '复杂组件包根目录公共入口')

  if (requiresReadme && !fs.existsSync(readmePath))
    throw new Error('独立公共组件包根目录缺少 README.md')

  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory())
    throw new Error('复杂组件包根目录缺少 src/ 实现目录')

  if (rootImplementationEntries.length > 0)
    throw new Error(`复杂组件包根目录不得放置实现入口：${rootImplementationEntries.join('、')}`)

  const srcImplementationEntry = assertSingleExistingFile(srcPath, COMPONENT_IMPLEMENTATION_FILENAMES, '复杂组件包 src/ 实现入口')
  const typeEntry = assertComponentTypeFacade(componentRoot, srcPath)

  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8').trim()

    if (readme.length === 0)
      throw new Error('复杂组件 README.md 不得为空，必须描述组件如何使用')

    if (!/(使用|用法|Usage|Props|Events|Emits|Expose|Slots|API|Ref|Children)/.test(readme))
      throw new Error('复杂组件 README.md 必须包含使用方式或接口契约说明')
  }

  assertCodeDirectoryEntries(componentRoot, componentRoot, { implementationEntries: COMPONENT_IMPLEMENTATION_FILENAMES })

  printPass(options.privatePackage ? 'frontend private complex component package structure is valid' : 'frontend complex component package structure is valid', {
    componentRoot,
    entry: publicEntry,
    implementationEntry: srcImplementationEntry,
    typeEntry,
  })
}

function assertLibraryPackage(root, options = {}) {
  const libraryRoot = path.resolve(process.cwd(), root)
  const readmePath = path.join(libraryRoot, 'README.md')
  const srcPath = path.join(libraryRoot, 'src')
  const publicEntry = assertSingleExistingFile(libraryRoot, PUBLIC_ENTRY_FILENAMES, '库根目录公共入口')
  const rootImplementationEntries = findExistingFiles(libraryRoot, COMPONENT_IMPLEMENTATION_FILENAMES)
  const packageJson = readPackageJson(libraryRoot, '库根目录')

  if (!fs.existsSync(readmePath))
    throw new Error('库根目录缺少 README.md')

  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isDirectory())
    throw new Error('库根目录缺少 src/ 实现目录')

  if (rootImplementationEntries.length > 0)
    throw new Error(`库根目录不得放置组件实现入口：${rootImplementationEntries.join('、')}`)

  const srcEntry = assertSingleExistingFile(srcPath, PUBLIC_ENTRY_FILENAMES, '库 src/ 聚合入口')

  assertEntryContract(libraryRoot, publicEntry, '库根目录公共入口')
  assertEntryContract(srcPath, srcEntry, '库 src/ 聚合入口')
  assertHostFrameworkDepsInPeerDependencies(packageJson, '库 package.json')

  if (options.requireComponents) {
    if (!Object.hasOwn(packageJson, 'sideEffects'))
      throw new Error('UI 组件库 package.json 必须明确声明 sideEffects 范围')
  }
  else if (packageJson.sideEffects !== false) {
    throw new Error('工具库 package.json 必须声明 "sideEffects": false')
  }

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

// 私有叶子例外只校验文件边界；源码级 API 识别应交给成熟 SFC/AST 工具。
function assertPrivateLeafComponent(root) {
  const componentPath = path.resolve(process.cwd(), root)
  const filename = path.basename(componentPath)
  const componentDirectory = path.dirname(componentPath)
  const componentName = path.basename(filename, path.extname(filename))

  if (!/^[A-Z][\w-]*\.(vue|tsx)$/.test(filename))
    throw new Error('私有叶子组件例外必须使用 ComponentName.vue 或 ComponentName.tsx 文件')

  if (!fs.existsSync(componentPath) || !fs.statSync(componentPath).isFile())
    throw new Error('私有叶子组件例外路径必须指向真实文件')

  for (const entry of fs.readdirSync(componentDirectory, { withFileTypes: true })) {
    if (entry.name === filename)
      continue

    if (entry.isDirectory()) {
      if (!['__test__', '__demos__', '__stories__'].includes(entry.name))
        throw new Error(`私有叶子组件例外同级只允许 __test__、__demos__、__stories__ 目录；发现：${entry.name}，必须升级为 component-package`)

      continue
    }

    const siblingExt = path.extname(entry.name)
    const siblingBase = path.basename(entry.name, siblingExt)
    const isSameNameStyle = siblingBase === componentName && STYLE_ENTRY_FILENAMES.includes(`index${siblingExt}`)
    const isAnotherSimpleComponent = /^[A-Z][\w-]*\.(vue|tsx)$/.test(entry.name)
    const isDedicatedCodeFile = /\.(ts|js|vue|tsx|jsx)$/.test(entry.name)

    if (!isSameNameStyle && !isAnotherSimpleComponent && isDedicatedCodeFile)
      throw new Error(`私有叶子组件例外同级存在专属附属文件：${entry.name}，必须升级为 component-package`)
  }

  printPass('frontend private leaf component exception is valid', {
    componentPath,
  })
}

function printHelp() {
  console.log(`用法: node verify-rules.mjs [command] [options]

命令:
  self                        校验本 skill 的规则完整性（默认）
  leaf, private-leaf          校验私有叶子组件例外
  component, package          校验复杂组件包结构
  module                      校验业务模块结构
  utility, tool-library       校验工具库结构
  ui-library, component-library  校验 UI 组件库结构
  hoist                       校验公共代码抽离位置是否落在允许的共享边界内
  --help                      显示帮助信息

选项:
  --root <path>               指定组件、模块或库根目录
  --private                   将复杂组件包按模块或组件内部私有子组件校验，README.md 不强制
  --target <path>             指定抽离目标目录
  --uses <path1> <path2> ...  指定至少 3 个使用点路径
  --stable-two-use            仅 2 个使用点时，声明这是复杂且稳定的拆分例外
`)
}

function verifySelf() {
  const skill = readSkillFile('SKILL.md')
  const componentExample = readSkillFile('examples', 'component-classification.md')

  assertContains(skill, /frontend-code-standard/, 'SKILL.md 必须声明 skill 名称')
  assertContains(skill, /Vue\/React 前端组件/, 'SKILL.md 必须覆盖前端技术范围')
  assertContains(skill, /前端组件、业务模块、工具库和 UI 组件库/, 'SKILL.md 必须覆盖前端范围')
  assertContains(skill, /门面出口、类型契约、测试边界和 Deep Import 禁止标准/, 'SKILL.md 必须说明规则覆盖范围')
  assertContains(skill, /严苛且务实的资深前端架构师/, 'SKILL.md 必须覆盖角色设定')
  assertContains(skill, /主动防御架构腐化/, 'SKILL.md 必须覆盖架构防腐职责')
  assertContains(skill, /component-package/, 'SKILL.md 必须覆盖 component-package')
  assertContains(skill, /business-module/, 'SKILL.md 必须覆盖 business-module')
  if (/ordinary-module/.test(skill))
    throw new Error('SKILL.md 不得包含 ordinary-module')
  assertContains(skill, /utility-library/, 'SKILL.md 必须覆盖 utility-library')
  assertContains(skill, /ui-library/, 'SKILL.md 必须覆盖 ui-library')
  assertContains(skill, /以下四个正式标签之一/, 'SKILL.md 必须声明四个正式分类')
  assertContains(skill, /私有叶子例外/, 'SKILL.md 必须覆盖私有叶子组件例外')
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
  assertContains(skill, /目标目录必须严格匹配以下四个正式标签之一/, 'SKILL.md 必须覆盖目标分类要求')
  assertContains(skill, /该例外不是正式分类/, 'SKILL.md 必须声明私有叶子例外不是正式分类')
  assertContains(skill, /一旦出现 `types\/`、`constants\/`、`utils\/`、`hooks\/`、`composables\/`、`components\/` 等职责目录，必须立即升级为 `component-package`/, 'SKILL.md 必须覆盖私有叶子例外升级条件')
  assertContains(skill, /根目录必须提供 `index\.ts` 作为唯一公共出口/, 'SKILL.md 必须覆盖组件包公共出口')
  assertContains(skill, /独立公共组件包还必须提供 `README\.md`；模块或组件内部的私有组件包不强制提供 `README\.md`/, 'SKILL.md 必须覆盖组件包 README 例外')
  assertContains(skill, /内部所有实现必须收敛于 `src\/` 目录中/, 'SKILL.md 必须覆盖组件包 src 实现目录')
  assertContains(skill, /组件包必须提供 `src\/types\/index\.ts` 作为类型契约入口/, 'SKILL.md 必须覆盖组件包类型入口')
  assertContains(skill, /export type \* from '\.\/src\/types'/, 'SKILL.md 必须覆盖根类型门面导出')
  assertContains(skill, /`src\/types\/index\.ts` 统一导出/, 'SKILL.md 必须覆盖类型门面')
  assertContains(skill, /Vue 契约归位/, 'SKILL.md 必须覆盖 Vue 组件 API 契约')
  assertContains(skill, /React 契约归位/, 'SKILL.md 必须覆盖 React 组件 API 契约')
  assertContains(skill, /defineProps/, 'SKILL.md 必须覆盖 Vue props 契约')
  assertContains(skill, /defineEmits/, 'SKILL.md 必须覆盖 Vue emits 契约')
  assertContains(skill, /defineExpose/, 'SKILL.md 必须覆盖 Vue expose 契约')
  assertContains(skill, /受控与非受控值/, 'SKILL.md 必须覆盖 React 受控契约')
  assertContains(skill, /examples\/component-classification\.md/, 'SKILL.md 必须引用组件分类正反例')
  assertContains(skill, /必须以 `index\.vue` \/ `index\.tsx` 作为根级主视图，严禁使用 `src\/` 容器/, 'SKILL.md 必须覆盖业务模块结构边界')
  assertContains(skill, /所有代码职责目录必须包含 `index\.ts` 门面/, 'SKILL.md 必须覆盖业务模块职责目录门面')
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
  assertContains(skill, /默认以 `headed` 模式执行/, 'SKILL.md 必须覆盖 Playwright headed 默认执行')
  assertContains(skill, /显式切换到 `headless` 的能力/, 'SKILL.md 必须保留 Playwright headless 切换能力')
  assertContains(skill, /交互测试必须包含能证明目标状态成立的断言/, 'SKILL.md 必须覆盖交互测试断言要求')
  assertContains(skill, /文本、属性、可见性、URL、表单值、请求结果或存储状态/, 'SKILL.md 必须覆盖用户可感知断言目标')
  assertContains(skill, /项目根级的 `__e2e__\/` 目录/, 'SKILL.md 必须覆盖全局 E2E 目录')
  assertContains(skill, /缺少 Vitest 或 `@playwright\/test`/, 'SKILL.md 必须覆盖测试依赖缺失阻断')
  assertContains(skill, /工作流与交付契约/, 'SKILL.md 必须覆盖工作流与交付契约')
  assertContains(skill, /按任务风险执行项目已有的 `lint`、`typecheck`、`test`、`build` 或浏览器验证/, 'SKILL.md 必须覆盖验证命令范围')
  assertContains(skill, /FAIL > MISSING > NOT RUN > PASS/, 'SKILL.md 必须覆盖最终状态优先级')
  assertContains(skill, /Playwright、验证脚本入口/, 'SKILL.md 必须覆盖验证入口缺失状态')
  assertContains(componentExample, /正例：私有叶子例外/, '组件分类示例必须包含私有叶子正例')
  assertContains(componentExample, /正例：组件包/, '组件分类示例必须包含组件包正例')
  assertContains(componentExample, /反例：单文件承载稳定契约/, '组件分类示例必须包含单文件契约反例')
  assertContains(componentExample, /反例：有类型文件但没有组件包门面/, '组件分类示例必须包含类型目录反例')
  assertContains(componentExample, /反例：跨模块复用但深藏在业务目录/, '组件分类示例必须包含跨模块复用反例')

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

  if (command === 'leaf' || command === 'private-leaf')
    return assertPrivateLeafComponent(getOption(args, '--root'))

  if (command === 'component' || command === 'package' || command === 'project')
    return assertComponentPackage(getOption(args, '--root'), { privatePackage: args.includes('--private') })

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
