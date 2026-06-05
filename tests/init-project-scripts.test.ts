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

function canCreateFileSymlink(): boolean {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-symlink-support-'))

  try {
    writeFile(path.join(tmpDir, 'target.md'), 'target\n')
    fs.symlinkSync('target.md', path.join(tmpDir, 'link.md'), 'file')
    return fs.lstatSync(path.join(tmpDir, 'link.md')).isSymbolicLink()
  }
  catch {
    return false
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
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

function runGit(projectRoot: string, ...args: string[]) {
  return spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
  })
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

const symlinkIt = canCreateFileSymlink() ? it : it.skip

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
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'prds', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'test', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'map.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'api', '采购订单.md')), false)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'api', '_protocol.md'), 'utf8'), /错误响应/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'architecture', 'overview.md'), 'utf8'), /模块边界/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/architecture/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/other/)
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
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'prds', 'index.md')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'test', 'index.md')), true)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/architecture/)
  assert.match(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/other/)
  assert.doesNotMatch(fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8'), /docs\/components/)
}))

it('init-project scaffold-docs - 后端项目已有 components 目录时纳入地图并保留内容', () => withTempDir('airules-docs-existing-components-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const componentsIndexPath = path.join(projectRoot, 'docs', 'components', 'index.md')
  const originalComponentsIndex = '# Existing Components\n\nkeep component docs\n'

  writeFile(componentsIndexPath, originalComponentsIndex)

  const result = runScaffoldDocs(projectRoot, 'nestjs')
  const mapContent = fs.readFileSync(path.join(projectRoot, 'docs', 'map.md'), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.readFileSync(componentsIndexPath, 'utf8'), originalComponentsIndex)
  assert.match(mapContent, /docs\/components/)
}))

it('init-project scaffold-docs - 已有未归类 docs 时登记到 other 索引', () => withTempDir('airules-docs-existing-other-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')

  writeFile(path.join(projectRoot, 'docs', 'legacy.md'), '# Legacy Docs\n')
  writeFile(path.join(projectRoot, 'docs', 'old-guides', 'README.md'), '# Old Guides\n')

  const result = runScaffoldDocs(projectRoot, 'frontend')
  const otherIndex = fs.readFileSync(path.join(projectRoot, 'docs', 'other', 'index.md'), 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.match(otherIndex, /legacy\.md/)
  assert.match(otherIndex, /old-guides/)
  assert.match(otherIndex, /\.\.\/legacy\.md/)
  assert.match(otherIndex, /\.\.\/old-guides/)
}))

it('init-project scaffold-docs - 已有 other 索引时追加缺失的未归类文档登记', () => withTempDir('airules-docs-existing-other-index-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const otherIndexPath = path.join(projectRoot, 'docs', 'other', 'index.md')
  const originalOtherIndex = '# Custom Other Index\n\nkeep custom notes\n'

  writeFile(path.join(projectRoot, 'docs', 'legacy.md'), '# Legacy Docs\n')
  writeFile(otherIndexPath, originalOtherIndex)

  const result = runScaffoldDocs(projectRoot, 'frontend')
  const otherIndex = fs.readFileSync(otherIndexPath, 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(otherIndex.startsWith(originalOtherIndex), true)
  assert.match(otherIndex, /legacy\.md/)
  assert.match(otherIndex, /\.\.\/legacy\.md/)
}))

it('init-project scaffold-docs - 已有 map 时追加缺失的文档入口', () => withTempDir('airules-docs-existing-map-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const mapPath = path.join(projectRoot, 'docs', 'map.md')
  const componentsIndexPath = path.join(projectRoot, 'docs', 'components', 'index.md')
  const originalMap = '# Existing Map\n\nkeep custom map\n'

  writeFile(mapPath, originalMap)
  writeFile(componentsIndexPath, '# Existing Components\n')

  const result = runScaffoldDocs(projectRoot, 'nestjs')
  const mapContent = fs.readFileSync(mapPath, 'utf8')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(mapContent.startsWith(originalMap), true)
  assert.match(mapContent, /components\/index\.md/)
  assert.match(mapContent, /other\/index\.md/)
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
  assert.equal(fs.existsSync(path.join(projectRoot, 'docs', 'other', 'index.md')), true)
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

it('init-project link-claude - Git 项目内启用本地 core.symlinks', () => withTempDir('airules-link-claude-git-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')

  fs.mkdirSync(projectRoot, { recursive: true })
  assert.equal(runGit(projectRoot, 'init').status, 0)
  writeFile(agentsPath, '# Project Rules\n')

  const result = runLinkClaude(projectRoot)
  const symlinksConfig = runGit(projectRoot, 'config', '--get', 'core.symlinks')

  assert.equal(result.status, 0, result.stderr)
  assert.equal(symlinksConfig.status, 0, symlinksConfig.stderr)
  assert.equal(symlinksConfig.stdout.trim(), 'true')
}))

it('init-project link-claude - 已存在非托管 CLAUDE.md 时停止并提示用户处理', () => withTempDir('airules-link-claude-existing-file-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const claudePath = path.join(projectRoot, 'CLAUDE.md')
  const originalClaudeContent = '# Custom Claude Rules\n'

  writeFile(agentsPath, '# Project Rules\n')
  writeFile(claudePath, originalClaudeContent)

  const result = runLinkClaude(projectRoot)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CLAUDE\.md already exists and is not managed by AIRules/)
  assert.match(result.stderr, /remove or repair CLAUDE\.md/)
  assert.equal(fs.readFileSync(claudePath, 'utf8'), originalClaudeContent)
}))

symlinkIt('init-project link-claude - 错误 CLAUDE.md 软链接停止并报告实际指向', () => withTempDir('airules-link-claude-wrong-link-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const claudePath = path.join(projectRoot, 'CLAUDE.md')
  const readmePath = path.join(projectRoot, 'README.md')

  writeFile(agentsPath, '# Project Rules\n')
  writeFile(readmePath, '# Readme\n')
  fs.symlinkSync('README.md', claudePath, 'file')

  const result = runLinkClaude(projectRoot)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CLAUDE\.md already links to a different target/)
  assert.match(result.stderr, /README\.md/)
  assert.match(result.stderr, /AGENTS\.md/)
  assert.equal(fs.readlinkSync(claudePath), 'README.md')
}))
