#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
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
const docsRoot = path.join(projectRoot, 'docs')
const includeComponents = stacks.has('component-consumer')
// 视觉设计输入目录（docs/design/）仅对含 UI 的前端 stack 创建；纯后端/纯文档仓库不创建。
const includeDesign = ['frontend', 'vue', 'component-consumer', 'component-library'].some(stack => stacks.has(stack))
archiveExistingDocs(docsRoot, collectArchiveCandidates(docsRoot))

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
        title: '外部组件库文档索引',
        description: '记录本项目消费的外部组件库、Design System 或 UI SDK 的使用约束、组件契约和版本来源。',
        columns: '| 组件库/组件 | 文档 | 来源 | 状态 |\n|---|---|---|---|',
      }
    : null,
  includeDesign
    ? {
        name: 'design',
        title: '视觉设计输入索引',
        description: '记录由用户设计稿（Figma/截图/设计规范）转写的前端视觉事实源：布局区域、设计 token、组件状态四态、响应式断点和可访问性意图。视觉规格的权威源是设计稿，缺失项标 MISSING，不脑补。',
        columns: '| 业务域 | 文档 | 视觉范围 | 来源设计稿 | 状态 |\n|---|---|---|---|---|',
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
  {
    name: 'other',
    title: '其它文档索引',
    description: '登记初始化前已存在但尚未归入架构、接口、需求、组件库或测试目录的项目文档。',
    columns: '| 文档 | 类型 | 建议处理 | 状态 |\n|---|---|---|---|',
  },
].filter(Boolean)
const importedDocs = collectImportedDocs(docsRoot)

mkdirSync(docsRoot, { recursive: true })

for (const section of sections) {
  const sectionDir = path.join(docsRoot, section.name)
  mkdirSync(sectionDir, { recursive: true })

  const indexPath = path.join(sectionDir, 'index.md')
  if (section.name === 'other') {
    writeOrAppendOtherIndex(indexPath, section, importedDocs)
  }
  else {
    writeIfMissing(indexPath, indexTemplate(section))
  }
}

writeIfMissing(path.join(docsRoot, 'architecture', 'overview.md'), architectureOverviewTemplate())
mkdirSync(path.join(docsRoot, 'architecture', 'decisions'), { recursive: true })
writeIfMissing(path.join(docsRoot, 'architecture', 'decisions', 'index.md'), architectureDecisionsIndexTemplate())
writeIfMissing(path.join(docsRoot, 'api', '_protocol.md'), apiProtocolTemplate())
writeOrAppendMap(path.join(docsRoot, 'map.md'), sections)
writeIfMissing(path.join(projectRoot, 'airules.knowledge.json'), knowledgeSourceRegistryTemplate())

console.log(`[airules] Scaffolded docs in ${docsRoot}`)

function writeIfMissing(filePath, content) {
  if (existsSync(filePath)) {
    return
  }

  writeFileSync(filePath, content, 'utf8')
}

function writeOrAppendOtherIndex(filePath, section, importedDocs) {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, otherIndexTemplate(section, importedDocs), 'utf8')
    return
  }

  const content = readFileSync(filePath, 'utf8')
  const rows = importedDocs
    .filter(entry => !content.includes(entry.linkPath))
    .map(otherRow)

  appendRowsIfNeeded(filePath, content, 'AIRules 待整理文档补充', section.columns, rows)
}

function writeOrAppendMap(filePath, enabledSections) {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, mapTemplate(enabledSections), 'utf8')
    return
  }

  const content = readFileSync(filePath, 'utf8')
  const rows = enabledSections
    .filter(section => !mapContainsSection(content, section.name))
    .map(mapRow)

  appendRowsIfNeeded(filePath, content, 'AIRules 文档入口补充', '| 目录 | 索引 | 用途 |\n|---|---|---|', rows)
  appendKnowledgeSourceEntryIfNeeded(filePath)
}

function appendRowsIfNeeded(filePath, content, title, columns, rows) {
  if (rows.length === 0) {
    return
  }

  // Existing docs are user-owned, so initialization only appends missing inventory rows.
  const separator = content.endsWith('\n') ? '\n' : '\n\n'
  const addition = `${separator}## ${title}\n\n${columns}\n${rows.join('\n')}\n`
  writeFileSync(filePath, `${content}${addition}`, 'utf8')
}

function appendKnowledgeSourceEntryIfNeeded(filePath) {
  const content = readFileSync(filePath, 'utf8')
  if (content.includes('airules.knowledge.json')) {
    return
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n'
  writeFileSync(filePath, `${content}${separator}${knowledgeSourceMapSection()}`, 'utf8')
}

function collectArchiveCandidates(sourceDir) {
  if (!existsSync(sourceDir)) {
    return []
  }

  const standardNames = new Set(['architecture', 'api', 'out-api', 'out-components', 'prds', 'test', 'map.md'])
  if (includeComponents) {
    standardNames.add('components')
  }
  if (includeDesign) {
    standardNames.add('design')
  }
  // These directories are reference inputs, not legacy project docs to convert.
  const preservedNames = new Set(['other', 'superpowers'])

  return readdirSync(sourceDir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .filter(entry => !preservedNames.has(entry.name))
    .filter(entry => !standardNames.has(entry.name))
    .map(entry => ({
      name: entry.name,
      kind: entry.isDirectory() ? 'directory' : 'file',
      sourcePath: path.join(sourceDir, entry.name),
      targetPath: path.join(sourceDir, 'other', 'imported', entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function archiveExistingDocs(sourceDir, archiveCandidates) {
  if (archiveCandidates.length === 0) {
    return
  }

  const collision = archiveCandidates.find(entry => existsSync(entry.targetPath))
  if (collision) {
    throw new Error(`Imported docs target already exists: ${collision.targetPath}`)
  }

  mkdirSync(path.join(sourceDir, 'other', 'imported'), { recursive: true })

  for (const entry of archiveCandidates) {
    renameSync(entry.sourcePath, entry.targetPath)
  }
}

function collectImportedDocs(sourceDir) {
  const importedRoot = path.join(sourceDir, 'other', 'imported')
  if (!existsSync(importedRoot)) {
    return []
  }

  return readdirSync(importedRoot, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .map(entry => ({
      name: entry.name,
      kind: entry.isDirectory() ? 'directory' : 'file',
      linkPath: `imported/${entry.name}`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function mapContainsSection(content, sectionName) {
  return content.includes(`${sectionName}/index.md`) || content.includes(`docs/${sectionName}/index.md`)
}

function indexTemplate(section) {
  return `# ${section.title}

${section.description}

${section.columns}
`
}

function otherIndexTemplate(section, importedDocs) {
  const rows = importedDocs
    .map(otherRow)
    .join('\n')
  const rowSection = rows ? `\n${rows}` : ''

  return `# ${section.title}

${section.description}

${section.columns}${rowSection}
`
}

function otherRow(entry) {
  return `| [${entry.name}](${entry.linkPath}) | ${entry.kind} | 转换为 architecture/api/prds/test 标准文档；组件库旧文档由 components-docs 判断后转换到 docs/components 或 docs/out-components | MISSING conversion |`
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

function knowledgeSourceRegistryTemplate() {
  const registry = {
    version: 1,
    sources: [
      {
        id: 'repo-overview',
        type: 'filesystem',
        include: ['README.md', 'README-zh.md', 'AGENTS.md', 'CLAUDE.md'],
        exclude: ['vendor/**', 'node_modules/**', 'dist/**', 'coverage/**', '.git/**', '.codegraph/**'],
        purpose: 'project-overview',
        owner: 'project-maintainer',
        trust: 'registered',
      },
      {
        id: 'repo-docs',
        type: 'filesystem',
        include: ['docs/**'],
        exclude: ['vendor/**', 'node_modules/**', 'dist/**', 'coverage/**', '.git/**', '.codegraph/**'],
        purpose: 'project-docs',
        owner: 'project-maintainer',
        trust: 'registered',
      },
    ],
  }

  return `${JSON.stringify(registry, null, 2)}\n`
}

function mapTemplate(enabledSections) {
  const rows = enabledSections
    .map(mapRow)
    .join('\n')

  return `# 项目文档地图

## 文档入口

| 目录 | 索引 | 用途 |
|---|---|---|
${rows}

${knowledgeSourceMapSection()}

## 维护约定

- 新增业务文档时，使用稳定业务名作为文件名，例如 \`采购订单.md\`。
- 架构文档放入 \`docs/architecture/\`，接口文档放入 \`docs/api/\`，需求文档放入 \`docs/prds/\`，测试文档放入 \`docs/test/\`${includeComponents ? '，外部组件库消费文档放入 `docs/components/`' : ''}。
- 对外复用产物由对应 skill 生成：组件库契约写入 \`docs/out-components/\`，API 契约写入 \`docs/out-api/\`。
- 项目知识检索优先读取根目录 \`airules.knowledge.json\`；标准 docs 是可审计输出层，不是用户资料的唯一输入格式。
- 初始化前已存在的旧文档归档到 \`docs/other/imported/\`；整理时先评估归属，再转换为标准分类文档。
- 全局接口协议维护在 \`docs/api/_protocol.md\`；业务接口文档不得重复定义冲突协议。
- 新增或改名文档后，同步更新对应目录的 \`index.md\` 和本文件。
- 文档只记录已确认事实；缺失信息标记为 \`MISSING\`，不得用代码推断伪造业务结论。
`
}

function knowledgeSourceMapSection() {
  return `## 知识源入口

| 文件 | 用途 | 状态 |
|---|---|---|
| [airules.knowledge.json](../airules.knowledge.json) | 登记可被 AI 检索的项目知识源；当前仅支持文件系统来源，非文件系统来源必须先实现安装、查询和校验合同。 | managed |
`
}

function mapRow(section) {
  return `| ${section.name} | [${section.title}](${section.name}/index.md) | ${section.description} |`
}
