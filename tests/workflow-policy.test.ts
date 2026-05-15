import assert from 'node:assert/strict'
import fs from 'node:fs'
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

it('入口策略 - AGENTS 保留公共硬规则并补充前后端规范边界', () => {
  const agents = readProjectFile('AGENTS.md')

  assert.match(agents, /## 核心规则/)
  assert.match(agents, /禁止防御式编程/)
  assert.match(agents, /禁止错误回退/)
  assert.match(agents, /优先使用成熟库/)
  assert.match(agents, /用户本次消息的主要语言/)
  assert.match(agents, /生成的代码必须包含清晰、专业的注释/)
  assert.match(agents, /零成本理解代码的设计意图、API 契约和业务逻辑/)
  assert.match(agents, /Vue 3 \/ React TypeScript/)
  assert.match(agents, /frontend-code-standard/)
  assert.match(agents, /不重复维护前端目录、组件、类型、导出和 import 细则/)
  assert.match(agents, /后端编码与测试标准尚未提供/)
  assert.match(agents, /不得沿用旧后端规范/)
  assert.match(agents, /质量检查必须按任务场景和风险分级执行/)
  assert.match(agents, /Superpowers、并行子代理、系统化调试、TDD、全量测试、coverage 和构建不得默认触发/)
  assert.match(agents, /检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N\/A`/)
  assert.match(agents, /## 并行子代理/)
  assert.doesNotMatch(agents, /Props 接口|Deep Imports 零容忍|分形架构/)
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
  }

  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(content, legacySectionPattern, `${file} contains legacy English section heading`)
  }
})

it('前端编码规范 - 入口只引用 Vue 3 / React TypeScript 分形架构规范', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')

  assert.match(skill, /Vue 3 或 React TypeScript/)
  assert.match(skill, /分形架构/)
  assert.match(skill, /特性驱动/)
  assert.match(skill, /fractal-frontend-standard\.md/)
  assert.match(skill, /前端编码与目录创建不可拆开理解/)
  assert.match(skill, /Headless/)
  assert.match(skill, /禁止扁平化/)
  assert.match(skill, /路径别名优先/)
  assert.match(skill, /Deep Imports 零容忍/)
  assert.match(skill, /逐级上浮/)
  assert.match(skill, /注释契约/)
  assert.match(skill, /Why over What/)
  assert.doesNotMatch(skill, /react\.md|typescript-javascript\.md|directory-structure\.md|common\.md|vue\.md/)
})

it('前端编码规范 - 单文件主规范同时覆盖目录和编码约束', () => {
  const standard = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'references', 'fractal-frontend-standard.md').replace(/\r\n/g, '\n')

  assert.match(standard, /最高优先级/)
  assert.match(standard, /Vue 3 或 React TypeScript/)
  assert.match(standard, /## 1\. 核心原则：分形递归与就近原则/)
  assert.match(standard, /逻辑与 UI 分离/)
  assert.match(standard, /Headless 模式/)
  assert.match(standard, /## 2\. 目录形态标准/)
  assert.ok(standard.includes('[ModuleName]/\n  index.vue (或 index.tsx) - UI 视图/组件入口，仅负责渲染和组装\n  api/ - 仅限本模块调用的接口定义\n  components/ - 模块私有子组件（可继续递归此结构）'))
  assert.ok(standard.includes('composables/ (Vue) 或 hooks/ (React) - 模块私有状态与无头业务逻辑'))
  assert.match(standard, /React 模块使用同一结构/)
  assert.ok(standard.includes('AuditDialog/\n        index.vue\n        api/\n          index.ts\n        components/\n          index.ts\n        composables/'))
  assert.match(standard, /## 4\. 强制统一导出与路径别名优先/)
  assert.match(standard, /## 5\. 高内聚、三次原则与逐级上浮/)
  assert.match(standard, /## 7\. 依赖流向限制/)
  assert.ok(!standard.includes('views/ or pages/ or modules/'))
  assert.ok(!standard.includes('README.md\n  index.ts\n  src/'))
  assert.ok(!standard.includes('columnSettings'))
})

it('前端编码规范 - 类型按 props expose ref emit 拆分', () => {
  const standard = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'references', 'fractal-frontend-standard.md')

  assert.match(standard, /类型定义必须从视图文件中彻底抽离/)
  assert.match(standard, /props\.ts/)
  assert.match(standard, /ref\.ts/)
  assert.match(standard, /emit\.ts/)
  assert.match(standard, /expose\.ts/)
  assert.match(standard, /仅限 Vue/)
  assert.match(standard, /export type \* from '\.\/props'/)
  assert.match(standard, /export type \* from '\.\/ref'/)
  assert.match(standard, /必须通过此文件统一导出上述所有类型/)
})

it('前端编码规范 - Barrel、路径别名、三次原则和逐级上浮为硬约束', () => {
  const standard = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'references', 'fractal-frontend-standard.md')

  assert.match(standard, /路径别名优先/)
  assert.match(standard, /@\/components\/DataTable\/utils\/date/)
  assert.match(standard, /@\/components\/DataTable\/utils/)
  assert.match(standard, /必须提供一个 `index\.ts` 文件作为唯一对外 API 入口/)
  assert.match(standard, /Deep Imports 零容忍/)
  assert.match(standard, /至少 3 个独立的地方/)
  assert.match(standard, /最近公共父级目录/)
  assert.match(standard, /purchaseOrder\/utils\//)
  assert.match(standard, /进入 `src\/` 根级别的公共目录/)
  assert.match(standard, /自上而下/)
  assert.match(standard, /禁止同级跨域/)
  assert.match(standard, /逐级上浮/)
  assert.match(standard, /AI 执行验证检查清单/)
  assert.match(standard, /没有 3 处以上调用/)
})

it('前端编码规范 - 注释规范要求 JSDoc、Why over What 和响应式副作用说明', () => {
  const standard = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'references', 'fractal-frontend-standard.md')

  assert.match(standard, /## 6\. 注释与代码解释规范/)
  assert.match(standard, /强制 JSDoc 契约/)
  assert.match(standard, /props\.ts/)
  assert.match(standard, /expose\.ts/)
  assert.match(standard, /emit\.ts/)
  assert.match(standard, /字段含义和默认值/)
  assert.match(standard, /Why over What/)
  assert.match(standard, /禁止生成翻译代码的无用注释/)
  assert.match(standard, /watch/)
  assert.match(standard, /watchEffect/)
  assert.match(standard, /useEffect/)
  assert.match(standard, /useMemo/)
  assert.match(standard, /依赖变化原因/)
  assert.match(standard, /闭包边界情况/)
})

it('前端编码规范 - README 描述同步 Vue 与 React 范围', () => {
  const readme = readProjectFile('README.md')
  const readmeZh = readProjectFile('README-zh.md')

  assert.match(readme, /Vue 3 and React TypeScript frontend code standards/)
  assert.match(readme, /path aliases/)
  assert.match(readme, /nearest-common-ancestor hoisting/)
  assert.match(readmeZh, /Vue 3 与 React TypeScript 前端编码标准/)
  assert.match(readmeZh, /路径别名/)
  assert.match(readmeZh, /最近公共父级上浮/)
})

it('后端规范 - 旧后端 skill 暂不分发', () => {
  const readme = readProjectFile('README.md')
  const readmeZh = readProjectFile('README-zh.md')
  const workflowSkill = readProjectFile('skills', 'workflow', 'software-development-workflow', 'SKILL.md')

  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'backend-code-standard', 'SKILL.md')))
  assert.ok(!fs.existsSync(path.join(rootDir, 'skills', 'workflow', 'backend-testing-standard', 'SKILL.md')))
  assert.doesNotMatch(readme, /backend-code-standard|backend-testing-standard/)
  assert.doesNotMatch(readmeZh, /backend-code-standard|backend-testing-standard/)
  assert.doesNotMatch(workflowSkill, /`backend-code-standard`|`backend-testing-standard`/)
  assert.match(workflowSkill, /后端标准尚未提供/)
})
