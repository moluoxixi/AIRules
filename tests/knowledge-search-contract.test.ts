import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

const knowledgeContractFiles = [
  'skills/knowledge-search/SKILL.md',
  'skills/init-project/SKILL.md',
  'skills/init-project/references/common/docs.md',
  'docs/map.md',
  'docs/architecture/index.md',
  'docs/architecture/overview.md',
  'docs/architecture/decisions/ADR-0001-knowledge-source-registry.md',
  'docs/superpowers/plans/2026-06-09-knowledge-source-registry.md',
]

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

function runVerifyEvidence(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'scripts', 'verify-knowledge-sources.mjs'),
      '--evidence',
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

const validEvidence = {
  status: 'PASS',
  query: 'Where is the project architecture documented?',
  answer: 'The project architecture entry is docs/architecture/index.md.',
  sources: [
    {
      sourceId: 'repo-docs',
      path: 'docs/architecture/index.md',
      title: '架构文档索引',
      snippet: '记录项目架构、模块边界、分层、数据流、权限模型、部署关系和架构决策。',
    },
  ],
}

it('knowledge evidence verifier - 接受带来源的 PASS 报告', () => withTempDir('airules-knowledge-evidence-valid-', (tmpDir) => {
  const evidencePath = path.join(tmpDir, 'evidence.json')
  writeJson(evidencePath, validEvidence)

  const result = runVerifyEvidence(evidencePath)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /PASS knowledge evidence is valid/)
}))

it('knowledge evidence verifier - 拒绝无来源的 PASS 报告', () => withTempDir('airules-knowledge-evidence-source-', (tmpDir) => {
  const evidencePath = path.join(tmpDir, 'evidence.json')
  writeJson(evidencePath, {
    ...validEvidence,
    sources: [],
  })

  const result = runVerifyEvidence(evidencePath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /PASS 需要至少一个来源/)
}))

it('knowledge evidence verifier - 接受无来源的 MISSING evidence 报告', () => withTempDir('airules-knowledge-evidence-missing-', (tmpDir) => {
  const evidencePath = path.join(tmpDir, 'evidence.json')
  writeJson(evidencePath, {
    status: 'MISSING evidence',
    query: 'Where is the refund policy?',
    reason: 'No registered knowledge source matched the query.',
    sources: [],
  })

  const result = runVerifyEvidence(evidencePath)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /PASS knowledge evidence is valid/)
}))

it('knowledge evidence verifier - 有冲突来源时必须使用 MISSING conflict', () => withTempDir('airules-knowledge-evidence-conflict-', (tmpDir) => {
  const evidencePath = path.join(tmpDir, 'evidence.json')
  writeJson(evidencePath, {
    ...validEvidence,
    conflicts: [
      {
        sourceIds: ['repo-docs', 'product-docs'],
        summary: 'Two sources define different deployment owners.',
      },
    ],
  })

  const result = runVerifyEvidence(evidencePath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /存在 conflicts 时 status 必须是 MISSING conflict/)
}))

it('knowledge evidence verifier - 拒绝未知状态', () => withTempDir('airules-knowledge-evidence-status-', (tmpDir) => {
  const evidencePath = path.join(tmpDir, 'evidence.json')
  writeJson(evidencePath, {
    ...validEvidence,
    status: 'WARN',
  })

  const result = runVerifyEvidence(evidencePath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /status 必须是 PASS、MISSING evidence、MISSING conflict、FAIL 或 NOT RUN/)
}))

it('knowledge search contract - 不暴露未安装的 Khoj 或 MemPalace 入口', () => {
  for (const filePath of knowledgeContractFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), filePath), 'utf8')

    assert.doesNotMatch(content, /khoj/i, `${filePath} must not mention Khoj`)
    assert.doesNotMatch(content, /MemPalace/i, `${filePath} must not mention MemPalace`)
  }
})
