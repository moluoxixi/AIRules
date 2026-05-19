import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

/**
 * 读取项目内文本文件，测试策略类规则是否被分发入口和 workflow skill 同时覆盖。
 */
function readProjectFile(...parts: string[]) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

function runNodeScript(...parts: string[]) {
  return execFileSync(process.execPath, [path.join(rootDir, ...parts)], {
    cwd: rootDir,
    encoding: 'utf8',
  })
}

it('入口策略 - AGENTS 保留公共硬规则并保持简洁入口边界', () => {
  const agents = readProjectFile('AGENTS.md')

  assert.match(agents, /## 核心规则/)
  assert.match(agents, /禁止防御式编程/)
  assert.match(agents, /禁止错误回退/)
  assert.match(agents, /优先使用成熟库/)
  assert.match(agents, /用户本次消息的主要语言/)
  assert.match(agents, /生成的代码必须包含清晰、专业的注释/)
  assert.match(agents, /零成本理解代码的设计意图、API 契约和业务逻辑/)
  assert.match(agents, /质量检查必须按任务场景和风险分级执行/)
  assert.match(agents, /Superpowers、并行子代理、系统化调试、TDD、全量测试、coverage 和构建不得默认触发/)
  assert.match(agents, /检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N\/A`/)
  assert.match(agents, /## 并行子代理/)
  assert.match(agents, /写入范围不重叠、可独立验证的子任务/)
  assert.doesNotMatch(agents, /frontend-code-standard|backend-code-standard|Props 接口|Deep Imports 零容忍|分形架构/)
})

it('工作流策略 - workflow skills 使用中文规范结构', () => {
  const workflowRoot = path.join(rootDir, 'skills', 'workflow')
  const legacySectionPattern = /## (Overview|Load References|Core Rules|Required Testing Dimensions|Related Skills|No Fake Passes)/

  /**
   * 收集 workflow 下所有 Markdown 文件，用于防止入口和 reference 退回英文模板结构。
   */
  function collectMarkdownFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory())
        return collectMarkdownFiles(entryPath)

      return entry.name.endsWith('.md') ? [entryPath] : []
    })
  }

  const markdownFiles = collectMarkdownFiles(workflowRoot)
  const skillFiles = markdownFiles.filter(file => path.basename(file) === 'SKILL.md')

  for (const file of skillFiles) {
    const content = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(content, /description:\s*Use when/)
    assert.match(content, /description:\s*用于/)
    assert.doesNotMatch(content, /description:.*强制执行/)
  }

  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(content, legacySectionPattern, `${file} contains legacy English section heading`)
  }
})

it('前端编码规范 - SKILL.md 是唯一规则源', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')

  assert.match(skill, /Vue 3 或 React TypeScript\/JavaScript/)
  assert.match(skill, /前端应用、前端工具库和 UI 组件库/)
  assert.match(skill, /分形架构/)
  assert.match(skill, /特性驱动/)
  assert.match(skill, /唯一规则源/)
  assert.match(skill, /examples\/directory-structure\.md/)
  assert.match(skill, /validation\/checklist\.md/)
  assert.doesNotMatch(skill, /examples-and-checklist\.md/)
  assert.doesNotMatch(skill, /fractal-frontend-standard\.md/)
  assert.doesNotMatch(skill, /references\//)
  assert.doesNotMatch(skill, /必须完整读取/)
  assert.match(skill, /Headless/)
  assert.match(skill, /禁止扁平化/)
  assert.match(skill, /路径别名优先/)
  assert.match(skill, /Deep Imports 零容忍/)
  assert.match(skill, /逐级上浮/)
  assert.match(skill, /类型推导优先/)
  assert.match(skill, /注释解释 Why over What/)
  assert.match(skill, /Why over What/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /不得用仓库根级共享脚本替代/)
  assert.match(skill, /简单组件结构、复杂组件包结构、前端工具库结构和 UI 组件库结构/)
  assert.match(skill, /入口模型：前端目录统一遵循“单一入口，按需拆分”/)
  assert.match(skill, /业务模块用根 `index\.vue` \/ `\.tsx` \/ `\.jsx`，禁止根 `index\.ts` \/ `\.js` 和 `src\/`/)
  assert.match(skill, /普通代码目录用 `index\.ts` \/ `\.js`/)
  assert.match(skill, /`styles\/` 用 `index\.css` \/ `\.scss` \/ `\.less`/)
  assert.match(skill, /类型边界：复杂组件的 Props、Emits、Expose、Ref/)
  assert.match(skill, /简单组件结构/)
  assert.match(skill, /复杂组件包结构/)
  assert.match(skill, /只有复杂组件包、前端工具库和 UI 组件库允许/)
  assert.doesNotMatch(skill, /react\.md|typescript-javascript\.md|common\.md|vue\.md/)
})

it('前端编码规范 - examples 只提供示例', () => {
  const examples = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'directory-structure.md').replace(/\r\n/g, '\n')

  assert.match(examples, /本文件只提供示例，不定义新规则/)
  assert.doesNotMatch(examples, /最高优先级/)
  assert.doesNotMatch(examples, /核心原则：/)
  assert.doesNotMatch(examples, /校验脚本/)
  assert.doesNotMatch(examples, /检查清单/)
  assert.match(examples, /## 业务模块/)
  assert.ok(examples.includes('views/\n  purchaseOrder/\n    index.vue\n    api/\n      index.ts\n      purchase-order-api.ts'))
  assert.ok(examples.includes('components/\n      index.ts\n      StatusBadge.vue\n      AuditDialog/\n        README.md\n        index.ts\n        src/\n          index.vue'))
  assert.ok(examples.includes('styles/\n      index.scss\n      purchase-order.scss\n    assets/\n      index.ts\n      empty-state.png'))
  assert.match(examples, /Sparkline\.jsx/)
  assert.ok(examples.includes('DataTable/\n  README.md\n  index.ts\n  src/\n    index.vue'))
  assert.ok(examples.includes('BrowserToolkit/\n  README.md\n  index.ts\n  src/\n    index.ts'))
  assert.ok(examples.includes('MoluoxixiUI/\n  README.md\n  index.ts\n  src/\n    index.ts\n    components/\n      index.ts'))
  assert.ok(!examples.includes('views/ or pages/ or modules/'))
  assert.ok(!examples.includes('columnSettings'))
})

it('前端编码规范 - skill 自带验证脚本覆盖组件结构和最近公共父级', () => {
  const scriptPath = path.join(rootDir, 'skills', 'workflow', 'frontend-code-standard', 'scripts', 'verify-rules.mjs')
  const componentRootTs = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-ts-'))
  const componentRootJs = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-js-'))
  const componentRootDuplicate = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-dupe-'))
  const componentRootWithRootImplementation = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-root-entry-'))
  const utilityLibraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-utility-library-'))
  const uiLibraryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-ui-library-'))
  const libraryRootMissingSrcEntry = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-library-missing-src-entry-'))
  const uiLibraryRootMissingComponents = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-ui-library-missing-components-'))
  const moduleRootTs = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-ts-'))
  const moduleRootJs = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-js-'))
  const moduleRootWithSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-src-'))
  const moduleRootWithPublicEntry = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-public-entry-'))
  const moduleRootMissingAggregateEntry = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-missing-aggregate-entry-'))
  const moduleRootNestedMissingAggregateEntry = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-nested-missing-aggregate-entry-'))
  const moduleRootWithWrongStyleEntry = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-wrong-style-entry-'))
  const moduleRootWithDuplicateStyleEntry = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-module-duplicate-style-entry-'))
  const simpleComponentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-simple-component-'))

  fs.writeFileSync(path.join(componentRootTs, 'README.md'), '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  fs.writeFileSync(path.join(componentRootTs, 'index.ts'), 'export * from \'./src\'\n')
  fs.mkdirSync(path.join(componentRootTs, 'src'))
  fs.writeFileSync(path.join(componentRootTs, 'src', 'index.tsx'), 'export function DataTable() { return null }\n')
  fs.mkdirSync(path.join(componentRootTs, 'src', 'utils'))
  fs.writeFileSync(path.join(componentRootTs, 'src', 'utils', 'index.ts'), 'export * from \'./format-column\'\n')
  fs.writeFileSync(path.join(componentRootTs, 'src', 'utils', 'format-column.ts'), 'export function formatColumn() {}\n')

  fs.writeFileSync(path.join(componentRootJs, 'README.md'), '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  fs.writeFileSync(path.join(componentRootJs, 'index.js'), 'export * from \'./src/index.js\'\n')
  fs.mkdirSync(path.join(componentRootJs, 'src'))
  fs.writeFileSync(path.join(componentRootJs, 'src', 'index.jsx'), 'export function DataTable() { return null }\n')
  fs.mkdirSync(path.join(componentRootJs, 'src', 'styles'))
  fs.writeFileSync(path.join(componentRootJs, 'src', 'styles', 'index.css'), '.data-table {}\n')

  fs.writeFileSync(path.join(componentRootDuplicate, 'README.md'), '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  fs.writeFileSync(path.join(componentRootDuplicate, 'index.ts'), 'export * from \'./src\'\n')
  fs.writeFileSync(path.join(componentRootDuplicate, 'index.js'), 'export * from \'./src/index.js\'\n')
  fs.mkdirSync(path.join(componentRootDuplicate, 'src'))
  fs.writeFileSync(path.join(componentRootDuplicate, 'src', 'index.vue'), '<template />\n')

  fs.writeFileSync(path.join(componentRootWithRootImplementation, 'README.md'), '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  fs.writeFileSync(path.join(componentRootWithRootImplementation, 'index.ts'), 'export * from \'./src\'\n')
  fs.writeFileSync(path.join(componentRootWithRootImplementation, 'index.vue'), '<template />\n')
  fs.mkdirSync(path.join(componentRootWithRootImplementation, 'src'))
  fs.writeFileSync(path.join(componentRootWithRootImplementation, 'src', 'index.vue'), '<template />\n')

  fs.writeFileSync(path.join(utilityLibraryRoot, 'README.md'), '# BrowserToolkit\n\n## Usage\n\nPublic API for browser tools.\n')
  fs.writeFileSync(path.join(utilityLibraryRoot, 'index.ts'), 'export * from \'./src\'\n')
  fs.mkdirSync(path.join(utilityLibraryRoot, 'src'))
  fs.writeFileSync(path.join(utilityLibraryRoot, 'src', 'index.ts'), 'export * from \'./clipboard\'\n')
  fs.mkdirSync(path.join(utilityLibraryRoot, 'src', 'clipboard'))
  fs.writeFileSync(path.join(utilityLibraryRoot, 'src', 'clipboard', 'index.ts'), 'export function copyText() {}\n')
  fs.mkdirSync(path.join(utilityLibraryRoot, 'src', 'clipboard', 'utils'))
  fs.writeFileSync(path.join(utilityLibraryRoot, 'src', 'clipboard', 'utils', 'index.ts'), 'export * from \'./normalize-text\'\n')
  fs.writeFileSync(path.join(utilityLibraryRoot, 'src', 'clipboard', 'utils', 'normalize-text.ts'), 'export function normalizeText() {}\n')

  fs.writeFileSync(path.join(uiLibraryRoot, 'README.md'), '# MoluoxixiUI\n\n## Usage\n\nComponents and API are documented here.\n')
  fs.writeFileSync(path.join(uiLibraryRoot, 'index.ts'), 'export * from \'./src\'\n')
  fs.mkdirSync(path.join(uiLibraryRoot, 'src'))
  fs.writeFileSync(path.join(uiLibraryRoot, 'src', 'index.ts'), 'export * from \'./components/DataTable\'\n')
  fs.mkdirSync(path.join(uiLibraryRoot, 'src', 'components'))
  fs.writeFileSync(path.join(uiLibraryRoot, 'src', 'components', 'index.ts'), 'export * from \'./DataTable\'\n')
  fs.mkdirSync(path.join(uiLibraryRoot, 'src', 'components', 'DataTable'))
  fs.writeFileSync(path.join(uiLibraryRoot, 'src', 'components', 'DataTable', 'README.md'), '# DataTable\n\n## Usage\n\nProps and Slots are documented here.\n')
  fs.writeFileSync(path.join(uiLibraryRoot, 'src', 'components', 'DataTable', 'index.ts'), 'export * from \'./src\'\n')
  fs.mkdirSync(path.join(uiLibraryRoot, 'src', 'components', 'DataTable', 'src'))
  fs.writeFileSync(path.join(uiLibraryRoot, 'src', 'components', 'DataTable', 'src', 'index.vue'), '<template />\n')

  fs.writeFileSync(path.join(libraryRootMissingSrcEntry, 'README.md'), '# BrowserToolkit\n\n## Usage\n\nPublic API for browser tools.\n')
  fs.writeFileSync(path.join(libraryRootMissingSrcEntry, 'index.ts'), 'export * from \'./src\'\n')
  fs.mkdirSync(path.join(libraryRootMissingSrcEntry, 'src'))

  fs.writeFileSync(path.join(uiLibraryRootMissingComponents, 'README.md'), '# MoluoxixiUI\n\n## Usage\n\nComponents are documented here.\n')
  fs.writeFileSync(path.join(uiLibraryRootMissingComponents, 'index.ts'), 'export * from \'./src\'\n')
  fs.mkdirSync(path.join(uiLibraryRootMissingComponents, 'src'))
  fs.writeFileSync(path.join(uiLibraryRootMissingComponents, 'src', 'index.ts'), 'export {}\n')

  fs.writeFileSync(path.join(moduleRootTs, 'index.vue'), '<template />\n')
  fs.mkdirSync(path.join(moduleRootTs, 'api'))
  fs.writeFileSync(path.join(moduleRootTs, 'api', 'index.ts'), 'export * from \'./purchase-order-api\'\n')
  fs.writeFileSync(path.join(moduleRootTs, 'api', 'purchase-order-api.ts'), 'export function getPurchaseOrder() {}\n')
  fs.mkdirSync(path.join(moduleRootTs, 'components'))
  fs.writeFileSync(path.join(moduleRootTs, 'components', 'index.ts'), 'export { default as StatusBadge } from \'./StatusBadge.vue\'\n')
  fs.writeFileSync(path.join(moduleRootTs, 'components', 'StatusBadge.vue'), '<template />\n')
  fs.mkdirSync(path.join(moduleRootTs, 'utils'))
  fs.writeFileSync(path.join(moduleRootTs, 'utils', 'index.ts'), 'export * from \'./format-purchase-order\'\n')
  fs.writeFileSync(path.join(moduleRootTs, 'utils', 'format-purchase-order.ts'), 'export function formatPurchaseOrder() {}\n')
  fs.mkdirSync(path.join(moduleRootTs, 'styles'))
  fs.writeFileSync(path.join(moduleRootTs, 'styles', 'index.scss'), '.purchase-order {}\n')
  fs.writeFileSync(path.join(moduleRootTs, 'styles', 'purchase-order.scss'), '.purchase-order {}\n')

  fs.writeFileSync(path.join(moduleRootJs, 'index.jsx'), 'export function AuditDialog() { return null }\n')

  fs.writeFileSync(path.join(moduleRootWithSrc, 'index.vue'), '<template />\n')
  fs.mkdirSync(path.join(moduleRootWithSrc, 'src'))

  fs.writeFileSync(path.join(moduleRootWithPublicEntry, 'index.ts'), 'export { default } from \'./index.vue\'\n')
  fs.writeFileSync(path.join(moduleRootWithPublicEntry, 'index.vue'), '<template />\n')

  fs.writeFileSync(path.join(moduleRootMissingAggregateEntry, 'index.vue'), '<template />\n')
  fs.mkdirSync(path.join(moduleRootMissingAggregateEntry, 'api'))
  fs.writeFileSync(path.join(moduleRootMissingAggregateEntry, 'api', 'purchase-order-api.ts'), 'export function getPurchaseOrder() {}\n')

  fs.writeFileSync(path.join(moduleRootNestedMissingAggregateEntry, 'index.vue'), '<template />\n')
  fs.mkdirSync(path.join(moduleRootNestedMissingAggregateEntry, 'utils'))
  fs.writeFileSync(path.join(moduleRootNestedMissingAggregateEntry, 'utils', 'index.ts'), 'export * from \'./formatters\'\n')
  fs.mkdirSync(path.join(moduleRootNestedMissingAggregateEntry, 'utils', 'formatters'))
  fs.writeFileSync(path.join(moduleRootNestedMissingAggregateEntry, 'utils', 'formatters', 'date.ts'), 'export function formatDate() {}\n')

  fs.writeFileSync(path.join(moduleRootWithWrongStyleEntry, 'index.vue'), '<template />\n')
  fs.mkdirSync(path.join(moduleRootWithWrongStyleEntry, 'styles'))
  fs.writeFileSync(path.join(moduleRootWithWrongStyleEntry, 'styles', 'index.ts'), 'export const styleEntries = []\n')

  fs.writeFileSync(path.join(moduleRootWithDuplicateStyleEntry, 'index.vue'), '<template />\n')
  fs.mkdirSync(path.join(moduleRootWithDuplicateStyleEntry, 'styles'))
  fs.writeFileSync(path.join(moduleRootWithDuplicateStyleEntry, 'styles', 'index.css'), '.purchase-order {}\n')
  fs.writeFileSync(path.join(moduleRootWithDuplicateStyleEntry, 'styles', 'index.scss'), '.purchase-order {}\n')

  fs.writeFileSync(path.join(simpleComponentRoot, 'StatusBadge.vue'), '<template />\n')

  assert.ok(fs.existsSync(scriptPath))
  assert.ok(!fs.existsSync(path.join(rootDir, 'scripts', 'verify-skill-rules.mjs')))
  assert.match(runNodeScript('skills', 'workflow', 'frontend-code-standard', 'scripts', 'verify-rules.mjs'), /PASS frontend-code-standard self rules are valid/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'component',
      '--root',
      componentRootTs,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend complex component package structure is valid/,
  )
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'component',
      '--root',
      componentRootJs,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend complex component package structure is valid/,
  )
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'module',
      '--root',
      moduleRootTs,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend module structure is valid/,
  )
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'module',
      '--root',
      moduleRootJs,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend module structure is valid/,
  )
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'utility',
      '--root',
      utilityLibraryRoot,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend utility library structure is valid/,
  )
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'ui-library',
      '--root',
      uiLibraryRoot,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend UI component library structure is valid/,
  )
  const duplicateResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    componentRootDuplicate,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(duplicateResult.status, 0)
  assert.match(duplicateResult.stderr, /复杂组件包根目录公共入口 只能存在一个入口：index\.ts、index\.js/)
  const rootImplementationResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    componentRootWithRootImplementation,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(rootImplementationResult.status, 0)
  assert.match(rootImplementationResult.stderr, /复杂组件包根目录不得放置实现入口：index\.vue/)
  const moduleWithSrcResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    moduleRootWithSrc,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(moduleWithSrcResult.status, 0)
  assert.match(moduleWithSrcResult.stderr, /单个模块不得再嵌套 src\/ 目录/)
  const moduleWithPublicEntryResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    moduleRootWithPublicEntry,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(moduleWithPublicEntryResult.status, 0)
  assert.match(moduleWithPublicEntryResult.stderr, /单个模块根目录不得创建公共入口：index\.ts/)
  const moduleMissingAggregateEntryResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    moduleRootMissingAggregateEntry,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(moduleMissingAggregateEntryResult.status, 0)
  assert.match(moduleMissingAggregateEntryResult.stderr, /目录 api\/ 聚合入口 缺少唯一入口：index\.ts、index\.js/)
  const moduleNestedMissingAggregateEntryResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    moduleRootNestedMissingAggregateEntry,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(moduleNestedMissingAggregateEntryResult.status, 0)
  assert.match(moduleNestedMissingAggregateEntryResult.stderr, /目录 utils\/formatters\/ 聚合入口 缺少唯一入口：index\.ts、index\.js/)
  const moduleWithWrongStyleEntryResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    moduleRootWithWrongStyleEntry,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(moduleWithWrongStyleEntryResult.status, 0)
  assert.match(moduleWithWrongStyleEntryResult.stderr, /样式目录 styles\/ 入口 缺少唯一入口：index\.css、index\.scss、index\.less/)
  const moduleWithDuplicateStyleEntryResult = spawnSync(process.execPath, [
    scriptPath,
    'module',
    '--root',
    moduleRootWithDuplicateStyleEntry,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(moduleWithDuplicateStyleEntryResult.status, 0)
  assert.match(moduleWithDuplicateStyleEntryResult.stderr, /样式目录 styles\/ 入口 只能存在一个入口：index\.css、index\.scss、index\.less/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'simple-component',
      '--root',
      path.join(simpleComponentRoot, 'StatusBadge.vue'),
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend simple component structure is valid/,
  )
  const missingSrcEntryResult = spawnSync(process.execPath, [
    scriptPath,
    'utility',
    '--root',
    libraryRootMissingSrcEntry,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(missingSrcEntryResult.status, 0)
  assert.match(missingSrcEntryResult.stderr, /库 src\/ 聚合入口 缺少唯一入口：index\.ts、index\.js/)
  const missingComponentsResult = spawnSync(process.execPath, [
    scriptPath,
    'ui-library',
    '--root',
    uiLibraryRootMissingComponents,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(missingComponentsResult.status, 0)
  assert.match(missingComponentsResult.stderr, /UI 组件库缺少 src\/components\/ 组件目录/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'hoist',
      '--target',
      'src/views/purchaseOrder/utils',
      '--uses',
      'src/views/purchaseOrder/create/index.tsx',
      'src/views/purchaseOrder/update/index.tsx',
      'src/views/purchaseOrder/delete/index.tsx',
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend hoist target stays under nearest common ancestor/,
  )
})

it('前端编码规范 - 类型按 props expose ref emit 拆分', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')
  const examples = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'directory-structure.md')

  assert.match(skill, /类型推导优先/)
  assert.match(skill, /优先从现有组件、Hook、Composable、API 响应、Schema 或常量对象推导/)
  assert.match(skill, /禁止重复手写/)
  assert.match(skill, /类型边界：复杂组件的 Props、Emits、Expose、Ref/)
  assert.match(skill, /props\.ts/)
  assert.match(skill, /ref\.ts/)
  assert.match(skill, /emit\.ts/)
  assert.match(skill, /expose\.ts/)
  assert.match(examples, /export type \* from '\.\/props'/)
  assert.match(examples, /export type \* from '\.\/ref'/)
  assert.ok(examples.includes('DataTable/\n  index.ts\n  src/\n    index.tsx\n    types/\n      props.ts\n      ref.ts\n      index.ts'))
})

it('前端编码规范 - Barrel、路径别名、三次原则和逐级上浮为硬约束', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')
  const examples = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'directory-structure.md')
  const checklist = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'validation', 'checklist.md')

  assert.match(skill, /路径别名优先/)
  assert.match(skill, /Deep Imports 零容忍/)
  assert.match(skill, /只有复杂组件包、前端工具库和 UI 组件库允许通过 `index\.ts` 或 `index\.js` 暴露公共 API/)
  assert.match(skill, /满足三次原则后只能提取到最近公共父级/)
  assert.match(skill, /只有跨顶级业务域复用才允许进入 `src\/` 根级公共目录/)
  assert.match(examples, /@\/components\/DataTable\/utils\/date/)
  assert.match(examples, /@\/components\/DataTable/)
  assert.doesNotMatch(examples, /允许：\n\n```ts\nimport \{ formatDate \} from '@\/components\/DataTable\/utils'/)
  assert.match(checklist, /node skills\/workflow\/frontend-code-standard\/scripts\/verify-rules\.mjs hoist --target/)
  assert.match(checklist, /抽离是否满足三次原则，并落在最近公共父级/)
})

it('前端编码规范 - 注释规范要求 JSDoc、Why over What 和响应式副作用说明', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')
  const checklist = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'validation', 'checklist.md')

  assert.match(skill, /注释解释 Why over What/)
  assert.match(skill, /核心类型契约/)
  assert.match(skill, /默认值/)
  assert.match(skill, /依赖变化原因/)
  assert.match(skill, /闭包边界/)
  assert.match(checklist, /复杂副作用和核心契约是否说明设计意图/)
})

it('前端编码规范 - README 描述同步 Vue 与 React 范围', () => {
  const readme = readProjectFile('README.md')
  const readmeZh = readProjectFile('README-zh.md')

  assert.match(readme, /Vue 3 and React TypeScript\/JavaScript standards for frontend apps, utility libraries, and UI component libraries/)
  assert.match(readme, /path aliases/)
  assert.match(readme, /nearest-common-ancestor hoisting/)
  assert.match(readmeZh, /Vue 3 与 React TypeScript\/JavaScript 前端应用、工具库和 UI 组件库编码标准/)
  assert.match(readmeZh, /路径别名/)
  assert.match(readmeZh, /最近公共父级上浮/)
})

it('后端编码规范 - 入口引用轻量 Node 与 NestJS 规范', () => {
  const skill = readProjectFile('skills', 'workflow', 'backend-code-standard', 'SKILL.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(skill, /Node\.js/)
  assert.match(skill, /Fastify、Express、Koa、Nitro 和 NestJS/)
  assert.match(skill, /NestJS/)
  assert.match(skill, /垂直切片架构/)
  assert.match(skill, /领域驱动/)
  assert.match(skill, /vertical-slice-backend-standard\.md/)
  assert.match(skill, /nest-backend-standard\.md/)
  assert.match(skill, /Controller 只处理请求解析、载荷校验、Service 调用和响应格式化/)
  assert.match(skill, /跨模块协作必须通过 `imports`、`exports` 和构造函数注入完成/)
  assert.match(skill, /class-validator/)
  assert.match(skill, /dtos\//)
  assert.match(skill, /运行时校验/)
  assert.match(skill, /Deep Imports 零容忍/)
  assert.match(skill, /逐级上浮/)
  assert.match(skill, /Service 公共方法和外部 DTO/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /不得用仓库根级共享脚本替代/)
  assert.match(workflowSkill, /Node\.js 后端实现标准：`backend-code-standard`/)
  assert.match(workflowSkill, /Fastify、Express、Koa、Nitro 和 NestJS/)
  assert.match(workflowSkill, /Java 后端实现标准：`java-code-standard`/)
  assert.match(workflowSkill, /后端测试标准尚未提供/)
})

it('后端编码规范 - skill 自带验证脚本覆盖最近公共父级', () => {
  const scriptPath = path.join(rootDir, 'skills', 'workflow', 'backend-code-standard', 'scripts', 'verify-rules.mjs')

  assert.ok(fs.existsSync(scriptPath))
  assert.ok(!fs.existsSync(path.join(rootDir, 'scripts', 'verify-skill-rules.mjs')))
  assert.match(runNodeScript('skills', 'workflow', 'backend-code-standard', 'scripts', 'verify-rules.mjs'), /PASS backend-code-standard self rules are valid/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'hoist',
      '--target',
      'src/modules/orders/utils',
      '--uses',
      'src/modules/orders/create/service.ts',
      'src/modules/orders/update/service.ts',
      'src/modules/orders/delete/service.ts',
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS backend hoist target stays under nearest common ancestor/,
  )
})

it('后端编码规范 - 单文件主规范覆盖目录、契约和依赖边界', () => {
  const standard = readProjectFile('skills', 'workflow', 'backend-code-standard', 'references', 'vertical-slice-backend-standard.md').replace(/\r\n/g, '\n')

  assert.match(standard, /最高优先级/)
  assert.match(standard, /Fastify、Express、Koa、Nitro/)
  assert.match(standard, /## 1\. 核心原则：垂直切片与业务解耦/)
  assert.match(standard, /禁止扁平化分层/)
  assert.match(standard, /传输层与业务隔离/)
  assert.match(standard, /Service 收敛业务/)
  assert.match(standard, /## 2\. 目录形态标准/)
  assert.ok(standard.includes('modules/[DomainName]/\n  controller.ts - 传输层入口（路由定义、HTTP 状态处理）\n  service.ts - 核心业务逻辑\n  repository.ts (或 dal.ts) - 数据访问层'))
  assert.ok(standard.includes('dtos/ - 数据传输对象与输入校验（Schema）'))
  assert.ok(standard.includes('types/ - 领域模型与接口定义'))
  assert.match(standard, /## 3\. 严格的数据契约拆分/)
  assert.match(standard, /Zod 或 TypeBox/)
  assert.match(standard, /export \* from '\.\/create-order'/)
  assert.match(standard, /export type \* from '\.\/order'/)
  assert.match(standard, /## 4\. 公共入口与路径别名优先/)
  assert.match(standard, /@\/modules\/orders\/service/)
  assert.match(standard, /@\/modules\/orders/)
  assert.match(standard, /需要形成稳定公共 API/)
  assert.match(standard, /模块私有子目录不强制创建 `index\.ts`/)
  assert.match(standard, /绝不允许暴露或穿透引用内部的 Repository/)
  assert.match(standard, /## 5\. 高内聚、三次原则与逐级上浮/)
  assert.match(standard, /orders\/utils\//)
  assert.match(standard, /src\/common\//)
  assert.match(standard, /src\/utils\//)
  assert.match(standard, /## 6\. 注释与代码解释规范/)
  assert.match(standard, /Throws/)
  assert.match(standard, /防止超卖/)
  assert.match(standard, /禁止翻译代码/)
  assert.match(standard, /## 7\. 依赖流向限制/)
  assert.match(standard, /禁止同级跨域私有访问/)
  assert.match(standard, /## 8\. AI 执行验证检查清单/)
})

it('后端编码规范 - NestJS 主规范覆盖模块、DI、DTO 和异常边界', () => {
  const standard = readProjectFile('skills', 'workflow', 'backend-code-standard', 'references', 'nest-backend-standard.md').replace(/\r\n/g, '\n')

  assert.match(standard, /最高优先级/)
  assert.match(standard, /NestJS/)
  assert.match(standard, /DDD-lite/)
  assert.match(standard, /严格依赖注入/)
  assert.match(standard, /## 1\. 核心原则：领域模块化与边界/)
  assert.match(standard, /独立的、自治的 Nest `@Module\(\)`/)
  assert.match(standard, /业务解耦/)
  assert.match(standard, /DI 隔离/)
  assert.match(standard, /@Module\(\{ exports: \[BService\] \}\)/)
  assert.match(standard, /imports: \[BModule\]/)
  assert.match(standard, /构造函数安全注入/)
  assert.match(standard, /## 2\. 目录形态标准/)
  assert.ok(standard.includes('src/modules/[feature-name]/\n  [feature].controller.ts - 路由与 HTTP 层\n  [feature].service.ts - 核心业务逻辑\n  [feature].module.ts - 模块 DI 组装与边界定义'))
  assert.match(standard, /dto\/ - 带有 class-validator 装饰器的验证契约/)
  assert.match(standard, /entities\/ \(或 schemas\/\)/)
  assert.match(standard, /interfaces\//)
  assert.match(standard, /## 3\. 强类型的 DTO 与校验契约/)
  assert.match(standard, /严禁在 Controller 中使用 `any`/)
  assert.match(standard, /@IsString\(\)/)
  assert.match(standard, /@IsNotEmpty\(\)/)
  assert.match(standard, /@nestjs\/swagger/)
  assert.match(standard, /## 4\. 公共入口与路径别名优先/)
  assert.match(standard, /@\/modules\/orders\/orders\.module/)
  assert.match(standard, /@\/modules\/orders/)
  assert.match(standard, /@Module\(\{ exports: \[\.\.\.\] \}\)/)
  assert.match(standard, /需要形成稳定公共 API/)
  assert.match(standard, /## 5\. 高内聚、三次原则与逐级上浮/)
  assert.match(standard, /Guard、Interceptor、Pipe/)
  assert.match(standard, /modules\/orders\/pipes\//)
  assert.match(standard, /src\/common\//)
  assert.match(standard, /## 6\. 注释与异常处理规范/)
  assert.match(standard, /Service 层的类方法必须包含 JSDoc 注释/)
  assert.match(standard, /领域错误或应用错误/)
  assert.match(standard, /Controller、Filter 或全局异常过滤器/)
  assert.doesNotMatch(standard, /Service 层遇到业务阻断时，必须抛出 Nest 内置的 `HttpException`/)
  assert.match(standard, /## 7\. 依赖流向限制/)
  assert.match(standard, /禁止绕过 DI/)
  assert.match(standard, /new Service\(\)/)
  assert.match(standard, /## 8\. AI 执行验证检查清单/)
})

it('后端编码规范 - README 描述同步 Node 与 NestJS 范围且后端测试暂不分发', () => {
  const readme = readProjectFile('README.md')
  const readmeZh = readProjectFile('README-zh.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.ok(fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'backend-code-standard', 'SKILL.md')))
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'backend-testing-standard', 'SKILL.md')))
  assert.ok(fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'java-code-standard', 'SKILL.md')))
  assert.match(readme, /backend-code-standard/)
  assert.match(readme, /Node\.js backend code standards/)
  assert.match(readme, /NestJS/)
  assert.match(readme, /strict DI/)
  assert.match(readme, /java-code-standard/)
  assert.match(readme, /Java and Spring Boot backend code standards/)
  assert.match(readme, /constructor injection/)
  assert.match(readmeZh, /backend-code-standard/)
  assert.match(readmeZh, /Node\.js 后端编码标准/)
  assert.match(readmeZh, /NestJS/)
  assert.match(readmeZh, /严格 DI/)
  assert.match(readmeZh, /java-code-standard/)
  assert.match(readmeZh, /Java 与 Spring Boot 后端编码标准/)
  assert.match(readmeZh, /构造函数注入/)
  assert.doesNotMatch(readme, /backend-testing-standard/)
  assert.doesNotMatch(readmeZh, /backend-testing-standard/)
  assert.doesNotMatch(workflowSkill, /`backend-testing-standard`/)
})

it('java 编码规范 - 入口引用 Java 与 Spring Boot 最佳实践', () => {
  const skill = readProjectFile('skills', 'workflow', 'java-code-standard', 'SKILL.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(skill, /Java/)
  assert.match(skill, /Spring Boot/)
  assert.match(skill, /Maven/)
  assert.match(skill, /Gradle/)
  assert.match(skill, /java-backend-standard\.md/)
  assert.match(skill, /构造函数注入/)
  assert.match(skill, /Bean Validation/)
  assert.match(skill, /ControllerAdvice/)
  assert.match(skill, /Flyway/)
  assert.match(skill, /Liquibase/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /不得用仓库根级共享脚本替代/)
  assert.match(workflowSkill, /Java 后端实现标准：`java-code-standard`/)
})

it('java 编码规范 - 主规范覆盖包结构、契约、事务和持久化边界', () => {
  const standard = readProjectFile('skills', 'workflow', 'java-code-standard', 'references', 'java-backend-standard.md').replace(/\r\n/g, '\n')

  assert.match(standard, /Java 17\+ 基线/)
  assert.match(standard, /优先选择 Java 21 或 Java 25 LTS/)
  assert.match(standard, /Spring Boot/)
  assert.match(standard, /## 1\. 核心原则：领域模块与应用边界/)
  assert.match(standard, /按业务领域组织 package/)
  assert.match(standard, /Controller 不承载业务规则/)
  assert.match(standard, /Service 或 Application Service 编排业务用例/)
  assert.match(standard, /## 2\. 目录形态标准/)
  assert.ok(standard.includes('src/main/java/com/example/order/\n  api/\n    OrderController.java\n    request/\n      CreateOrderRequest.java\n    response/\n      OrderResponse.java'))
  assert.match(standard, /domain\//)
  assert.match(standard, /application\//)
  assert.match(standard, /infrastructure\//)
  assert.match(standard, /## 3\. Java 语言与类型实践/)
  assert.match(standard, /record/)
  assert.match(standard, /Optional/)
  assert.match(standard, /禁止把 `Optional` 用作字段、DTO 属性或方法参数/)
  assert.match(standard, /## 4\. API 契约与校验/)
  assert.match(standard, /jakarta\.validation/)
  assert.match(standard, /禁止把 JPA Entity 直接作为 API Request 或 Response/)
  assert.match(standard, /## 5\. 依赖注入、事务和错误语义/)
  assert.match(standard, /构造函数注入/)
  assert.match(standard, /@Transactional/)
  assert.match(standard, /ControllerAdvice/)
  assert.match(standard, /ProblemDetail/)
  assert.match(standard, /## 6\. 持久化、迁移和配置/)
  assert.match(standard, /Flyway 或 Liquibase/)
  assert.match(standard, /@ConfigurationProperties/)
  assert.match(standard, /## 7\. 依赖流向与复用/)
  assert.match(standard, /三次原则/)
  assert.match(standard, /最近公共父级/)
  assert.match(standard, /## 9\. AI 执行验证检查清单/)
})

it('java 编码规范 - skill 自带验证脚本覆盖最近公共父级', () => {
  const scriptPath = path.join(rootDir, 'skills', 'workflow', 'java-code-standard', 'scripts', 'verify-rules.mjs')

  assert.ok(fs.existsSync(scriptPath))
  assert.match(runNodeScript('skills', 'workflow', 'java-code-standard', 'scripts', 'verify-rules.mjs'), /PASS java-code-standard self rules are valid/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'hoist',
      '--target',
      'src/main/java/com/example/order/support',
      '--uses',
      'src/main/java/com/example/order/create/CreateOrderService.java',
      'src/main/java/com/example/order/update/UpdateOrderService.java',
      'src/main/java/com/example/order/cancel/CancelOrderService.java',
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS java hoist target stays under nearest common ancestor/,
  )
})
