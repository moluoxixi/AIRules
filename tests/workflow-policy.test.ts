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
  assert.match(skill, /scripts\/verify-rules\.mjs/)
  assert.match(skill, /不得用仓库根级共享脚本替代/)
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
  assert.ok(standard.includes('[ModuleName]/\n  index.vue (或 index.tsx) - [必填] UI 视图/组件入口，仅负责渲染和组装\n  api/ - [可选] 仅限本模块调用的接口定义\n  components/ - [可选] 模块私有子组件（可继续递归此结构）'))
  assert.ok(standard.includes('composables/ (Vue) 或 hooks/ (React) - [可选] 模块私有状态与无头业务逻辑'))
  assert.match(standard, /React 模块使用同一结构/)
  assert.ok(standard.includes('AuditDialog/\n        index.vue\n        api/\n          index.ts\n        components/\n          index.ts\n        composables/'))
  assert.ok(standard.includes('DataTable/\n  README.md - [必填] 描述组件用途、使用方式和 Props/Events/Expose/Slots 等接口契约\n  index.ts 或 index.js - [必填] 组件包唯一公共出口\n  src/ - [必填] 组件真实实现目录'))
  assert.match(standard, /禁止穿透 `src\/` 引用组件内部实现/)
  assert.match(standard, /## 4\. 强制统一导出与路径别名优先/)
  assert.match(standard, /## 5\. 高内聚、三次原则与逐级上浮/)
  assert.match(standard, /依赖流向限制/)
  assert.ok(!standard.includes('views/ or pages/ or modules/'))
  assert.ok(!standard.includes('columnSettings'))
})

it('前端编码规范 - skill 自带验证脚本覆盖组件结构和最近公共父级', () => {
  const scriptPath = path.join(rootDir, 'skills', 'workflow', 'frontend-code-standard', 'scripts', 'verify-rules.mjs')
  const componentRootTs = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-ts-'))
  const componentRootJs = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-js-'))
  const componentRootDuplicate = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-component-dupe-'))

  fs.writeFileSync(path.join(componentRootTs, 'README.md'), '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  fs.writeFileSync(path.join(componentRootTs, 'index.ts'), 'export * from \'./src\'\n')
  fs.mkdirSync(path.join(componentRootTs, 'src'))

  fs.writeFileSync(path.join(componentRootJs, 'README.md'), '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  fs.writeFileSync(path.join(componentRootJs, 'index.js'), 'export * from \'./src/index.js\'\n')
  fs.mkdirSync(path.join(componentRootJs, 'src'))

  fs.writeFileSync(path.join(componentRootDuplicate, 'README.md'), '# DataTable\n\n## Usage\n\nProps and Events are documented here.\n')
  fs.writeFileSync(path.join(componentRootDuplicate, 'index.ts'), 'export * from \'./src\'\n')
  fs.writeFileSync(path.join(componentRootDuplicate, 'index.js'), 'export * from \'./src/index.js\'\n')
  fs.mkdirSync(path.join(componentRootDuplicate, 'src'))

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
    /PASS frontend component package structure is valid/,
  )
  assert.match(
    execFileSync(process.execPath, [
      scriptPath,
      'component',
      '--root',
      componentRootJs,
    ], { cwd: rootDir, encoding: 'utf8' }),
    /PASS frontend component package structure is valid/,
  )
  const duplicateResult = spawnSync(process.execPath, [
    scriptPath,
    'component',
    '--root',
    componentRootDuplicate,
  ], { cwd: rootDir, encoding: 'utf8' })

  assert.notEqual(duplicateResult.status, 0)
  assert.match(duplicateResult.stderr, /只能存在一个公共入口：index\.ts 或 index\.js/)
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
  assert.match(standard, /## 4\. 强制统一导出与路径别名优先/)
  assert.match(standard, /@\/modules\/orders\/service/)
  assert.match(standard, /@\/modules\/orders/)
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
  assert.match(standard, /## 4\. 强制统一导出与路径别名优先/)
  assert.match(standard, /@\/modules\/orders\/orders\.module/)
  assert.match(standard, /@\/modules\/orders/)
  assert.match(standard, /@Module\(\{ exports: \[\.\.\.\] \}\)/)
  assert.match(standard, /## 5\. 高内聚、三次原则与逐级上浮/)
  assert.match(standard, /Guard、Interceptor、Pipe/)
  assert.match(standard, /modules\/orders\/pipes\//)
  assert.match(standard, /src\/common\//)
  assert.match(standard, /## 6\. 注释与异常处理规范/)
  assert.match(standard, /Service 层的类方法必须包含 JSDoc 注释/)
  assert.match(standard, /BadRequestException/)
  assert.match(standard, /Controller 层无需手动 `try-catch`/)
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
  assert.match(readme, /backend-code-standard/)
  assert.match(readme, /Node\.js backend code standards/)
  assert.match(readme, /NestJS/)
  assert.match(readme, /strict DI/)
  assert.match(readmeZh, /backend-code-standard/)
  assert.match(readmeZh, /Node\.js 后端编码标准/)
  assert.match(readmeZh, /NestJS/)
  assert.match(readmeZh, /严格 DI/)
  assert.doesNotMatch(readme, /backend-testing-standard/)
  assert.doesNotMatch(readmeZh, /backend-testing-standard/)
  assert.doesNotMatch(workflowSkill, /`backend-testing-standard`/)
})
