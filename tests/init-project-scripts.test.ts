import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

function withTempDir<T>(prefix: string, run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function runInjectRules(projectRoot: string, ...references: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'inject-rules.mjs'),
      projectRoot,
      ...references,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function runLinkClaude(projectRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'link-claude.mjs'),
      projectRoot,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function runScaffoldDocs(projectRoot: string, ...stacks: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'skills', 'init-project', 'scripts', 'scaffold-docs.mjs'),
      projectRoot,
      ...stacks,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

function isManagedClaudeLink(agentsPath: string, claudePath: string): boolean {
  const claudeStats = fs.lstatSync(claudePath)

  if (claudeStats.isSymbolicLink()) {
    const linkedPath = path.resolve(path.dirname(claudePath), fs.readlinkSync(claudePath))
    return linkedPath === path.resolve(agentsPath)
  }

  const agentsStats = fs.statSync(agentsPath)
  return agentsStats.dev === claudeStats.dev && agentsStats.ino === claudeStats.ino
}

it('init-project inject-rules - AGENTS.md 不存在时创建聚合规则文件', () => withTempDir('airules-inject-create-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const referenceFile = path.join(tmpDir, 'frontend.md')

  fs.mkdirSync(projectRoot, { recursive: true })
  writeFile(referenceFile, '# Frontend Rules\n\nfrontend body\n')

  const result = runInjectRules(projectRoot, referenceFile)
  const agentsContent = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(agentsContent.startsWith('# 项目规范\n\n## 项目自定义规范\n'), true)
  assert.match(agentsContent, /# 项目文档知识库/)
  assert.match(agentsContent, /# Frontend Rules\n\nfrontend body/)
}))

it('init-project inject-rules - AGENTS.md 已存在且无重复标题时追加规则', () => withTempDir('airules-inject-append-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const referenceFile = path.join(tmpDir, 'node.md')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')

  writeFile(agentsPath, '# Existing Project Rules\n\nexisting body\n')
  writeFile(referenceFile, '# Node Rules\n\nnode body\n')

  const result = runInjectRules(projectRoot, referenceFile)
  const agentsContent = fs.readFileSync(agentsPath, 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(agentsContent.startsWith('# Existing Project Rules\n\nexisting body\n\n# 项目文档知识库\n'), true)
  assert.doesNotMatch(agentsContent, /## 项目自定义规范/)
  assert.match(agentsContent, /# 项目文档知识库/)
  assert.match(agentsContent, /# Node Rules\n\nnode body/)
}))

it('init-project inject-rules - AGENTS.md 标题重复时停止写入并要求 AI 审查', () => withTempDir('airules-inject-duplicate-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const originalContent = '# 项目文档知识库\n\nexisting project docs rules\n'

  writeFile(agentsPath, originalContent)

  const result = runInjectRules(projectRoot)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Duplicate AGENTS\.md headings detected/)
  assert.match(result.stderr, /项目文档知识库/)
  assert.equal(fs.readFileSync(agentsPath, 'utf8'), originalContent)
}))

it('init-project scaffold-docs - 前端项目创建组件文档目录与索引', () => withTempDir('airules-docs-frontend-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })

  const result = runScaffoldDocs(projectRoot, 'frontend')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'decisions', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '_protocol.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'prds', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'test', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'map.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '采购订单.md')), false)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'api', '_protocol.md'), 'utf8'), /错误响应/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md'), 'utf8'), /模块边界/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/architecture/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
}))

it('init-project scaffold-docs - 后端项目不创建 components 目录', () => withTempDir('airules-docs-backend-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  fs.mkdirSync(projectRoot, { recursive: true })

  const result = runScaffoldDocs(projectRoot, 'nestjs')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'decisions', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '_protocol.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components')), false)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'prds', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'test', 'index.md')), true)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/architecture/)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
}))

it('init-project scaffold-docs - 已存在索引文件时不覆盖用户内容', () => withTempDir('airules-docs-existing-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const apiIndexPath = path.join(projectRoot, 'docs', 'api', 'index.md')
  const originalContent = '# Existing API Index\n\nkeep me\n'

  writeFile(apiIndexPath, originalContent)

  const result = runScaffoldDocs(projectRoot, 'frontend')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.readFileSync(apiIndexPath, 'utf8'), originalContent)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '_protocol.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'components', 'index.md')), true)
}))

it('init-project link-claude - 创建 AGENTS.md 到 CLAUDE.md 的托管链接并支持重复执行', () => withTempDir('airules-link-claude-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const claudePath = path.join(projectRoot, 'CLAUDE.md')

  writeFile(agentsPath, '# Project Rules\n')

  const firstRun = runLinkClaude(projectRoot)

  assert.equal(firstRun.status, 0, firstRun.stderr)
  assert.equal(fs.readFileSync(claudePath, 'utf8'), '# Project Rules\n')
  assert.equal(isManagedClaudeLink(agentsPath, claudePath), true)

  const secondRun = runLinkClaude(projectRoot)

  assert.equal(secondRun.status, 0, secondRun.stderr)
  assert.equal(isManagedClaudeLink(agentsPath, claudePath), true)
}))
