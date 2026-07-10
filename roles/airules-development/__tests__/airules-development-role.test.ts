import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRoleAssets } from '../../../scripts/lib/role-assets.js'
import { syncToHosts } from '../../../scripts/lib/tool.js'
import { loadVendorManifest } from '../../../scripts/lib/vendors.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../../..')
const roleRoot = path.join(repoRoot, 'roles', 'airules-development')
const manifestPath = path.join(roleRoot, 'constants', 'skills.ts')
const initScript = path.join(roleRoot, 'skills', 'init-project', 'scripts', 'init-project.mjs')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-development-role-'))
  temporaryRoots.push(projectRoot)
  fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# Existing project rules\n')
  runNode(initScript, [projectRoot, '--no-verify'])
  return projectRoot
}

function workflowScript(projectRoot: string): string {
  return path.join(projectRoot, '.airules', 'workflow', 'bin', 'workflow.mjs')
}

function runNode(script: string, args: string[], cwd = repoRoot) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): node ${script} ${args.join(' ')}\n${result.stderr}`)
  }
  return result.stdout.trim()
}

function runWorkflow(projectRoot: string, args: string[]) {
  return JSON.parse(runNode(workflowScript(projectRoot), [...args, '--json'], projectRoot)) as Record<string, any>
}

function failWorkflow(projectRoot: string, args: string[]) {
  return spawnSync(process.execPath, [workflowScript(projectRoot), ...args, '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

function changeFile(projectRoot: string, change: string): string {
  return path.join(projectRoot, 'openspec', 'changes', change, 'change.json')
}

describe('airules-development role contract', () => {
  it('declares a remote-only capability composition and exact moluoxixi role path', async () => {
    const manifest = await loadVendorManifest(manifestPath)

    expect(Object.keys(manifest.vendors).sort()).toEqual([
      'ecc',
      'gstack',
      'moluoxixi',
      'openai',
      'superpowers',
    ])
    expect(manifest.vendors.moluoxixi.repo).toBe('https://github.com/moluoxixi/AIRules.git')
    expect(manifest.vendors.moluoxixi.links).toEqual([
      expect.objectContaining({
        kind: 'role-assets-dir',
        source: 'roles/airules-development',
        target: 'vendor',
      }),
    ])
    expect(manifest.vendors.moluoxixi.sourceMode).toBeUndefined()
  })

  it('ships the complete first-party role surface without inheriting another role', () => {
    const assets = resolveRoleAssets(repoRoot, 'airules-development')
    const skillNames = fs.readdirSync(assets.skillsDir!, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
    const agentNames = fs.readdirSync(assets.agentsDir!, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .sort()

    expect(skillNames).toEqual([
      'correction-loop',
      'init-project',
      'memory-governance',
      'requirements-engineering',
      'test-evidence',
      'workflow-control',
    ])
    expect(agentNames).toEqual([
      'architect.md',
      'conductor.md',
      'implementer.md',
      'knowledge-curator.md',
      'requirements-analyst.md',
      'test-designer.md',
      'verifier.md',
    ])
    expect(assets.rulesFile).toBe(path.join(roleRoot, 'rules', 'AGENTS.md'))
    expect(assets.hooksDir).toBeUndefined()
    expect(assets.mcpFile).toBeUndefined()
  })

  it('exposes an explicit package sync command', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    expect(packageJson.scripts['sync:airules-development'])
      .toBe('tsx scripts/cli.ts sync --host all --role airules-development')
  })

  it('projects the complete role from remote checkouts instead of the workspace', async () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-development-remote-'))
    temporaryRoots.push(fixtureRoot)
    const home = path.join(fixtureRoot, 'home')
    const userHome = path.join(fixtureRoot, 'user')
    fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true })

    const manifest = await loadVendorManifest(manifestPath)
    for (const [vendorId, vendor] of Object.entries(manifest.vendors)) {
      const checkout = path.join(home, 'vendor', 'repos', vendorId)
      fs.mkdirSync(checkout, { recursive: true })
      for (const link of vendor.links) {
        const source = path.join(checkout, link.source)
        if (link.kind === 'role-assets-dir') {
          fs.mkdirSync(path.dirname(source), { recursive: true })
          fs.cpSync(roleRoot, source, { recursive: true })
        }
        else if (link.kind === 'namespace-dir') {
          fs.mkdirSync(path.join(source, 'fixture-skill'), { recursive: true })
          fs.writeFileSync(path.join(source, 'fixture-skill', 'SKILL.md'), '# fixture namespace skill\n')
        }
        else if (link.kind === 'skill') {
          fs.mkdirSync(source, { recursive: true })
          fs.writeFileSync(path.join(source, 'SKILL.md'), `# ${vendorId} fixture skill\n`)
        }
      }
    }

    const remoteWorkflowSkill = path.join(
      home,
      'vendor',
      'repos',
      'moluoxixi',
      'roles',
      'airules-development',
      'skills',
      'workflow-control',
      'SKILL.md',
    )
    fs.appendFileSync(remoteWorkflowSkill, '\nREMOTE_CHECKOUT_ONLY\n')

    const result = await syncToHosts({
      repoRoot,
      home,
      userHome,
      host: 'codex',
      role: 'airules-development',
      skipVendors: true,
      verify: false,
    })

    expect(result.projectedHosts).toEqual(['codex'])
    expect(fs.readFileSync(path.join(home, 'vendor', 'skills', 'workflow-control', 'SKILL.md'), 'utf8'))
      .toContain('REMOTE_CHECKOUT_ONLY')
    expect(fs.existsSync(path.join(home, 'vendor', 'skills', 'vendor'))).toBe(false)
    expect(fs.existsSync(path.join(home, 'vendor', 'agents', 'conductor.md'))).toBe(true)
    expect(fs.readFileSync(path.join(home, 'vendor', 'AGENTS.md'), 'utf8')).toContain('唯一状态写入口')
    expect(fs.readFileSync(path.join(userHome, '.codex', 'skills', 'workflow-control', 'SKILL.md'), 'utf8'))
      .toContain('REMOTE_CHECKOUT_ONLY')
  })
})

describe('airules-development project initialization', () => {
  it('installs owned runtime and schema assets while preserving project rules', () => {
    const projectRoot = createProject()
    const agentsFile = path.join(projectRoot, 'AGENTS.md')
    const firstAgents = fs.readFileSync(agentsFile, 'utf8')

    expect(firstAgents).toContain('# Existing project rules')
    expect(firstAgents).toContain('<!-- AIRULES:DEVELOPMENT-WORKFLOW:START -->')
    expect(fs.existsSync(workflowScript(projectRoot))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.airules', 'workflow', 'schemas', 'change-unit.schema.json'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.airules', 'workflow', 'schemas', 'workflow-event.schema.json'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.airules', 'workflow', 'schemas', 'gate-result.schema.json'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.airules', 'workflow', 'schemas', 'memory-candidate.schema.json'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, 'openspec', 'schemas', 'airules-development', 'schema.yaml'))).toBe(true)

    runNode(initScript, [projectRoot, '--no-verify'])
    const secondAgents = fs.readFileSync(agentsFile, 'utf8')
    expect(secondAgents.match(/AIRULES:DEVELOPMENT-WORKFLOW:START/gu)).toHaveLength(1)
    expect(secondAgents).toBe(firstAgents)
  })
})

describe('airules-development workflow kernel', () => {
  it('initializes, advances idempotently, and replays a change', () => {
    const projectRoot = createProject()

    const initialized = runWorkflow(projectRoot, ['init', 'checkout-flow', '--title', 'Checkout flow'])
    expect(initialized).toMatchObject({ change_unit_id: 'CU-checkout-flow', state: 'intake' })
    expect(runWorkflow(projectRoot, ['next', 'checkout-flow'])).toMatchObject({
      state: 'intake',
      required_gate: 'requirement',
    })

    const firstGate = runWorkflow(projectRoot, [
      'gate',
      'checkout-flow',
      'requirement',
      '--status',
      'pass',
      '--evidence',
      'openspec/changes/checkout-flow/specs/checkout/spec.md#SCN-checkout-001',
      '--idempotency-key',
      'requirements-v1',
    ])
    const duplicateGate = runWorkflow(projectRoot, [
      'gate',
      'checkout-flow',
      'requirement',
      '--status',
      'pass',
      '--evidence',
      'openspec/changes/checkout-flow/specs/checkout/spec.md#SCN-checkout-001',
      '--idempotency-key',
      'requirements-v1',
    ])

    expect(firstGate).toMatchObject({ state: 'spec-ready', duplicate: false })
    expect(duplicateGate).toMatchObject({ state: 'spec-ready', duplicate: true })
    expect(runWorkflow(projectRoot, ['status', 'checkout-flow'])).toMatchObject({ state: 'spec-ready' })
    expect(runWorkflow(projectRoot, ['replay', 'checkout-flow'])).toMatchObject({
      snapshot_state: 'spec-ready',
      replayed_state: 'spec-ready',
      consistent: true,
    })
  })

  it('rejects invalid state transitions without changing the snapshot', () => {
    const projectRoot = createProject()
    runWorkflow(projectRoot, ['init', 'invalid-transition'])

    const failed = failWorkflow(projectRoot, [
      'gate',
      'invalid-transition',
      'architecture',
      '--status',
      'pass',
      '--evidence',
      'openspec/changes/invalid-transition/design.md',
      '--idempotency-key',
      'architecture-v1',
    ])

    expect(failed.status).not.toBe(0)
    expect(failed.stderr).toMatch(/requires state spec-ready/iu)
    expect(runWorkflow(projectRoot, ['status', 'invalid-transition'])).toMatchObject({ state: 'intake' })
  })

  it('routes classified failures and blocks a repeated failure signature', () => {
    const projectRoot = createProject()
    runWorkflow(projectRoot, ['init', 'bounded-correction'])
    const pass = (gate: string, key: string) => runWorkflow(projectRoot, [
      'gate',
      'bounded-correction',
      gate,
      '--status',
      'pass',
      '--evidence',
      `evidence/${gate}.json`,
      '--idempotency-key',
      key,
    ])

    pass('requirement', 'requirement-v1')
    pass('architecture', 'architecture-v1')
    pass('scenario-test', 'scenario-test-v1')
    pass('execution', 'execution-v1')
    pass('implementation', 'implementation-v1')

    const firstFailure = runWorkflow(projectRoot, [
      'gate',
      'bounded-correction',
      'automated',
      '--status',
      'fail',
      '--failure-class',
      'IMPLEMENTATION_DEFECT',
      '--evidence',
      'tests/auth.test.ts',
      '--idempotency-key',
      'automated-fail-v1',
    ])
    expect(firstFailure).toMatchObject({ state: 'implementing', blocked: false })

    pass('implementation', 'implementation-v2')
    const repeatedFailure = runWorkflow(projectRoot, [
      'gate',
      'bounded-correction',
      'automated',
      '--status',
      'fail',
      '--failure-class',
      'IMPLEMENTATION_DEFECT',
      '--evidence',
      'tests/auth.test.ts',
      '--idempotency-key',
      'automated-fail-v2',
    ])

    expect(repeatedFailure).toMatchObject({ state: 'blocked', blocked: true, failure_count: 2 })
  })

  it('detects snapshot drift and repairs it from the append-only ledger', () => {
    const projectRoot = createProject()
    runWorkflow(projectRoot, ['init', 'replay-repair'])
    const snapshotPath = changeFile(projectRoot, 'replay-repair')
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    fs.writeFileSync(snapshotPath, `${JSON.stringify({ ...snapshot, state: 'done' }, null, 2)}\n`)

    const inconsistent = failWorkflow(projectRoot, ['replay', 'replay-repair'])
    expect(inconsistent.status).not.toBe(0)
    expect(JSON.parse(inconsistent.stdout)).toMatchObject({
      snapshot_state: 'done',
      replayed_state: 'intake',
      consistent: false,
    })

    expect(runWorkflow(projectRoot, ['replay', 'replay-repair', '--repair'])).toMatchObject({
      snapshot_state: 'done',
      replayed_state: 'intake',
      consistent: false,
      repaired: true,
    })
    expect(runWorkflow(projectRoot, ['status', 'replay-repair'])).toMatchObject({ state: 'intake' })
  })
})
