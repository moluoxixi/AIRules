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
  assert.match(agents, /代码注释只说明作用、边界和约束/)
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

it('前端编码规范 - 入口只引用 Vue 3 与 TypeScript 分形架构规范', () => {
  const skill = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'SKILL.md')

  assert.match(skill, /Vue 3 与 TypeScript/)
  assert.match(skill, /分形架构/)
  assert.match(skill, /特性驱动/)
  assert.match(skill, /fractal-frontend-standard\.md/)
  assert.match(skill, /前端编码与目录创建不可拆开理解/)
  assert.match(skill, /禁止扁平化/)
  assert.match(skill, /Deep Imports 零容忍/)
  assert.match(skill, /状态局部闭环/)
  assert.match(skill, /依赖自上而下/)
  assert.doesNotMatch(skill, /React|react\.md|typescript-javascript\.md|directory-structure\.md|common\.md|vue\.md/)
})

it('前端编码规范 - 单文件主规范同时覆盖目录和编码约束', () => {
  const standard = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'references', 'fractal-frontend-standard.md').replace(/\r\n/g, '\n')

  assert.match(standard, /## 1\. 核心原则：分形递归与就近原则/)
  assert.match(standard, /复杂组件（如 `components\/DataTable`）/)
  assert.match(standard, /业务模块（如 `views\/purchaseOrder`）/)
  assert.match(standard, /## 2\. 标准模块骨架/)
  assert.ok(standard.includes('[ModuleName]/\n  index.vue\n  api/\n    index.ts\n  components/\n    index.ts\n  composables/\n    index.ts\n  constants/\n    index.ts\n  types/\n    index.ts\n  utils/\n    index.ts\n  index.ts'))
  assert.ok(standard.includes('AuditDialog/\n        index.vue\n        api/'))
  assert.ok(standard.includes('DataTable/\n    index.vue\n    api/'))
  assert.match(standard, /## 4\. 强制统一导出原则/)
  assert.match(standard, /## 5\. Deep Imports 零容忍/)
  assert.match(standard, /## 6\. 高内聚与三次法则/)
  assert.match(standard, /## 7\. 依赖流向限制/)
  assert.ok(!standard.includes('views/ or pages/ or modules/'))
  assert.ok(!standard.includes('README.md\n  index.ts\n  src/'))
  assert.ok(!standard.includes('columnSettings'))
})

it('前端编码规范 - Vue 类型按 props emit expose 拆分', () => {
  const standard = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'references', 'fractal-frontend-standard.md')

  assert.match(standard, /复杂 Vue 组件的类型必须从视图文件中抽离/)
  assert.match(standard, /props\.ts/)
  assert.match(standard, /emit\.ts/)
  assert.match(standard, /expose\.ts/)
  assert.match(standard, /defineExpose/)
  assert.match(standard, /import type \{ AuditDialogProps \} from '\.\/types'/)
  assert.match(standard, /不得穿透到具体类型文件/)
})

it('前端编码规范 - Barrel、三次法则和依赖流向为硬约束', () => {
  const standard = readProjectFile('skills', 'workflow', 'frontend-code-standard', 'references', 'fractal-frontend-standard.md')

  assert.match(standard, /任意层级下的功能集目录/)
  assert.match(standard, /必须提供 `index\.ts` 作为该目录唯一对外 API 入口/)
  assert.match(standard, /Deep Imports 零容忍/)
  assert.match(standard, /import \{ formatDate \} from '\.\.\/\.\.\/utils'/)
  assert.match(standard, /至少 3 个完全不同的顶层模块/)
  assert.match(standard, /src\/stores/)
  assert.match(standard, /自上而下/)
  assert.match(standard, /禁止同级跨域/)
  assert.match(standard, /执行自检/)
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
