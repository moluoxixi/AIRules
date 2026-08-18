import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  classifyChanges,
  compareTrees,
  parseArgs,
  parseNameStatus,
} from '../../../.sync/moluoxixi/scan.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const maintenanceRoot = path.join(repoRoot, '.sync', 'moluoxixi')
const scanner = path.join(maintenanceRoot, 'scan.mjs')

describe('moluoxixi upstream diff scanner', () => {
  it('has no apply mode and resolves an explicit target', () => {
    expect(parseArgs([])).toMatchObject({ fetch: false, json: false, target: 'origin/main' })
    expect(parseArgs(['--target', 'bd454938', '--json'])).toMatchObject({ json: true, target: 'bd454938' })
    expect(() => parseArgs(['--apply'])).toThrow('Unknown option')
    expect(() => parseArgs(['--target'])).toThrow('--target requires a value')
  })

  it('pins the reviewed baseline and records intentional adaptations', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(maintenanceRoot, 'manifest.json'), 'utf8'))
    const contracts = JSON.parse(fs.readFileSync(path.join(maintenanceRoot, 'preservation-contracts.json'), 'utf8'))
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      role: 'moluoxixi',
      upstream: {
        source: 'https://github.com/mindfold-ai/Trellis.git',
        baseline: {
          version: '0.6.15',
          revision: 'bd454938dc406e2f692a07c3f3888e5375ff674d',
        },
      },
      packages: [
        { upstreamPath: 'packages/core', finalizedPath: 'roles/moluoxixi/packages/core' },
        { upstreamPath: 'packages/cli', finalizedPath: 'roles/moluoxixi/packages/cli' },
      ],
      workingClone: '.sync/moluoxixi/work/trellis',
      rebuildWorktree: '.sync/moluoxixi/work/rebuild',
      rebuildBranchPattern: 'moluoxixi/rebuild-<short-revision>',
    })
    expect(contracts.baseline).toEqual({
      name: 'Trellis',
      source: manifest.upstream.source,
      version: manifest.upstream.baseline.version,
      revision: manifest.upstream.baseline.revision,
    })

    const reconciliationPath = path.join(repoRoot, ...manifest.records.reconciliation.split('/'))
    const reconciliation = JSON.parse(fs.readFileSync(reconciliationPath, 'utf8'))
    expect(reconciliation.upstream).toMatchObject({
      source: manifest.upstream.source,
      from: { revision: 'd8fff53ce4964ed1a3e52fea6b418b27eba093e4' },
      to: { revision: manifest.upstream.baseline.revision },
      history: { commitCount: 6 },
    })
    expect(reconciliation.entries).toHaveLength(6)
    expect(fs.statSync(path.join(repoRoot, ...reconciliation.previousRecord.split('/'))).isFile()).toBe(true)
    for (const adaptation of reconciliation.localAdaptations) {
      expect(fs.statSync(path.join(repoRoot, ...adaptation.path.split('/'))).isFile()).toBe(true)
    }

    const expected = [
      'ai-reviewed-upstream-maintenance',
      'review-gated-spec-proposals',
      'role-local-publishable-runtime-packages',
      'simple-task-creation-opt-out',
      'task-complexity-triage',
    ]
    expect(contracts.contracts.map(contract => contract.id).sort()).toEqual(expected)
    for (const contract of contracts.contracts) {
      for (const evidence of [...contract.localEvidence, ...contract.verification]) {
        const target = path.join(repoRoot, ...evidence.path.split('/'))
        expect(fs.statSync(target).isFile()).toBe(true)
      }
    }
  })

  it('classifies finalized and incoming tree changes without resolving them', () => {
    const base = new Map([
      ['packages/cli/a.ts', { mode: '100644', oid: 'a' }],
      ['packages/cli/b.ts', { mode: '100644', oid: 'b' }],
    ])
    const finalized = new Map([
      ['packages/cli/a.ts', { mode: '100644', oid: 'local' }],
      ['packages/cli/c.ts', { mode: '100644', oid: 'c' }],
    ])
    const local = compareTrees(base, finalized)
    const incoming = parseNameStatus('M\tpackages/cli/a.ts\nA\tpackages/cli/d.ts')
    expect(classifyChanges(local, incoming)).toMatchObject({
      overlaps: ['packages/cli/a.ts'],
      incomingOnly: [{ status: 'A', paths: ['packages/cli/d.ts'] }],
    })
    expect(local).toEqual(expect.arrayContaining([
      { status: 'M', paths: ['packages/cli/a.ts'] },
      { status: 'D', paths: ['packages/cli/b.ts'] },
      { status: 'A', paths: ['packages/cli/c.ts'] },
    ]))
  })

  it('exposes only a read-only help path', () => {
    const result = spawnSync(process.execPath, [scanner, '--help'], { encoding: 'utf8' })
    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(result.stdout).toContain('Read-only comparison')
    expect(result.stdout).not.toContain('--apply')
  })
})
