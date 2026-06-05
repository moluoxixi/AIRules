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
    name: 'api',
    title: '接口文档索引',
    description: '记录接口契约、联调状态、请求响应示例、错误码和上下游依赖。',
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
- 需求文档放入 \`docs/prds/\`，接口文档放入 \`docs/api/\`，测试文档放入 \`docs/test/\`${includeComponents ? '，组件文档放入 `docs/components/`' : ''}。
- 新增或改名文档后，同步更新对应目录的 \`index.md\` 和本文件。
- 文档只记录已确认事实；缺失信息标记为 \`MISSING\`，不得用代码推断伪造业务结论。

`
}
