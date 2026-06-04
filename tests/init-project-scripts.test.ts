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

it('init-project inject-rules - AGENTS.md 不存在时创建聚合规则文件', () => withTempDir('airules-inject-create-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const referenceFile = path.join(tmpDir, 'frontend.md')

  fs.mkdirSync(projectRoot, { recursive: true })
  writeFile(referenceFile, '# Frontend Rules\n\nfrontend body\n')

  const result = runInjectRules(projectRoot, referenceFile)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(
    fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8'),
    '# 项目规范\n\n# Frontend Rules\n\nfrontend body\n',
  )
}))

it('init-project inject-rules - AGENTS.md 已存在且无重复标题时追加规则', () => withTempDir('airules-inject-append-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const referenceFile = path.join(tmpDir, 'node.md')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')

  writeFile(agentsPath, '# Existing Project Rules\n\nexisting body\n')
  writeFile(referenceFile, '# Node Rules\n\nnode body\n')

  const result = runInjectRules(projectRoot, referenceFile)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(
    fs.readFileSync(agentsPath, 'utf8'),
    '# Existing Project Rules\n\nexisting body\n\n# 项目规范\n\n# Node Rules\n\nnode body\n',
  )
}))

it('init-project inject-rules - AGENTS.md 标题重复时停止写入并要求 AI 审查', () => withTempDir('airules-inject-duplicate-', (tmpDir) => {
  const projectRoot = path.join(tmpDir, 'project')
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  const originalContent = '# 项目规范\n\nexisting project rules\n'

  writeFile(agentsPath, originalContent)

  const result = runInjectRules(projectRoot)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Duplicate AGENTS\.md headings detected/)
  assert.match(result.stderr, /项目规范/)
  assert.equal(fs.readFileSync(agentsPath, 'utf8'), originalContent)
}))
