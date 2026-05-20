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
  assert.match(agents, /禁止 lint 绕行/)
  assert.match(agents, /不得通过 `--no-verify`、关闭或弱化 lint 规则、扩大 ignore、跳过 lint 脚本/)
  assert.match(agents, /改跑不覆盖目标文件的命令、删除断言或伪造检查结果来绕过 lint 失败/)
  assert.match(agents, /优先使用成熟库/)
  assert.match(agents, /用户本次消息的主要语言/)
  assert.match(agents, /生成的代码必须包含清晰、专业的注释/)
  assert.match(agents, /零成本理解代码的设计意图、API 契约和业务逻辑/)
  assert.match(agents, /质量检查必须按任务场景和风险分级执行/)
  assert.match(agents, /Superpowers、并行子代理、系统化调试、TDD、全量测试、coverage 和构建不得默认触发/)
  assert.match(agents, /检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N\/A`/)
  assert.match(agents, /## 并行子代理/)
  assert.match(agents, /写入范围不重叠、可独立验证的子任务/)
  assert.match(agents, /生产代码生成、Bug 修复、重构、迁移或自动修改文件的子代理/)
  assert.match(agents, /默认不低于 `gpt-5\.5` \+ `high` reasoning/)
  assert.match(agents, /不得产出未经主代理复核的代码修改/)
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

  assert.match(skill, /Vue 3 \/ React TypeScript\/JavaScript/)
  assert.match(skill, /组件、业务模块、前端工具包和 UI 组件库/)
  assert.match(skill, /实现质量、目录边界、公共导出、import 路径、类型契约和交付检查/)
  assert.match(skill, /不是只管目录拆分的窄规则/)
  assert.match(skill, /当任务是评审、检查或判断是否符合标准时，先给出目标分类和检查范围，再输出问题点与改动建议，不得只复述规则/)
  assert.match(skill, /未执行标记 `NOT RUN`/)
  assert.match(skill, /Vue 3 标准/)
  assert.match(skill, /React 标准/)
  assert.match(skill, /组件标准/)
  assert.match(skill, /业务模块标准/)
  assert.match(skill, /工具包与 UI 组件库标准/)
  assert.match(skill, /契约优先/)
  assert.match(skill, /状态就近/)
  assert.match(skill, /逻辑贴近使用点/)
  assert.match(skill, /失败显性/)
  assert.match(skill, /类型从事实来/)
  assert.match(skill, /抽象要付账/)
  assert.match(skill, /注释解释意图/)
  assert.doesNotMatch(skill, /必须把 script 抽成 Hook/)
  assert.match(skill, /## 评审输出/)
  assert.match(skill, /目标分类：`simple-component`、`business-module`、`component-package`、`utility-library`、`ui-library` 或 `ordinary-module`/)
  assert.match(skill, /检查范围：说明本次实际阅读和检查的文件、目录、调用方或验证命令；未检查部分明确标记 `NOT RUN`/)
  assert.match(skill, /总结论：只能使用 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`/)
  assert.match(skill, /严重级别：`critical`、`major` 或 `minor`/)
  assert.match(skill, /改动建议汇总：按文件归并，整理成可以直接交给其他 AI 实现的改动单/)
  assert.match(skill, /只复述规则，不指出当前代码哪里不符合/)
  assert.match(skill, /只写“建议优化”“建议调整”“建议规范化”这类空泛建议/)
  assert.match(skill, /结构校验脚本：`scripts\/verify-rules\.mjs`（只覆盖结构约束，不替代实现审查）/)
  assert.doesNotMatch(skill, /examples\/directory-structure\.md/)
  assert.doesNotMatch(skill, /examples\/package-structure\.md/)
  assert.doesNotMatch(skill, /fractal-frontend-standard\.md/)
  assert.doesNotMatch(skill, /references\//)
  assert.doesNotMatch(skill, /必须完整读取/)
  assert.doesNotMatch(skill, /Headless 状态逻辑/)
  assert.doesNotMatch(skill, /复杂状态、跨组件复用逻辑和副作用编排必须从视图层剥离/)
  assert.doesNotMatch(skill, /复杂业务状态、跨组件复用逻辑和副作用编排必须进入/)
  assert.match(skill, /组件私有逻辑默认留在组件内/)
  assert.match(skill, /路径别名优先/)
  assert.match(skill, /禁止 deep import/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /前端目录遵循单一入口、按需拆分/)
  assert.match(skill, /普通业务模块不得在根目录额外创建 `index\.ts` \/ `index\.js`/)
  assert.match(skill, /只有 `component-package`、`utility-library` 和 `ui-library` 允许/)
  assert.match(skill, /`styles\/` 只使用一个 `index\.css`、`index\.scss` 或 `index\.less`/)
  assert.match(skill, /复杂组件可按职责拆分/)
  assert.match(skill, /简单组件和普通模块的类型优先贴近使用点/)
  assert.match(skill, /缺少脚本时标记 `MISSING`，失败时标记 `FAIL`/)
  assert.doesNotMatch(skill, /react\.md|typescript-javascript\.md|common\.md|vue\.md/)
})

it('前端编码规范 - examples 按可复用单元拆分', () => {
  const exampleRoot = path.join(rootDir, 'skills', 'workflow', 'frontend-code-standard', 'examples')
  const businessModule = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'business-module.md').replace(/\r\n/g, '\n')
  const component = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'component.md').replace(/\r\n/g, '\n')
  const utility = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'utility.md').replace(/\r\n/g, '\n')
  const typesAndImports = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'types-and-imports.md').replace(/\r\n/g, '\n')
  const reviewOutput = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'review-output.md').replace(/\r\n/g, '\n')
  const exampleFiles = fs.readdirSync(exampleRoot).filter(file => file.endsWith('.md')).sort()

  assert.deepEqual(exampleFiles, [
    'business-module.md',
    'component.md',
    'review-output.md',
    'types-and-imports.md',
    'utility.md',
  ])

  for (const content of [businessModule, component, utility, typesAndImports, reviewOutput]) {
    assert.match(content, /本文件只提供示例/)
    assert.match(content, /不定义新规则/)
    assert.doesNotMatch(content, /最高优先级/)
    assert.doesNotMatch(content, /核心原则：/)
    assert.doesNotMatch(content, /校验脚本/)
    assert.doesNotMatch(content, /检查清单/)
  }

  assert.match(businessModule, /## 页面模块/)
  assert.ok(businessModule.includes('views/\n  purchaseOrder/\n    index.vue\n    api/\n      index.ts\n      purchase-order-api.ts'))
  assert.ok(businessModule.includes('components/\n      index.ts\n      StatusBadge.vue\n      AuditDialog/\n        README.md\n        index.ts\n        src/\n          index.vue'))
  assert.ok(businessModule.includes('styles/\n      index.scss\n      purchase-order.scss\n    types/\n      index.ts\n      purchase-order.ts'))
  assert.match(businessModule, /位置判断/)
  assert.match(businessModule, /最近公共父级/)
  assert.match(component, /Sparkline\.jsx/)
  assert.ok(component.includes('DataTable/\n  README.md\n  index.ts\n  src/\n    index.vue'))
  assert.ok(component.includes('components/\n      index.ts\n      HeaderCell.vue\n      EmptyState.vue'))
  assert.ok(component.includes('utils/\n      index.ts\n      normalize-column.ts'))
  assert.ok(component.includes('styles/\n      index.scss\n      data-table.scss'))
  assert.ok(component.includes('DataTableReact/\n  README.md\n  index.ts\n  src/\n    index.tsx\n    types/\n      props.ts\n      ref.ts'))
  assert.ok(!component.includes('hooks/'))
  assert.ok(!component.includes('composables/'))
  assert.ok(!businessModule.includes('composables/'))
  assert.match(component, /公共 props 表达调用契约/)
  assert.match(utility, /## 简单工具/)
  assert.match(utility, /## 工具包/)
  assert.ok(utility.includes('normalize-text.ts\ncopy-text.ts'))
  assert.ok(utility.includes('ClipboardToolkit/\n  README.md\n  index.ts\n  src/\n    index.ts\n    clipboard/\n      index.ts'))
  assert.ok(utility.includes('utils/\n        index.ts\n        normalize-text.ts\n        copy-text.ts'))
  assert.ok(utility.includes('api/\n        index.ts\n        clipboard-api.ts'))
  assert.ok(utility.includes('constants/\n        index.ts\n        clipboard-options.ts'))
  assert.match(utility, /涉及浏览器 API 的工具显式接收依赖/)
  assert.match(reviewOutput, /目标分类：component-package/)
  assert.match(reviewOutput, /总结论：FAIL/)
  assert.match(reviewOutput, /规则点：/)
  assert.match(reviewOutput, /证据：`src\/views\/order\/index\.vue:12`/)
  assert.match(reviewOutput, /改动建议汇总：/)
  assert.match(reviewOutput, /不得只写“建议优化”“建议调整”“建议规范化”/)
  assert.ok(reviewOutput.includes('src/components/DataTable/index.ts'))
  assert.ok(reviewOutput.includes('packages/ClipboardToolkit/src/clipboard/api/clipboard-api.ts'))
  assert.ok(!reviewOutput.includes('校验脚本'))
  assert.ok(!reviewOutput.includes('检查清单'))
  assert.ok(!utility.includes('BrowserToolkit/'))
  assert.ok(!utility.includes('MoluoxixiUI/'))
  assert.ok(!businessModule.includes('views/ or pages/ or modules/'))
  assert.ok(!businessModule.includes('columnSettings'))
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
  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/views/purchaseOrder/create/utils',
    '--uses',
    'src/views/purchaseOrder/create/index.tsx',
    'src/views/purchaseOrder/update/index.tsx',
    'src/views/purchaseOrder/delete/index.tsx',
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stderr, /抽离目标必须位于最近公共父级的直接共享目录/)
})

it('前端编码规范 - 类型组织示例保持建议口径', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')
  const examples = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'types-and-imports.md')

  assert.match(skill, /类型从事实来/)
  assert.match(skill, /简单组件和普通模块的类型优先贴近使用点/)
  assert.match(skill, /复杂组件可按职责拆分/)
  assert.match(skill, /类型出口优先使用 type-only re-export/)
  assert.match(skill, /props\.ts/)
  assert.match(skill, /ref\.ts/)
  assert.match(skill, /emit\.ts/)
  assert.match(skill, /expose\.ts/)
  assert.match(skill, /不用 `any`、宽泛对象或可选字段掩盖契约不清/)
  assert.match(examples, /export type \* from '\.\/props'/)
  assert.match(examples, /export type \* from '\.\/ref'/)
  assert.ok(examples.includes('DataTable/\n  index.ts\n  src/\n    index.tsx\n    types/\n      props.ts\n      ref.ts\n      index.ts'))
})

it('前端编码规范 - Barrel、路径别名、三次原则和逐级上浮为硬约束', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')
  const examples = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'examples', 'types-and-imports.md')
  const checklist = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'validation', 'checklist.md')

  assert.match(skill, /路径别名优先/)
  assert.match(skill, /禁止 deep import/)
  assert.match(skill, /只有 `component-package`、`utility-library` 和 `ui-library` 允许/)
  assert.match(skill, /公共代码上浮到最近公共父级/)
  assert.match(skill, /满足三次原则/)
  assert.match(examples, /@\/components\/DataTable\/utils\/date/)
  assert.match(examples, /@\/components\/DataTable\/src\/utils\/date/)
  assert.match(examples, /@\/components\/DataTable/)
  assert.doesNotMatch(examples, /允许：\n\n```ts\nimport \{ formatDate \} from '@\/components\/DataTable\/utils'/)
  assert.match(checklist, /node skills\/workflow\/frontend-code-standard\/scripts\/verify-rules\.mjs hoist --target/)
  assert.match(checklist, /公共代码抽离是否满足三次原则，并落在最近公共父级/)
})

it('前端编码规范 - 约束实现质量但不机械抽离', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')
  const checklist = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'validation', 'checklist.md')

  assert.match(skill, /状态就近/)
  assert.match(skill, /逻辑贴近使用点/)
  assert.match(skill, /组件私有逻辑默认留在组件内/)
  assert.match(skill, /只有复用、测试或复杂度收益明确时才抽到 hook、composable 或普通函数/)
  assert.match(skill, /涉及浏览器、时间、随机数、网络和存储时显式表达副作用/)
  assert.match(skill, /注释解释意图/)
  assert.match(skill, /不复述实现步骤/)
  assert.match(skill, /不要因为文件变长就机械拆分/)
  assert.doesNotMatch(skill, /复杂副作用必须/)
  assert.match(checklist, /状态是否就近保留/)
  assert.match(checklist, /指出缺失状态出现在哪条交互路径/)
  assert.match(checklist, /建议回收到哪个文件或组件边界/)
  assert.match(checklist, /新目录、新抽象和公共 API 是否都有真实职责/)
  assert.match(checklist, /指出具体类型声明和建议替换方式；不得只写“补充类型”/)
  assert.match(checklist, /实现是否覆盖当前职责下真实存在的 loading、empty、error、disabled、readonly 等状态/)
  assert.match(checklist, /脚本 `PASS` 只代表结构通过，不代表实现整体通过/)
  assert.match(checklist, /必须给出具体 import 语句、文件位置和应改用的公开入口；不得只写“避免 deep import”/)
  assert.match(checklist, /先写目标分类和本次检查范围/)
  assert.match(checklist, /每个问题都要包含：规则点、证据（文件路径和位置）、问题说明、可执行的改动建议/)
  assert.match(checklist, /是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证/)
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

it('node 编码规范 - 入口引用 Node 后端实现标准', () => {
  const skill = readProjectFile('skills', 'workflow', 'node-code-standard', 'SKILL.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(skill, /Node\.js/)
  assert.match(skill, /TypeScript 与 JavaScript/)
  assert.match(skill, /用于新写或重构 Node\.js 后端代码/)
  assert.match(skill, /不面向兼容式修补/)
  assert.match(skill, /examples\/node-backend-structure\.md/)
  assert.match(skill, /examples\/review-output\.md/)
  assert.match(skill, /validation\/checklist\.md/)
  assert.match(skill, /契约优先/)
  assert.match(skill, /边界清晰/)
  assert.match(skill, /失败显性/)
  assert.match(skill, /共享逐级上浮/)
  assert.match(skill, /Zod、Valibot、TypeBox、AJV/)
  assert.match(skill, /Prisma Migrate、Drizzle Kit、Knex migration、TypeORM migration 或 Sequelize migration/)
  assert.match(skill, /目标分类/)
  assert.match(skill, /`entrypoint`/)
  assert.match(skill, /`transport-module`/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.doesNotMatch(skill, /vertical-slice-backend-standard\.md/)
  assert.doesNotMatch(skill, /nest-backend-standard\.md/)
  assert.match(workflowSkill, /Node\.js 后端实现标准：`node-code-standard`/)
  assert.match(workflowSkill, /NestJS 后端实现标准：`nestjs-code-standard`/)
  assert.match(workflowSkill, /Java 后端实现标准：`java-code-standard`/)
})

it('node 编码规范 - skill 自带验证脚本覆盖最近公共父级', () => {
  const scriptPath = path.join(rootDir, 'skills', 'workflow', 'node-code-standard', 'scripts', 'verify-rules.mjs')

  assert.ok(fs.existsSync(scriptPath))
  assert.ok(!fs.existsSync(path.join(rootDir, 'scripts', 'verify-skill-rules.mjs')))
  assert.match(runNodeScript('skills', 'workflow', 'node-code-standard', 'scripts', 'verify-rules.mjs'), /PASS node-code-standard self rules are valid/)
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
  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/modules/orders/create/utils',
    '--uses',
    'src/modules/orders/create/service.ts',
    'src/modules/orders/update/service.ts',
    'src/modules/orders/delete/service.ts',
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stderr, /抽离目标必须位于最近公共父级的直接共享目录/)
})

it('node 编码规范 - examples 和 validation 承载示例与清单', () => {
  const nodeExamples = readProjectFile('skills', 'workflow', 'node-code-standard', 'examples', 'node-backend-structure.md').replace(/\r\n/g, '\n')
  const checklist = readProjectFile('skills', 'workflow', 'node-code-standard', 'validation', 'checklist.md')

  assert.match(nodeExamples, /本文件只提供示例，不定义新规则/)
  assert.match(nodeExamples, /src\/modules\/orders\//)
  assert.match(nodeExamples, /transport\//)
  assert.match(nodeExamples, /application\//)
  assert.match(nodeExamples, /domain\//)
  assert.match(nodeExamples, /infrastructure\//)
  assert.match(nodeExamples, /FastifyInstance/)
  assert.match(nodeExamples, /zod/)
  assert.match(nodeExamples, /Service 只做用例编排与事务边界/)
  assert.match(nodeExamples, /repository 负责持久化访问和映射/)
  assert.match(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/)
  assert.match(checklist, /schema 方案/)
  assert.match(checklist, /构造参数、工厂参数或模块装配/)
  assert.match(checklist, /事务要求/)
  assert.match(checklist, /脚本 `PASS` 只代表抽离位置通过，不代表实现整体通过/)
})

it('node 编码规范 - 不再保留 references 主规范', () => {
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'node-code-standard', 'references', 'vertical-slice-backend-standard.md')))
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'node-code-standard', 'references', 'nest-backend-standard.md')))
})

it('nestJS 编码规范 - 入口引用 NestJS 最佳实践', () => {
  const skill = readProjectFile('skills', 'workflow', 'nestjs-code-standard', 'SKILL.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(skill, /NestJS/)
  assert.match(skill, /DTO 校验/)
  assert.match(skill, /唯一规则源/)
  assert.match(skill, /ValidationPipe/)
  assert.match(skill, /class-validator/)
  assert.match(skill, /构造函数注入/)
  assert.match(skill, /事务边界/)
  assert.match(skill, /持久化封装/)
  assert.match(skill, /examples\/nestjs-backend-structure\.md/)
  assert.match(skill, /validation\/checklist\.md/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.doesNotMatch(skill, /nest-backend-standard\.md/)
  assert.match(workflowSkill, /NestJS 后端实现标准：`nestjs-code-standard`/)
})

it('nestJS 编码规范 - examples 和 validation 承载示例与清单', () => {
  const examples = readProjectFile('skills', 'workflow', 'nestjs-code-standard', 'examples', 'nestjs-backend-structure.md').replace(/\r\n/g, '\n')
  const checklist = readProjectFile('skills', 'workflow', 'nestjs-code-standard', 'validation', 'checklist.md')

  assert.match(examples, /本文件只提供示例，不定义新规则/)
  assert.match(examples, /src\/modules\/orders\//)
  assert.match(examples, /orders\.module\.ts/)
  assert.match(examples, /@Module/)
  assert.match(examples, /ValidationPipe/)
  assert.match(examples, /class-validator/)
  assert.match(examples, /Service 只做用例编排与事务边界/)
  assert.match(examples, /repository 负责持久化访问和映射/)
  assert.match(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/)
  assert.match(checklist, /ValidationPipe/)
  assert.match(checklist, /class-validator/)
  assert.match(checklist, /构造函数注入/)
  assert.match(checklist, /事务要求/)
  assert.match(checklist, /脚本 `PASS` 只代表抽离位置通过，不代表实现整体通过/)
})

it('nestJS 编码规范 - skill 自带验证脚本覆盖最近公共父级', () => {
  const scriptPath = path.join(rootDir, 'skills', 'workflow', 'nestjs-code-standard', 'scripts', 'verify-rules.mjs')

  assert.ok(fs.existsSync(scriptPath))
  assert.match(runNodeScript('skills', 'workflow', 'nestjs-code-standard', 'scripts', 'verify-rules.mjs'), /PASS nestjs-code-standard self rules are valid/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'hoist',
      '--target',
      'src/modules/orders/shared',
      '--uses',
      'src/modules/orders/create/create-order.service.ts',
      'src/modules/orders/update/update-order.service.ts',
      'src/modules/orders/cancel/cancel-order.service.ts',
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS nestjs hoist target stays under nearest common ancestor/,
  )
  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/modules/orders/create/shared',
    '--uses',
    'src/modules/orders/create/create-order.service.ts',
    'src/modules/orders/update/update-order.service.ts',
    'src/modules/orders/cancel/cancel-order.service.ts',
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stderr, /抽离目标必须位于最近公共父级的直接共享目录/)
})

it('后端编码规范 - README 描述同步技术栈命名且后端测试暂不分发', () => {
  const readme = readProjectFile('README.md')
  const readmeZh = readProjectFile('README-zh.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.ok(fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'node-code-standard', 'SKILL.md')))
  assert.ok(fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'nestjs-code-standard', 'SKILL.md')))
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'backend-code-standard', 'SKILL.md')))
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'nestjs-backend-standard', 'SKILL.md')))
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'backend-testing-standard', 'SKILL.md')))
  assert.ok(fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'java-code-standard', 'SKILL.md')))
  assert.match(readme, /node-code-standard/)
  assert.match(readme, /Node\.js backend implementation standards/)
  assert.match(readme, /explicit contracts/)
  assert.match(readme, /nestjs-code-standard/)
  assert.match(readme, /NestJS backend implementation and review standards/)
  assert.match(readme, /java-code-standard/)
  assert.match(readme, /Java and Spring Boot backend code standards/)
  assert.match(readme, /constructor injection/)
  assert.match(readmeZh, /node-code-standard/)
  assert.match(readmeZh, /Node\.js 后端实现标准/)
  assert.match(readmeZh, /显式契约/)
  assert.match(readmeZh, /nestjs-code-standard/)
  assert.match(readmeZh, /NestJS 后端实现与评审标准/)
  assert.match(readmeZh, /java-code-standard/)
  assert.match(readmeZh, /Java 与 Spring Boot 后端编码标准/)
  assert.match(readmeZh, /构造函数注入/)
  assert.doesNotMatch(readme, /backend-code-standard|nestjs-backend-standard/)
  assert.doesNotMatch(readmeZh, /backend-code-standard|nestjs-backend-standard/)
  assert.doesNotMatch(readme, /backend-testing-standard/)
  assert.doesNotMatch(readmeZh, /backend-testing-standard/)
  assert.doesNotMatch(workflowSkill, /`backend-testing-standard`/)
  assert.doesNotMatch(workflowSkill, /`backend-code-standard`|`nestjs-backend-standard`/)
})

it('java 编码规范 - 入口引用 Java 与 Spring Boot 最佳实践', () => {
  const skill = readProjectFile('skills', 'workflow', 'java-code-standard', 'SKILL.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(skill, /Java/)
  assert.match(skill, /Spring Boot/)
  assert.match(skill, /Maven/)
  assert.match(skill, /Gradle/)
  assert.match(skill, /唯一规则源/)
  assert.match(skill, /examples\/spring-boot-structure\.md/)
  assert.match(skill, /validation\/checklist\.md/)
  assert.doesNotMatch(skill, /java-backend-standard\.md/)
  assert.match(skill, /构造函数注入/)
  assert.match(skill, /Bean Validation/)
  assert.match(skill, /ControllerAdvice/)
  assert.match(skill, /Flyway/)
  assert.match(skill, /Liquibase/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /不得用仓库根级共享脚本替代/)
  assert.match(workflowSkill, /Java 后端实现标准：`java-code-standard`/)
})

it('java 编码规范 - examples 和 validation 承载示例与清单', () => {
  const examples = readProjectFile('skills', 'workflow', 'java-code-standard', 'examples', 'spring-boot-structure.md').replace(/\r\n/g, '\n')
  const checklist = readProjectFile('skills', 'workflow', 'java-code-standard', 'validation', 'checklist.md')

  assert.match(examples, /本文件只提供示例，不定义新规则/)
  assert.ok(examples.includes('src/main/java/com/example/order/\n  api/\n    OrderController.java\n    request/\n      CreateOrderRequest.java\n    response/\n      OrderResponse.java'))
  assert.match(examples, /domain\//)
  assert.match(examples, /application\//)
  assert.match(examples, /infrastructure\//)
  assert.match(examples, /record CreateOrderRequest/)
  assert.match(examples, /@ConfigurationProperties/)
  assert.match(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/)
  assert.match(checklist, /jakarta\.validation/)
  assert.match(checklist, /Flyway 或 Liquibase/)
  assert.match(checklist, /最近公共父级 package/)
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
  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/main/java/com/example/order/create/support',
    '--uses',
    'src/main/java/com/example/order/create/CreateOrderService.java',
    'src/main/java/com/example/order/update/UpdateOrderService.java',
    'src/main/java/com/example/order/cancel/CancelOrderService.java',
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stderr, /抽离目标必须位于最近公共父级的直接共享 package/)
})

it('skill 校验规范 - 校验生成后的 skill 结构', () => {
  const skill = readProjectFile('skills', 'skill-validation-standard', 'SKILL.md')
  const examples = readProjectFile('skills', 'skill-validation-standard', 'examples', 'skill-structure.md')
  const checklist = readProjectFile('skills', 'skill-validation-standard', 'validation', 'checklist.md')
  const scriptPath = path.join(rootDir, 'skills', 'skill-validation-standard', 'scripts', 'verify-rules.mjs')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')
  const readme = readProjectFile('README.md')
  const readmeZh = readProjectFile('README-zh.md')

  assert.match(skill, /Skill 校验规范/)
  assert.match(skill, /校验新建或修改后的 AI skill 产物/)
  assert.match(skill, /AI Skills 规范基线/)
  assert.doesNotMatch(skill, /服务所有 skills/)
  assert.doesNotMatch(skill, /不属于 `workflow`/)
  assert.match(skill, /examples\/skill-structure\.md/)
  assert.match(skill, /validation\/checklist\.md/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /触发描述/)
  assert.match(skill, /内容质量/)
  assert.doesNotMatch(skill, /airules-workflow/)
  assert.match(examples, /本文件只提供示例，不定义新规则/)
  assert.match(examples, /my-skill\/\n {2}SKILL\.md/)
  assert.match(examples, /references\/\n {4}api-schema\.md/)
  assert.match(checklist, /本文件只提供校验脚本用法和检查清单，不定义新规则/)
  assert.match(checklist, /node skills\/skill-validation-standard\/scripts\/verify-rules\.mjs --root/)
  assert.doesNotMatch(checklist, /airules-workflow/)
  assert.match(runNodeScript('skills', 'skill-validation-standard', 'scripts', 'verify-rules.mjs'), /PASS skill is valid/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      '--root',
      'skills/workflow/frontend-code-standard',
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS skill is valid/,
  )
  const claudeSkillTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-claude-skill-'))
  const claudeSkillRoot = path.join(claudeSkillTemp, 'claude-reference-skill')
  fs.mkdirSync(claudeSkillRoot)
  fs.writeFileSync(path.join(claudeSkillRoot, 'SKILL.md'), [
    '---',
    'name: claude-reference-skill',
    'description: Use when checking generated skill packages that include bundled reference material or reusable scripts.',
    '---',
    '',
    '# Claude Skill',
    '',
    'Read [api.md](references/api.md) when API details matter.',
  ].join('\n'))
  fs.mkdirSync(path.join(claudeSkillRoot, 'references'))
  fs.writeFileSync(path.join(claudeSkillRoot, 'references', 'api.md'), '# API\n')
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      '--root',
      claudeSkillRoot,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS skill is valid/,
  )
  const invalidDescriptionTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-invalid-skill-description-'))
  const invalidDescriptionRoot = path.join(invalidDescriptionTemp, 'invalid-skill-description')
  fs.mkdirSync(invalidDescriptionRoot)
  fs.writeFileSync(path.join(invalidDescriptionRoot, 'SKILL.md'), [
    '---',
    'name: invalid-skill-description',
    'description: 本 Skill 服务所有 skills，不属于 workflow，提供完整流程说明。',
    '---',
    '',
    '# Invalid Skill Description',
    '',
    'This body is intentionally valid so the description contract is isolated.',
  ].join('\n'))
  const invalidDescriptionResult = spawnSync(process.execPath, [
    scriptPath,
    '--root',
    invalidDescriptionRoot,
  ], { cwd: rootDir, encoding: 'utf8' })
  assert.notEqual(invalidDescriptionResult.status, 0)
  assert.match(invalidDescriptionResult.stderr, /frontmatter description 不得描述内部投影、分类或自身位置/)

  const unknownArgResult = spawnSync(process.execPath, [
    scriptPath,
    '--rooot',
    'skills/workflow/frontend-code-standard',
  ], { cwd: rootDir, encoding: 'utf8' })
  assert.notEqual(unknownArgResult.status, 0)
  assert.match(unknownArgResult.stderr, /未知参数：--rooot/)

  assert.doesNotMatch(workflowSkill, /不属于 workflow namespace/)
  assert.match(readme, /skill-validation-standard/)
  assert.match(readme, /General skill validation standard/)
  assert.match(readme, /├── skill-validation-standard\//)
  assert.match(readme, /Top-level first-party skills are projected explicitly/)
  assert.doesNotMatch(readme, /top-level first-party `skills\/` projection list is intentionally empty/)
  assert.match(readmeZh, /skill-validation-standard/)
  assert.match(readmeZh, /通用 Skill 产物校验标准/)
  assert.match(readmeZh, /├── skill-validation-standard\//)
  assert.match(readmeZh, /顶层第一方 skills 通过精确列表投影/)
  assert.doesNotMatch(readmeZh, /顶层第一方 `skills\/` 投影列表刻意保持为空/)
})
