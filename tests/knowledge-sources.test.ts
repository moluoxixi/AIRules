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

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function runVerifyKnowledgeSources(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'scripts', 'verify-knowledge-sources.mjs'),
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

const validRegistry = {
  version: 1,
  sources: [
    {
      id: 'repo-docs',
      type: 'filesystem',
      include: ['README.md', 'docs/**', 'packages/*/README.md'],
      exclude: ['vendor/**', 'node_modules/**', 'dist/**', 'coverage/**', '.git/**', '.codegraph/**'],
      purpose: 'project-docs',
      owner: 'docs-team',
      trust: 'registered',
    },
    {
      id: 'khoj-project',
      type: 'khoj',
      collection: 'airules-project',
      purpose: 'project-knowledge',
      owner: 'ai-platform',
      trust: 'registered',
    },
  ],
}

it('knowledge source verifier - 接受登记过的文件系统和 Khoj 知识源', () => withTempDir('airules-knowledge-source-valid-', (tmpDir) => {
  const registryPath = path.join(tmpDir, 'airules.knowledge.json')
  writeJson(registryPath, validRegistry)

  const result = runVerifyKnowledgeSources(registryPath)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /PASS knowledge sources are valid/)
}))

it('knowledge source verifier - 拒绝文件系统知识源 include 受禁目录', () => withTempDir('airules-knowledge-source-forbidden-', (tmpDir) => {
  const registryPath = path.join(tmpDir, 'airules.knowledge.json')
  writeJson(registryPath, {
    ...validRegistry,
    sources: [
      {
        ...validRegistry.sources[0],
        include: ['docs/**', 'node_modules/**'],
      },
    ],
  })

  const result = runVerifyKnowledgeSources(registryPath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /include 不得包含受禁路径 node_modules\/\*\*/)
}))

it('knowledge source verifier - 拒绝缺少 owner 的知识源', () => withTempDir('airules-knowledge-source-owner-', (tmpDir) => {
  const registryPath = path.join(tmpDir, 'airules.knowledge.json')
  writeJson(registryPath, {
    ...validRegistry,
    sources: [
      {
        ...validRegistry.sources[0],
        owner: 'MISSING owner',
      },
    ],
  })

  const result = runVerifyKnowledgeSources(registryPath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /owner 必须是已确认负责人/)
}))

it('knowledge source verifier - 拒绝未知知识源类型', () => withTempDir('airules-knowledge-source-type-', (tmpDir) => {
  const registryPath = path.join(tmpDir, 'airules.knowledge.json')
  writeJson(registryPath, {
    ...validRegistry,
    sources: [
      {
        ...validRegistry.sources[0],
        type: 'random-folder',
      },
    ],
  })

  const result = runVerifyKnowledgeSources(registryPath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /type 必须是 filesystem 或 khoj/)
}))

it('knowledge source verifier - 拒绝缺少 collection 的 Khoj 知识源', () => withTempDir('airules-knowledge-source-khoj-', (tmpDir) => {
  const registryPath = path.join(tmpDir, 'airules.knowledge.json')
  writeJson(registryPath, {
    ...validRegistry,
    sources: [
      {
        id: 'khoj-project',
        type: 'khoj',
        purpose: 'project-knowledge',
        owner: 'ai-platform',
        trust: 'registered',
      },
    ],
  })

  const result = runVerifyKnowledgeSources(registryPath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /khoj 知识源必须声明 collection/)
}))
