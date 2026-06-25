import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const scriptPath = path.join(projectRoot, 'scripts', 'verify-change-packs.mjs')

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function withTempRoot(run: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-change-pack-'))
  try {
    return run(root)
  }
  finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function createMinimalRoot(root: string) {
  writeFile(path.join(root, 'docs', 'delivery', 'change-pack.md'), [
    '# L2 变更包契约',
    'docs/changes/',
    'proposal.md layer-delta.md design.md tasks.md verification.md',
    'archive verify:changes',
    'repo-maintenance global-baseline project-init generated-project',
    'ADDED MODIFIED REMOVED',
    'PASS FAIL MISSING NOT RUN N/A',
  ].join('\n'))
  writeFile(path.join(root, 'docs', 'changes', 'index.md'), [
    '# 变更包索引',
    '## 活动变更',
    '## 归档变更',
  ].join('\n'))
  fs.mkdirSync(path.join(root, 'docs', 'changes', 'archive'), { recursive: true })

  const packRoot = path.join(root, 'docs', 'changes', 'demo-change')
  writeFile(path.join(packRoot, 'proposal.md'), [
    '# Proposal',
    '## 目标',
    '## 范围',
    '## 非目标',
    '## 变更分级',
    '## 影响层级',
    '## 风险',
  ].join('\n'))
  writeFile(path.join(packRoot, 'layer-delta.md'), [
    '# Layer Delta',
    '## repo-maintenance',
    '### ADDED',
    '### MODIFIED',
    '### REMOVED',
    '## global-baseline',
    '## project-init',
    '## generated-project',
  ].join('\n'))
  writeFile(path.join(packRoot, 'design.md'), [
    '# Design',
    '## 技术方案',
    '## 兼容性',
    '## 回滚',
    '## 验证策略',
  ].join('\n'))
  writeFile(path.join(packRoot, 'tasks.md'), [
    '# Tasks',
    '- [ ] 1.1 demo',
  ].join('\n'))
  writeFile(path.join(packRoot, 'verification.md'), [
    '# Verification',
    '| Command | Status | Notes |',
    '|---|---|---|',
    '| `demo` | PASS | done |',
  ].join('\n'))
}

function runScript(...args: string[]) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

function runScriptResult(...args: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

it('verify-change-packs - 当前仓库变更包通过校验', () => {
  const output = runScript('--root', projectRoot)

  assert.match(output, /PASS change packs are valid/)
})

it('verify-change-packs - 最小有效变更包通过校验', () => withTempRoot((root) => {
  createMinimalRoot(root)

  const output = runScript('--root', root)

  assert.match(output, /PASS change packs are valid/)
}))

it('verify-change-packs - layer-delta 缺少资产层级时显式失败', () => withTempRoot((root) => {
  createMinimalRoot(root)
  const deltaPath = path.join(root, 'docs', 'changes', 'demo-change', 'layer-delta.md')
  fs.writeFileSync(deltaPath, fs.readFileSync(deltaPath, 'utf8').replace('## project-init\n', ''))

  const result = runScriptResult('--root', root)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /FAIL docs\/changes\/demo-change\/layer-delta\.md 缺少: project-init/)
}))
