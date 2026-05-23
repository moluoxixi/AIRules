import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
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

it('入口策略 - rules/AGENTS 保留公共硬规则并保持简洁入口边界', () => {
  const agents = readProjectFile('rules', 'AGENTS.md')

  assert.match(agents, /## 核心规则/)
  assert.match(agents, /禁止冗余校验/)
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

  assert.match(skill, /frontend-code-standard/)
  assert.match(skill, /Vue\/React 前端组件/)
  assert.match(skill, /组件、业务模块、前端工具包和 UI 组件库/)
  assert.match(skill, /实现质量、目录边界、公共导出、import 路径、类型契约和交付检查/)
  assert.match(skill, /不是只管目录拆分的窄规则/)
  assert.match(skill, /极其严苛且务实的资深前端架构师/)
  assert.match(skill, /当任务是评审、检查或判断是否符合标准时，先给出目标分类和检查范围，再输出问题点与改动建议，不得只复述规则/)
  assert.match(skill, /未执行标记 `NOT RUN`/)
  assert.match(skill, /Vue 3 标准/)
  assert.match(skill, /React 标准/)
  assert.match(skill, /组件标准/)
  assert.match(skill, /业务模块标准/)
  assert.doesNotMatch(skill, /ordinary-module/)
  assert.match(skill, /工具包与 UI 组件库标准/)
  assert.match(skill, /契约优先/)
  assert.match(skill, /物理边界约束/)
  assert.match(skill, /文件与目录命名约束/)
  assert.match(skill, /但作为包\/目录默认聚合入口的 `index\.vue`、`index\.tsx` 或 `index\.jsx` 必须保持全小写/)
  assert.match(skill, /UI 与逻辑解耦/)
  assert.match(skill, /配置与元数据隔离/)
  assert.match(skill, /就近内聚/)
  assert.match(skill, /状态就近/)
  assert.match(skill, /逻辑贴近使用点/)
  assert.match(skill, /失败显性/)
  assert.match(skill, /类型扩展性与显式返回/)
  assert.match(skill, /抽象要付账/)
  assert.match(skill, /注释解释意图/)
  assert.doesNotMatch(skill, /必须把 script 抽成 Hook/)
  assert.match(skill, /## 示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.match(skill, /工具包（utility-library）/)
  assert.match(skill, /UI 组件库（ui-library）/)
  assert.match(skill, /简单组件（simple-component）/)
  assert.match(skill, /复杂组件包（component-package）/)
  assert.match(skill, /页面模块/)
  assert.match(skill, /类型组织与导入隔离/)
  assert.match(skill, /若具备终端执行环境则直接按风险执行项目已有 lint、typecheck、test、build 或浏览器验证；若为纯对话环境，则向用户输出具体的需执行验证命令清单/)
  assert.match(skill, /响应式丢失风险/)
  assert.match(skill, /## 评审输出/)
  assert.match(skill, /### 目标分类/)
  assert.match(skill, /### 检查范围/)
  assert.match(skill, /### 总结论/)
  assert.match(skill, /### 问题列表/)
  assert.match(skill, /### 改动建议汇总/)
  assert.match(skill, /只复述规则，不指出当前代码哪里不符合/)
  assert.match(skill, /只写“建议优化”“建议调整”“建议规范化”这类空泛建议/)
  assert.match(skill, /node scripts\/verify-rules\.mjs/)
  assert.doesNotMatch(skill, /examples\/directory-structure\.md/)
  assert.doesNotMatch(skill, /examples\/package-structure\.md/)
  assert.doesNotMatch(skill, /fractal-frontend-standard\.md/)
  assert.doesNotMatch(skill, /references\//)
  assert.doesNotMatch(skill, /必须完整读取/)
  assert.doesNotMatch(skill, /Headless 状态逻辑/)
  assert.doesNotMatch(skill, /复杂状态、跨组件复用逻辑和副作用编排必须从视图层剥离/)
  assert.doesNotMatch(skill, /复杂业务状态、跨组件复用逻辑和副作用编排必须进入/)
  assert.match(skill, /私有逻辑默认留在组件或模块内部/)
  assert.match(skill, /路径别名优先/)
  assert.match(skill, /禁止 deep import/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /前端目录遵循单一入口、按需拆分/)
  assert.match(skill, /只有 `component-package`、`utility-library` 和 `ui-library` 允许/)
  assert.match(skill, /`styles\/` 只使用一个 `index\.css`、`index\.scss` 或 `index\.less`/)
  assert.match(skill, /复杂组件可按职责拆分/)
  assert.match(skill, /简单组件的类型优先贴近使用点/)
  assert.match(skill, /export type \* from '\.\/props'/)
  assert.match(skill, /@\/components\/DataTable\/src\/composables\/use-table-sort/)
  assert.match(skill, /@\/components\/DataTable/)
  assert.match(skill, /缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`/)
  assert.doesNotMatch(skill, /react\.md|typescript-javascript\.md|common\.md|vue\.md/)
})

it('前端编码规范 - SKILL.md 内联示例按可复用单元拆分', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md').replace(/\r\n/g, '\n')

  assert.match(skill, /## 示例/)
  assert.match(skill, /## 工具包（utility-library）/)
  assert.match(skill, /## UI 组件库（ui-library）/)
  assert.match(skill, /### 简单组件（simple-component）/)
  assert.match(skill, /### 复杂组件包（component-package）/)
  assert.match(skill, /### 页面模块/)
  assert.match(skill, /### 类型组织与导入隔离/)
  assert.match(skill, /### 评审输出示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.doesNotMatch(skill, /examples\/|validation\//)
  assert.match(skill, /公共代码应直接进入全局 `@\/components`、`@\/utils`、`@\/composables`、`@\/constants` 或 `@\/types`；Monorepo 场景则进入 workspace package/)
  assert.match(skill, /公开契约（props、emits、slots、ref、expose）/)
  assert.match(skill, /必须显式传入 navigator，不依赖全局对象。/)
  assert.ok(skill.includes('clipboard-toolkit/\n├── README.md\n├── package.json'))
  assert.ok(skill.includes('api/\n    │   │   ├── index.ts\n    │   │   └── clipboard-api.ts'))
  assert.ok(skill.includes('constants/\n    │       ├── index.ts\n    │       └── clipboard-options.ts'))
  assert.ok(skill.includes('MoluoxixiUI/\n├── README.md\n├── package.json\n├── index.ts'))
  assert.ok(skill.includes('DataTable/\n    │       ├── README.md\n    │       ├── index.ts\n    │       └── src/...'))
  assert.ok(skill.includes('views/\n└── purchase-order/\n    ├── index.vue'))
  assert.ok(skill.includes('AuditDialog/\n    │       ├── README.md\n    │       ├── index.ts\n    │       └── src/'))
  assert.ok(skill.includes('// types/index.ts\nexport type * from \'./props\'\nexport type * from \'./ref\'\nexport type * from \'./emit\'\nexport type * from \'./expose\''))
  assert.match(skill, /### 目标分类/)
  assert.match(skill, /### 检查范围/)
  assert.match(skill, /### 总结论/)
  assert.match(skill, /### 问题列表/)
  assert.match(skill, /### 改动建议汇总/)
  assert.match(skill, /1\. \[major\] 规则点：层级导入契约禁止绕过顶层 API/)
  assert.match(skill, /证据：src\/views\/purchase-order\/index\.vue:12/)
  assert.match(skill, /只写“建议优化”“建议调整”“建议规范化”这类空泛建议/)
  assert.ok(skill.includes('src/components/DataTable/index.ts'))
  assert.ok(!skill.includes('BrowserToolkit/'))
  assert.ok(!skill.includes('views/ or pages/ or modules/'))
  assert.ok(!skill.includes('columnSettings'))
})

it('前端编码规范 - skill 自带验证脚本覆盖组件结构和共享边界', () => {
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
  fs.writeFileSync(path.join(simpleComponentRoot, 'format-status.ts'), 'export function formatStatus() {}\n')
  const simpleComponentSiblingResult = spawnSync(process.execPath, [
    scriptPath,
    'simple-component',
    '--root',
    path.join(simpleComponentRoot, 'StatusBadge.vue'),
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(simpleComponentSiblingResult.status, 0)
  assert.match(simpleComponentSiblingResult.stderr, /简单组件同级存在专属附属文件：format-status\.ts/)
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
      'src/views/purchase-order/utils',
      '--uses',
      'src/views/purchase-order/create/index.tsx',
      'src/views/purchase-order/update/index.tsx',
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend hoist target stays within shared boundary/,
  )
  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/views/purchase-order/create/utils',
    '--uses',
    'src/views/purchase-order/create/index.tsx',
    'src/views/purchase-order/update/index.tsx',
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stderr, /抽离目标必须位于允许的共享边界目录/)
})

it('前端编码规范 - 类型组织示例保持建议口径', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')

  assert.match(skill, /类型扩展性与显式返回/)
  assert.match(skill, /interface/)
  assert.match(skill, /显式声明返回类型/)
  assert.match(skill, /简单组件的类型优先贴近使用点/)
  assert.match(skill, /复杂组件可按职责拆分 `types\/props\.ts`、`types\/emit\.ts`、`types\/ref\.ts`、`types\/expose\.ts`、`types\/context\.ts` 和 `types\/index\.ts`/)
  assert.match(skill, /强制使用 `export type` 或 `export type \*`/)
  assert.match(skill, /props\.ts/)
  assert.match(skill, /ref\.ts/)
  assert.match(skill, /emit\.ts/)
  assert.match(skill, /expose\.ts/)
  assert.match(skill, /export type \* from '\.\/props'/)
  assert.match(skill, /export type \* from '\.\/ref'/)
  assert.ok(skill.includes('export type * from \'./emit\'\nexport type * from \'./expose\''))
})

it('前端编码规范 - Barrel、路径别名、复用阈值和领域提升为硬约束', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')

  assert.match(skill, /路径别名优先/)
  assert.match(skill, /禁止 deep import/)
  assert.match(skill, /只有 `component-package`、`utility-library` 和 `ui-library` 允许/)
  assert.match(skill, /摒弃死板的“三次法则”/)
  assert.match(skill, /出现 \*\*2 个\*\*明确的独立使用点/)
  assert.match(skill, /按领域边界而非物理交集提升/)
  assert.match(skill, /公共代码应直接进入全局 `@\/components`、`@\/utils`、`@\/composables`、`@\/constants` 或 `@\/types`；Monorepo 场景则进入 workspace package/)
  assert.match(skill, /@\/components\/DataTable\/src\/composables\/use-table-sort/)
  assert.match(skill, /@\/components\/DataTable/)
  assert.doesNotMatch(skill, /允许：\n\n```ts\nimport \{ formatDate \} from '@\/components\/DataTable\/utils'/)
  assert.match(skill, /node scripts\/verify-rules\.mjs hoist --target src\/utils\/order-formatters --uses/)
  assert.match(skill, /共享边界/)
})

it('前端编码规范 - 约束实现质量但不机械抽离', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')

  assert.match(skill, /状态就近/)
  assert.match(skill, /逻辑贴近使用点/)
  assert.match(skill, /私有逻辑默认留在组件或模块内部/)
  assert.match(skill, /只有复用、测试或复杂度收益明确时才抽到 hook、composable 或普通函数/)
  assert.match(skill, /涉及浏览器、时间、随机数、网络和存储时显式表达依赖和失败语义/)
  assert.match(skill, /注释解释意图/)
  assert.match(skill, /不复述实现步骤/)
  assert.match(skill, /不要因为文件变长就机械拆分/)
  assert.doesNotMatch(skill, /复杂副作用必须/)
  assert.match(skill, /是否检查了简单组件的\*\*物理边界阈值\*\*/)
  assert.match(skill, /是否检查了\*\*文件命名约束\*\*/)
  assert.match(skill, /状态清理契约/)
  assert.match(skill, /sideEffects/)
  assert.match(skill, /peerDependencies/)
  assert.match(skill, /公共代码是否按照\*\*领域边界\*\*正确提升/)
  assert.match(skill, /结构校验脚本的 `PASS`.*实现整体 `PASS`/)
  assert.match(skill, /是否先写了目标分类/)
  assert.match(skill, /每个问题是否都包含规则点、证据、问题说明和可执行改动建议/)
  assert.match(skill, /是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证/)
})

it('前端编码规范 - README 描述同步 Vue 与 React 范围', () => {
  const readme = readProjectFile('README.md')
  const readmeZh = readProjectFile('README-zh.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(readme, /Vue 3 and React TypeScript\/JavaScript frontend code standards for components, modules, utility libraries, UI component libraries, review output, and delivery checks/)
  assert.match(readme, /frontend-code-standard/)
  assert.match(readmeZh, /Vue 3 与 React TypeScript\/JavaScript 前端编码标准：统一组件、模块、工具库和 UI 组件库规则，覆盖评审输出、边界、导出、import 路径、类型契约与交付检查/)
  assert.match(readmeZh, /frontend-code-standard/)
  assert.match(readme, /frontend-code-standard\//)
  assert.match(readmeZh, /frontend-code-standard\//)
  assert.match(workflowSkill, /前端编码标准：`frontend-code-standard`/)
  assert.match(workflowSkill, /新建、编写、重构、拆分、优化、评审或校验 Vue\/React 前端组件/)
  assert.doesNotMatch(readme, /frontend-review-standard|frontend-testing-standard|frontend-library-standard|vue-component-standard|react-component-standard|vue-module-standard|react-module-standard/)
  assert.doesNotMatch(readmeZh, /frontend-review-standard|frontend-testing-standard|frontend-library-standard|vue-component-standard|react-component-standard|vue-module-standard|react-module-standard/)
})

it('node 编码规范 - 入口引用 Node 后端实现标准', () => {
  const skill = readProjectFile('skills', 'workflow', 'node-code-standard', 'SKILL.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(skill, /Node\.js/)
  assert.match(skill, /TypeScript 与 JavaScript/)
  assert.match(skill, /用于新建、编写、重构、拆分、优化、评审或校验非 NestJS 的 Node\.js 后端代码/)
  assert.match(skill, /不面向兼容式修补/)
  assert.match(skill, /## 示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.match(skill, /src\/modules\/orders\//)
  assert.match(skill, /FastifyInstance/)
  assert.match(skill, /zod/)
  assert.match(skill, /Service 只做用例编排与事务边界/)
  assert.match(skill, /repository 负责持久化访问和映射/)
  assert.match(skill, /目标分类：`application-module`/)
  assert.match(skill, /总结论：`FAIL`/)
  assert.match(skill, /契约优先/)
  assert.match(skill, /边界清晰/)
  assert.match(skill, /失败显性/)
  assert.match(skill, /按领域边界提升/)
  assert.match(skill, /Zod、Valibot、TypeBox、AJV/)
  assert.match(skill, /Prisma Migrate、Drizzle Kit、Knex migration、TypeORM migration 或 Sequelize migration/)
  assert.match(skill, /目标分类/)
  assert.match(skill, /`entrypoint`/)
  assert.match(skill, /`transport-module`/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.doesNotMatch(skill, /vertical-slice-backend-standard\.md/)
  assert.doesNotMatch(skill, /nest-backend-standard\.md/)
  assert.match(workflowSkill, /Node\.js 后端实现标准：`node-code-standard`/)
  assert.match(workflowSkill, /非 NestJS 的 Node\.js\/TypeScript\/JavaScript 后端代码/)
  assert.match(workflowSkill, /NestJS 后端实现标准：`nestjs-code-standard`/)
  assert.match(workflowSkill, /Java 后端实现标准：`java-code-standard`/)
})

it('node 编码规范 - skill 自带验证脚本覆盖领域边界风险扫描', () => {
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
    /PASS backend hoist domain-boundary scan completed/,
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

  assert.equal(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stdout, /\[HOIST_WARNING\]/)
  assert.match(nestedHoistResult.stdout, /PASS backend hoist domain-boundary scan completed/)
})

it('node 编码规范 - skill 自身承载示例与清单', () => {
  const skill = readProjectFile('skills', 'workflow', 'node-code-standard', 'SKILL.md')

  assert.match(skill, /## 示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.match(skill, /src\/modules\/orders\//)
  assert.match(skill, /transport\//)
  assert.match(skill, /application\//)
  assert.match(skill, /domain\//)
  assert.match(skill, /infrastructure\//)
  assert.match(skill, /FastifyInstance/)
  assert.match(skill, /zod/)
  assert.match(skill, /Service 只做用例编排与事务边界/)
  assert.match(skill, /repository 负责持久化访问和映射/)
  assert.match(skill, /schema 方案/)
  assert.match(skill, /构造参数、工厂参数或模块装配/)
  assert.match(skill, /事务要求/)
  assert.match(skill, /脚本 `PASS` 只代表扫描完成/)
  assert.match(skill, /\[HOIST_WARNING\]/)
})

it('node 编码规范 - 不再保留 references 主规范', () => {
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'node-code-standard', 'references', 'vertical-slice-backend-standard.md')))
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'node-code-standard', 'references', 'nest-backend-standard.md')))
})

it('nestJS 编码规范 - 入口引用 NestJS 最佳实践', () => {
  const skill = readProjectFile('skills', 'workflow', 'nestjs-code-standard', 'SKILL.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(skill, /NestJS/)
  assert.match(skill, /用于新建、编写、重构、拆分、优化、评审或校验 NestJS 后端代码/)
  assert.match(skill, /DTO 校验/)
  assert.match(skill, /唯一规则源/)
  assert.match(skill, /ValidationPipe/)
  assert.match(skill, /class-validator/)
  assert.match(skill, /构造函数注入/)
  assert.match(skill, /事务边界/)
  assert.match(skill, /持久化封装/)
  assert.match(skill, /## 示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.match(skill, /src\/modules\/orders\//)
  assert.match(skill, /orders\.module\.ts/)
  assert.match(skill, /@Module/)
  assert.match(skill, /目标分类：`application-module`/)
  assert.match(skill, /总结论：`FAIL`/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.doesNotMatch(skill, /nest-backend-standard\.md/)
  assert.match(workflowSkill, /NestJS 后端实现标准：`nestjs-code-standard`/)
  assert.match(workflowSkill, /新建、编写、重构、拆分、优化、评审或校验 NestJS 后端代码/)
})

it('nestJS 编码规范 - skill 自身承载示例与清单', () => {
  const skill = readProjectFile('skills', 'workflow', 'nestjs-code-standard', 'SKILL.md')

  assert.match(skill, /## 示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.match(skill, /src\/modules\/orders\//)
  assert.match(skill, /orders\.module\.ts/)
  assert.match(skill, /@Module/)
  assert.match(skill, /ValidationPipe/)
  assert.match(skill, /class-validator/)
  assert.match(skill, /Service 只做用例编排与事务边界/)
  assert.match(skill, /repository 负责持久化访问和映射/)
  assert.match(skill, /构造函数注入/)
  assert.match(skill, /事务要求/)
  assert.match(skill, /\[HOIST_WARNING\]/)
})

it('nestJS 编码规范 - skill 自带验证脚本覆盖领域边界风险扫描', () => {
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
    /PASS nestjs hoist domain-boundary scan completed/,
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

  assert.equal(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stdout, /\[HOIST_WARNING\]/)
  assert.match(nestedHoistResult.stdout, /PASS nestjs hoist domain-boundary scan completed/)
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
  assert.match(skill, /用于新建、编写、重构、拆分、优化、评审或校验 Java 与 Spring Boot 后端代码/)
  assert.match(skill, /Maven/)
  assert.match(skill, /Gradle/)
  assert.match(skill, /唯一规则源/)
  assert.match(skill, /## 示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.match(skill, /src\/main\/java\/com\/example\/order\//)
  assert.match(skill, /record CreateOrderRequest/)
  assert.match(skill, /@ConfigurationProperties/)
  assert.match(skill, /目标分类：`application-module`/)
  assert.match(skill, /总结论：`FAIL`/)
  assert.doesNotMatch(skill, /java-backend-standard\.md/)
  assert.match(skill, /构造函数注入/)
  assert.match(skill, /Bean Validation/)
  assert.match(skill, /ControllerAdvice/)
  assert.match(skill, /Flyway/)
  assert.match(skill, /Liquibase/)
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /不得用仓库根级共享脚本替代/)
  assert.match(workflowSkill, /Java 后端实现标准：`java-code-standard`/)
  assert.match(workflowSkill, /新建、编写、重构、拆分、优化、评审或校验 Java\/Spring Boot 后端代码/)
})

it('java 编码规范 - skill 自身承载示例与清单', () => {
  const skill = readProjectFile('skills', 'workflow', 'java-code-standard', 'SKILL.md')

  assert.match(skill, /## 示例/)
  assert.match(skill, /## 检查清单/)
  assert.match(skill, /## 自校验脚本/)
  assert.ok(skill.includes('src/main/java/com/example/order/\n  api/\n    OrderController.java\n    request/\n      CreateOrderRequest.java\n    response/\n      OrderResponse.java'))
  assert.match(skill, /domain\//)
  assert.match(skill, /application\//)
  assert.match(skill, /infrastructure\//)
  assert.match(skill, /record CreateOrderRequest/)
  assert.match(skill, /@ConfigurationProperties/)
  assert.match(skill, /jakarta\.validation/)
  assert.match(skill, /Flyway 或 Liquibase/)
  assert.match(skill, /领域边界/)
  assert.match(skill, /\[HOIST_WARNING\]/)
})

it('java 编码规范 - skill 自带验证脚本覆盖领域边界风险扫描', () => {
  const scriptPath = path.join(rootDir, 'skills', 'workflow', 'java-code-standard', 'scripts', 'verify-rules.mjs')

  assert.ok(fs.existsSync(scriptPath))
  assert.match(runNodeScript('skills', 'workflow', 'java-code-standard', 'scripts', 'verify-rules.mjs'), /PASS java-code-standard self rules are valid/)
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'hoist',
      '--target',
      'src/main/java/com/example/order/shared',
      '--uses',
      'src/main/java/com/example/order/create/CreateOrderService.java',
      'src/main/java/com/example/order/update/UpdateOrderService.java',
      'src/main/java/com/example/order/cancel/CancelOrderService.java',
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS java hoist domain-boundary scan completed/,
  )
  const nestedHoistResult = spawnSync(process.execPath, [
    scriptPath,
    'hoist',
    '--target',
    'src/main/java/com/example/order/create/shared',
    '--uses',
    'src/main/java/com/example/order/create/CreateOrderService.java',
    'src/main/java/com/example/order/update/UpdateOrderService.java',
    'src/main/java/com/example/order/cancel/CancelOrderService.java',
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.equal(nestedHoistResult.status, 0)
  assert.match(nestedHoistResult.stdout, /\[HOIST_WARNING\]/)
  assert.match(nestedHoistResult.stdout, /PASS java hoist domain-boundary scan completed/)
})

it('workflow 流程规范 - SKILL.md 收敛验证分级和交付报告', () => {
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.match(workflowSkill, /软件开发流程规范/)
  assert.match(workflowSkill, /任务拆分、验证分级和交付报告都收在本文件内/)
  assert.match(workflowSkill, /## 质量门/)
  assert.match(workflowSkill, /## 任务拆分/)
  assert.match(workflowSkill, /## 交付报告/)
  assert.match(workflowSkill, /验证分级/)
  assert.match(workflowSkill, /场景化报告/)
  assert.match(workflowSkill, /PASS `git diff --check`/)
  assert.match(workflowSkill, /N\/A 质量检查：本次未修改代码。/)
  assert.doesNotMatch(workflowSkill, /examples\/|validation\//)
})

it('skill 校验规范 - 仅校验 YAML frontmatter 和正文结构', () => {
  const skill = readProjectFile('skills', 'skill-validation-standard', 'SKILL.md')
  const scriptPath = path.join(rootDir, 'skills', 'skill-validation-standard', 'scripts', 'verify-rules.mjs')

  assert.match(skill, /YAML frontmatter/)
  assert.match(skill, /正文/)
  assert.doesNotMatch(skill, /资源组织/)
  assert.doesNotMatch(skill, /脚本语义/)
  assert.doesNotMatch(skill, /examples\/|validation\/|deep reference|script semantics/)
  assert.match(runNodeScript('skills', 'skill-validation-standard', 'scripts', 'verify-rules.mjs'), /PASS skill body and YAML are valid/)

  const validSkillTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-valid-skill-'))
  const validSkillRoot = path.join(validSkillTemp, 'minimal-skill')
  fs.mkdirSync(validSkillRoot)
  fs.writeFileSync(path.join(validSkillRoot, 'SKILL.md'), [
    '---',
    'name: minimal-skill',
    'description: 校验示例 skill 的 YAML 和正文。用于测试 skill 校验器。',
    '---',
    '',
    '# Minimal Skill',
    '',
    '只提供最小正文。',
  ].join('\n'))
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      '--root',
      validSkillRoot,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS skill body and YAML are valid/,
  )

  const invalidSkillTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-invalid-skill-'))
  const invalidSkillRoot = path.join(invalidSkillTemp, 'broken-skill')
  fs.mkdirSync(invalidSkillRoot)
  fs.writeFileSync(path.join(invalidSkillRoot, 'SKILL.md'), [
    '---',
    'name: broken-skill',
    'description: 缺少结束分隔符。',
    '',
    '# Broken Skill',
  ].join('\n'))

  const invalidResult = spawnSync(process.execPath, [
    scriptPath,
    '--root',
    invalidSkillRoot,
  ], { cwd: rootDir, encoding: 'utf8' })
  assert.notEqual(invalidResult.status, 0)
  assert.match(invalidResult.stdout, /缺少 YAML frontmatter 结束标记/)
})
