#!/usr/bin/env node
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [projectRootArg, ...stackArgs] = process.argv.slice(2)

if (!projectRootArg) {
  throw new Error('Usage: scaffold-docs.mjs <project-root> [stack ...]')
}

const projectRoot = path.resolve(projectRootArg)

if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
  throw new Error(`Project root must be an existing directory: ${projectRoot}`)
}

const stacks = new Set(stackArgs)
const includeComponents = stacks.has('frontend')
const docsRoot = path.join(projectRoot, 'docs')
const sections = [
  {
    name: 'architecture',
    title: '架构文档索引',
    description: '记录项目架构、模块边界、分层、数据流、权限模型、部署关系和架构决策。',
    columns: '| 文档 | 用途 | 状态 |\n|---|---|---|',
  },
  {
    name: 'api',
    title: '接口文档索引',
    description: '记录全局接口协议、业务接口契约、联调状态、请求响应示例、错误码和上下游依赖。',
    columns: '| 业务域 | 文档 | 接口范围 | 状态 |\n|---|---|---|---|',
  },
  includeComponents
    ? {
        name: 'components',
        title: '组件文档索引',
        description: '记录组件库契约、交互状态、Props/Events/Slots、可访问性和示例。',
        columns: '| 组件 | 文档 | 使用场景 | 状态 |\n|---|---|---|---|',
      }
    : null,
  {
    name: 'prds',
    title: '需求文档索引',
    description: '记录业务背景、目标、范围、流程、字段口径、验收标准和变更历史。',
    columns: '| 业务域 | 文档 | 需求范围 | 状态 |\n|---|---|---|---|',
  },
  {
    name: 'test',
    title: '测试文档索引',
    description: '记录测试策略、用例矩阵、数据准备、联调验证、回归范围和风险。',
    columns: '| 业务域 | 文档 | 测试范围 | 状态 |\n|---|---|---|---|',
  },
].filter(Boolean)

mkdirSync(docsRoot, { recursive: true })

for (const section of sections) {
  const sectionDir = path.join(docsRoot, section.name)
  mkdirSync(sectionDir, { recursive: true })
  writeIfMissing(path.join(sectionDir, 'index.md'), indexTemplate(section))
}

writeIfMissing(path.join(docsRoot, 'architecture', 'overview.md'), architectureOverviewTemplate())
mkdirSync(path.join(docsRoot, 'architecture', 'decisions'), { recursive: true })
writeIfMissing(path.join(docsRoot, 'architecture', 'decisions', 'index.md'), architectureDecisionsIndexTemplate())
writeIfMissing(path.join(docsRoot, 'api', '_protocol.md'), apiProtocolTemplate())
writeIfMissing(path.join(docsRoot, 'map.md'), mapTemplate(sections))

console.log(`[airules] Scaffolded docs in ${docsRoot}`)

function writeIfMissing(filePath, content) {
  if (existsSync(filePath)) {
    return
  }

  writeFileSync(filePath, content, 'utf8')
}

function indexTemplate(section) {
  return `# ${section.title}

${section.description}

${section.columns}

`
}

function architectureOverviewTemplate() {
  return `# 项目架构概览

## 架构目标

MISSING

## 模块边界

| 模块 | 职责 | 上游 | 下游 | 所有者 |
|---|---|---|---|---|

## 分层与依赖规则

MISSING

## 数据流

MISSING

## 权限与安全边界

MISSING

## 部署与运行时

MISSING

## 待确认

- MISSING

`
}

function architectureDecisionsIndexTemplate() {
  return `# 架构决策记录索引

记录影响模块边界、技术选型、接口协议、数据模型、部署拓扑或长期演进成本的架构决策。

| ADR | 决策 | 状态 | 日期 |
|---|---|---|---|

`
}

function apiProtocolTemplate() {
  return `# 全局接口协议

## 适用范围

MISSING

## 成功响应

- HTTP 状态码必须表达第一层结果语义。
- 单资源查询返回资源对象；列表查询返回对象结构，预留分页和元信息。
- 命令型接口返回稳定结果字段；无内容操作可使用 204。

## 列表分页

| 字段 | 类型 | 说明 |
|---|---|---|
| items | array | 当前页数据 |
| page | object | 分页信息 |

## 错误响应

错误响应优先采用稳定、机器可读的结构；客户端不得解析人类可读 message 作为业务判断依据。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | string | 是 | 稳定错误码 |
| message | string | 是 | 面向用户或开发者的错误说明 |
| traceId | string | 否 | 请求追踪 ID |
| errors | array | 否 | 字段级或明细错误 |

## 鉴权与 Headers

MISSING

## 版本策略

MISSING

## 待确认

- MISSING

`
}

function mapTemplate(enabledSections) {
  const rows = enabledSections
    .map(section => `| ${section.name} | [${section.title}](${section.name}/index.md) | ${section.description} |`)
    .join('\n')

  return `# 项目文档地图

## 文档入口

| 目录 | 索引 | 用途 |
|---|---|---|
${rows}

## 维护约定

- 新增业务文档时，使用稳定业务名作为文件名，例如 \`采购订单.md\`。
- 架构文档放入 \`docs/architecture/\`，接口文档放入 \`docs/api/\`，需求文档放入 \`docs/prds/\`，测试文档放入 \`docs/test/\`${includeComponents ? '，组件文档放入 `docs/components/`' : ''}。
- 全局接口协议维护在 \`docs/api/_protocol.md\`；业务接口文档不得重复定义冲突协议。
- 新增或改名文档后，同步更新对应目录的 \`index.md\` 和本文件。
- 文档只记录已确认事实；缺失信息标记为 \`MISSING\`，不得用代码推断伪造业务结论。

`
}
