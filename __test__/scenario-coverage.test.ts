import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'vitest'

function withTempDir<T>(run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-scenario-coverage-'))

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

function runCoverage(changeDir: string, testRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'scripts', 'verify-scenario-coverage.mjs'), changeDir, testRoot],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
}

describe('verify-scenario-coverage', () => {
  it('passes when every delta spec scenario is covered by a test design TC', () => {
    withTempDir((tmpDir) => {
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'order-flow')
      const testRoot = path.join(tmpDir, 'knowledge', '测试')

      writeFile(path.join(changeDir, 'specs', 'orders', 'spec.md'), [
        '## ADDED Requirements',
        '',
        '### Requirement: Order lifecycle',
        'The system SHALL manage order lifecycle.',
        '',
        '#### Scenario: SCN-orders-001 create order',
        '- **WHEN** a valid order is submitted',
        '- **THEN** the order is created',
        '',
        '#### Scenario: SCN-orders-002 cancel order',
        '- **WHEN** an existing order is cancelled',
        '- **THEN** the order is closed',
        '',
      ].join('\n'))
      writeFile(path.join(testRoot, 'orders.md'), [
        '# 订单测试',
        '',
        '## TC-订单-001',
        'covers: SCN-orders-001',
        '',
        '## TC-订单-002',
        'covers: SCN-orders-002',
        '',
      ].join('\n'))

      const result = runCoverage(changeDir, testRoot)

      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /PASS scenario coverage/)
    })
  })

  it('fails when a delta spec scenario has no covering TC', () => {
    withTempDir((tmpDir) => {
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'order-flow')
      const testRoot = path.join(tmpDir, 'knowledge', '测试')

      writeFile(path.join(changeDir, 'specs', 'orders', 'spec.md'), [
        '## ADDED Requirements',
        '',
        '### Requirement: Order lifecycle',
        'The system SHALL manage order lifecycle.',
        '',
        '#### Scenario: SCN-orders-001 create order',
        '- **WHEN** a valid order is submitted',
        '- **THEN** the order is created',
        '',
        '#### Scenario: SCN-orders-002 cancel order',
        '- **WHEN** an existing order is cancelled',
        '- **THEN** the order is closed',
        '',
      ].join('\n'))
      writeFile(path.join(testRoot, 'orders.md'), [
        '# 订单测试',
        '',
        '## TC-订单-001',
        'covers: SCN-orders-001',
        '',
      ].join('\n'))

      const result = runCoverage(changeDir, testRoot)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /SCN-orders-002/)
    })
  })

  it('fails when a scenario heading does not contain a stable Scenario ID', () => {
    withTempDir((tmpDir) => {
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'order-flow')
      const testRoot = path.join(tmpDir, 'knowledge', '测试')

      writeFile(path.join(changeDir, 'specs', 'orders', 'spec.md'), [
        '## ADDED Requirements',
        '',
        '### Requirement: Order lifecycle',
        'The system SHALL manage order lifecycle.',
        '',
        '#### Scenario: create order',
        '- **WHEN** a valid order is submitted',
        '- **THEN** the order is created',
        '',
      ].join('\n'))
      writeFile(path.join(testRoot, 'orders.md'), '# 订单测试\n')

      const result = runCoverage(changeDir, testRoot)

      assert.equal(result.status, 1)
      assert.match(result.stderr, /missing Scenario ID/)
    })
  })
})
