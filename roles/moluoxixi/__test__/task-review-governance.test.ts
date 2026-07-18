import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const initializer = path.join(roleRoot, 'skills', 'init-project', 'scripts', 'init-project.mjs')
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'
const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function project(platform = 'claude'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-task-review-'))
  roots.push(root)
  const initialized = spawnSync(process.execPath, [initializer, '--project', root, '--platform', platform, '--python', pythonCommand, '--developer', 'tester'], { encoding: 'utf8' })
  expect(initialized).toMatchObject({ status: 0, stderr: '' })
  return root
}

function task(root: string, args: string[]) {
  const entry = path.join(root, '.moluoxixi', 'scripts', 'task.py')
  const result = spawnSync(pythonCommand, [entry, ...args], { cwd: root, encoding: 'utf8' })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}

function createTask(root: string, slug: string, complexity?: 'lightweight' | 'complex'): string {
  const args = ['create', slug, '--slug', slug, '--description', `${slug} description`, '--no-start']
  if (complexity)
    args.push('--complexity', complexity)
  const created = task(root, args)
  expect(created.status).toBe(0)
  return created.stdout.trim()
}

function taskData(root: string, taskDir: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, taskDir, 'task.json'), 'utf8'))
}

describe('task review governance', () => {
  it('fails closed until complexity and manual planning approval are recorded', () => {
    const root = project('kilo')
    const unclassified = createTask(root, 'unclassified')
    expect(taskData(root, unclassified)).toMatchObject({
      complexity: { level: 'unclassified' },
      executionApproval: { mode: 'manual', granted: false },
    })
    expect(task(root, ['start', unclassified, '--user-approved']).stdout).toContain('complexity is unclassified')

    expect(task(root, ['set-complexity', unclassified, 'lightweight', '--signal', 'single_module', '--reason', 'small scope'])).toMatchObject({ status: 0 })
    expect(task(root, ['start', unclassified]).stdout).toContain('manual review required')
    expect(task(root, ['start', unclassified, '--user-approved'])).toMatchObject({ status: 0 })
    expect(taskData(root, unclassified)).toMatchObject({
      status: 'in_progress',
      complexity: { level: 'lightweight', signals: ['single_module'] },
      executionApproval: { mode: 'manual', granted: true, source: 'explicit_user' },
    })
  }, 15_000)

  it('allows auto progression only after explicit authorization for that task', () => {
    const root = project('kilo')
    const automatic = createTask(root, 'automatic', 'lightweight')
    const other = createTask(root, 'other', 'lightweight')

    const refused = task(root, ['set-execution-mode', automatic, 'auto'])
    expect(refused.stderr + refused.stdout).toContain('--user-authorized')
    expect(task(root, ['set-execution-mode', automatic, 'auto', '--user-authorized', '--reason', 'user requested automatic execution'])).toMatchObject({ status: 0 })
    expect(task(root, ['start', automatic])).toMatchObject({ status: 0 })
    expect(taskData(root, automatic)).toMatchObject({ executionApproval: { mode: 'auto', granted: true, source: 'explicit_user' } })

    expect(task(root, ['start', other]).stdout).toContain('manual review required')
    expect(taskData(root, other)).toMatchObject({ status: 'planning', executionApproval: { mode: 'manual', granted: false } })
  })

  it('rejects forged started state and task directories outside project task storage', () => {
    const root = project('kilo')
    const forged = createTask(root, 'forged-state', 'lightweight')
    const forgedPath = path.join(root, forged, 'task.json')
    const data = JSON.parse(fs.readFileSync(forgedPath, 'utf8'))
    data.status = 'in_progress'
    fs.writeFileSync(forgedPath, `${JSON.stringify(data, null, 2)}\n`)
    expect(task(root, ['start', forged]).stdout).toContain('missing its explicit execution approval')

    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-external-task-'))
    roots.push(outside)
    fs.writeFileSync(path.join(outside, 'task.json'), JSON.stringify({
      status: 'in_progress',
      complexity: { level: 'lightweight' },
      executionApproval: { mode: 'manual', granted: true, source: 'explicit_user' },
    }))
    expect(task(root, ['start', outside]).stdout).toContain('direct child of .moluoxixi/tasks')
  })

  it('enforces complex planning artifacts and curated sub-agent context', () => {
    const root = project('claude')
    const complex = createTask(root, 'complex-work', 'complex')
    const first = task(root, ['start', complex, '--user-approved'])
    expect(first.stdout).toContain('design.md is required')
    expect(first.stdout).toContain('implement.md is required')
    expect(first.stdout).toContain('implement.jsonl requires at least one curated')

    fs.writeFileSync(path.join(root, complex, 'design.md'), '# Design\n')
    fs.writeFileSync(path.join(root, complex, 'implement.md'), '# Plan\n')
    for (const contextName of ['implement', 'check']) {
      fs.writeFileSync(
        path.join(root, complex, `${contextName}.jsonl`),
        '{"file":".moluoxixi/spec/backend/does-not-exist.md","reason":"fake"}\n',
      )
    }
    const forged = task(root, ['start', complex, '--user-approved'])
    expect(forged.stdout).toContain('file not found')
    expect(taskData(root, complex)).toMatchObject({ status: 'planning' })

    expect(task(root, ['add-context', complex, 'implement', 'README.md', 'arbitrary source'])).toMatchObject({ status: 1 })
    expect(task(root, ['add-context', complex, '../../escaped', '.moluoxixi/spec/backend/index.md', 'unsafe output'])).toMatchObject({ status: 1 })
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'escaped.jsonl'))).toBe(false)
    const proposalPath = path.join(root, '.moluoxixi', 'spec-proposals', 'content', 'pending.md')
    fs.mkdirSync(path.dirname(proposalPath), { recursive: true })
    fs.writeFileSync(proposalPath, '# Pending knowledge\n')
    expect(task(root, ['add-context', complex, 'implement', '.moluoxixi/spec-proposals/content/pending.md', 'unreviewed'])).toMatchObject({ status: 1 })

    const researchPath = path.join(root, complex, 'research', 'evidence.md')
    fs.mkdirSync(path.dirname(researchPath), { recursive: true })
    fs.writeFileSync(researchPath, '# Evidence\n')
    const emptySpecDirectory = path.join(root, '.moluoxixi', 'spec', 'empty')
    fs.mkdirSync(emptySpecDirectory, { recursive: true })
    for (const contextName of ['implement', 'check']) {
      fs.writeFileSync(path.join(root, complex, `${contextName}.jsonl`), '')
      expect(task(root, ['add-context', complex, contextName, '.moluoxixi/spec/empty', 'empty directory'])).toMatchObject({ status: 0 })
    }
    expect(task(root, ['start', complex, '--user-approved']).stdout).toContain('requires at least one curated spec/research file entry')
    for (const contextName of ['implement', 'check']) {
      fs.writeFileSync(path.join(root, complex, `${contextName}.jsonl`), '')
    }
    expect(task(root, ['add-context', complex, 'implement', '.moluoxixi/spec/backend/index.md', 'relevant contract'])).toMatchObject({ status: 0 })
    expect(task(root, ['add-context', complex, 'check', `${complex}/research/evidence.md`, 'task evidence'])).toMatchObject({ status: 0 })
    expect(task(root, ['start', complex, '--user-approved'])).toMatchObject({ status: 0 })
    expect(taskData(root, complex)).toMatchObject({ status: 'in_progress' })
  })

  it('keeps initializer lifecycle knowledge work behind manual review', () => {
    const root = project('kilo')
    const bootstrap = taskData(root, '.moluoxixi/tasks/00-bootstrap-guidelines')
    expect(bootstrap).toMatchObject({
      status: 'planning',
      complexity: { level: 'complex', signals: ['initializer', 'multi_deliverable'] },
      executionApproval: { mode: 'manual', granted: false, source: null },
    })
  })
})
