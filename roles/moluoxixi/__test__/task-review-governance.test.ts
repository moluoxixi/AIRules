import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildPlan } from '../skills/init-project/scripts/plan.mjs'

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

function injectedImplementContext(root: string, taskDir: string): string {
  const hook = path.join(root, '.claude', 'hooks', 'inject-subagent-context.py')
  const script = [
    'import importlib.util, sys',
    'spec = importlib.util.spec_from_file_location("moluoxixi_hook", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'print(module.get_implement_context(sys.argv[2], sys.argv[3]))',
  ].join('; ')
  const result = spawnSync(pythonCommand, ['-c', script, hook, root, taskDir], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || 'context hook failed')
  return result.stdout
}

function runPythonModuleFunction(
  modulePath: string,
  expression: string,
  options: { cwd: string, env?: NodeJS.ProcessEnv },
) {
  const script = [
    'import importlib.util, sys',
    'spec = importlib.util.spec_from_file_location("target_module", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'sys.modules[spec.name] = module',
    'spec.loader.exec_module(module)',
    `print(${expression})`,
  ].join('; ')
  return spawnSync(pythonCommand, ['-c', script, modulePath], {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
  })
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
    const outsideBefore = fs.readFileSync(path.join(outside, 'task.json'), 'utf8')
    expect(task(root, ['start', outside])).toMatchObject({ status: 1 })
    expect(task(root, ['set-complexity', outside, 'complex'])).toMatchObject({ status: 1 })
    expect(task(root, ['set-execution-mode', outside, 'manual'])).toMatchObject({ status: 1 })
    expect(task(root, ['set-branch', outside, 'unsafe'])).toMatchObject({ status: 1 })
    expect(task(root, ['set-base-branch', outside, 'unsafe'])).toMatchObject({ status: 1 })
    expect(task(root, ['set-scope', outside, 'unsafe'])).toMatchObject({ status: 1 })
    expect(task(root, ['add-context', outside, 'implement', '.moluoxixi/spec/backend/index.md'])).toMatchObject({ status: 1 })
    expect(task(root, ['validate', outside])).toMatchObject({ status: 1 })
    expect(task(root, ['list-context', outside])).toMatchObject({ status: 1 })

    const local = createTask(root, 'local-child', 'lightweight')
    expect(task(root, ['add-subtask', outside, local])).toMatchObject({ status: 1 })
    expect(task(root, ['remove-subtask', outside, local])).toMatchObject({ status: 1 })
    expect(fs.readFileSync(path.join(outside, 'task.json'), 'utf8')).toBe(outsideBefore)
  }, 15_000)

  it('validates archived task research through its contained archive copy', () => {
    const root = project('kilo')
    const active = createTask(root, 'archived-context', 'lightweight')
    const activePath = path.join(root, active)
    fs.mkdirSync(path.join(activePath, 'research'), { recursive: true })
    fs.writeFileSync(path.join(activePath, 'research', 'evidence.md'), '# Evidence\n')
    fs.writeFileSync(
      path.join(activePath, 'implement.jsonl'),
      `${JSON.stringify({ file: `${active}/research/evidence.md`, reason: 'historical self-reference' })}\n`,
    )

    const archived = path.join(root, '.moluoxixi', 'tasks', 'archive', '2026-08', path.basename(active))
    fs.mkdirSync(path.dirname(archived), { recursive: true })
    fs.renameSync(activePath, archived)
    const archivedRef = path.relative(root, archived)
    expect(task(root, ['validate', archivedRef])).toMatchObject({ status: 0 })

    fs.writeFileSync(
      path.join(archived, 'implement.jsonl'),
      `${JSON.stringify({ file: `${active}/research/../task.json`, reason: 'escape' })}\n`,
    )
    expect(task(root, ['validate', archivedRef])).toMatchObject({ status: 1 })
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

  it('caps injected context without corrupting UTF-8 or inlining binary data', () => {
    const root = project('claude')
    const contextTask = createTask(root, 'bounded-context', 'lightweight')
    const specDir = path.join(root, '.moluoxixi', 'spec', 'backend')
    fs.mkdirSync(specDir, { recursive: true })
    fs.writeFileSync(path.join(specDir, 'utf8.md'), 'a你b and more text\n')
    fs.writeFileSync(path.join(specDir, 'binary.md'), Buffer.from([0x41, 0x00, 0x42]))
    fs.writeFileSync(
      path.join(root, contextTask, 'implement.jsonl'),
      [
        JSON.stringify({ file: '.moluoxixi/spec/backend/utf8.md', reason: 'utf8 boundary' }),
        JSON.stringify({ file: '.moluoxixi/spec/backend/binary.md', reason: 'binary fixture' }),
      ].join('\n'),
    )
    fs.appendFileSync(
      path.join(root, '.moluoxixi', 'config.yaml'),
      '\ncontext_injection:\n  max_file_bytes: 4\n  max_artifact_bytes: 64\n  max_total_bytes: 4096\n',
    )

    const context = injectedImplementContext(root, contextTask)
    expect(context).toContain('a你')
    expect(context).not.toContain('\uFFFD')
    expect(context).toContain('[Moluoxixi: truncated at 4 bytes;')
    expect(context).toContain('[Moluoxixi: binary file not inlined;')
    expect(context).not.toContain('A\0B')

    fs.appendFileSync(
      path.join(root, '.moluoxixi', 'config.yaml'),
      '\ncontext_injection:\n  max_file_bytes: 128\n  max_artifact_bytes: 128\n  max_total_bytes: 8\n',
    )
    expect(injectedImplementContext(root, contextTask)).toContain(
      '[Moluoxixi: total context limit reached;',
    )

    const piEntry = buildPlan(['pi'], pythonCommand).get('.pi/extensions/moluoxixi/index.ts')
    expect(piEntry).toBeDefined()
    const piExtension = String(piEntry?.content)
    expect(piExtension).toContain('function readContextInjectionLimits')
    expect(piExtension).toContain('function truncateUtf8')
    expect(piExtension).toContain('[Moluoxixi: not inlined (binary file)')
  }, 15_000)

  it('ignores invented host session variables and injects native Codex child context', () => {
    const root = project('codex')
    const activeTask = createTask(root, 'codex-native', 'lightweight')
    fs.mkdirSync(path.join(root, '.git'), { recursive: true })
    const activeTaskDir = path.join(root, activeTask)
    fs.writeFileSync(path.join(activeTaskDir, 'prd.md'), '# Native context\n')
    fs.mkdirSync(path.join(root, '.moluoxixi', '.runtime', 'sessions'), { recursive: true })
    fs.writeFileSync(
      path.join(root, '.moluoxixi', '.runtime', 'sessions', 'codex_parent.json'),
      `${JSON.stringify({ current_task: activeTask })}\n`,
    )

    const hook = path.join(root, '.codex', 'hooks', 'inject-subagent-context.py')
    const native = spawnSync(pythonCommand, [hook], {
      cwd: root,
      input: JSON.stringify({
        hook_event_name: 'SubagentStart',
        agent_type: 'moluoxixi-implement',
        session_id: 'parent',
        cwd: root,
      }),
      encoding: 'utf8',
    })
    expect(native).toMatchObject({ status: 0 })
    const payload = JSON.parse(native.stdout)
    expect(payload.hookSpecificOutput.additionalContext).toContain('Moluoxixi Native Implement Subagent')
    expect(payload.hookSpecificOutput.additionalContext).toContain('# Native context')

    const activeTaskModule = path.join(root, '.moluoxixi', 'scripts', 'common', 'active_task.py')
    for (const [platform, variable] of [
      ['codex', 'CODEX_SESSION_ID'],
      ['opencode', 'OPENCODE_RUN_ID'],
      ['codebuddy', 'CODEBUDDY_SESSION_ID'],
      ['pi', 'PI_SESSION_ID'],
      ['trae', 'TRAE_SESSION_ID'],
    ]) {
      const env = { ...process.env, [variable]: 'invented-value' }
      for (const key of [
        'MOLUOXIXI_CONTEXT_ID',
        'CLAUDE_CODE_SESSION_ID',
        'CODEX_THREAD_ID',
        'GEMINI_SESSION_ID',
        'QODER_SESSION_ID',
        'KIRO_SESSION_ID',
        'COPILOT_SESSION_ID',
        'COPILOT_SESSIONID',
      ])
        delete env[key]
      env[variable] = 'invented-value'
      const resolved = runPythonModuleFunction(
        activeTaskModule,
        `module.resolve_context_key({}, platform=${JSON.stringify(platform)})`,
        { cwd: root, env },
      )
      expect(resolved.status).toBe(0)
      expect(resolved.stdout.trim()).toBe('None')
    }
  }, 15_000)

  it('bridges CodeBuddy hook session identity into a short-lived shell ticket', () => {
    const root = project('codebuddy')
    const hook = path.join(root, '.codebuddy', 'hooks', 'inject-shell-session-context.py')
    const result = spawnSync(pythonCommand, [hook], {
      cwd: root,
      input: JSON.stringify({
        session_id: 'bridge-session',
        cwd: root,
        tool_input: { command: 'python .moluoxixi/scripts/task.py current' },
      }),
      encoding: 'utf8',
    })
    expect(result).toMatchObject({ status: 0, stdout: '' })
    const ticketDir = path.join(root, '.moluoxixi', '.runtime', 'shell-tickets')
    const tickets = fs.readdirSync(ticketDir)
    expect(tickets).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(path.join(ticketDir, tickets[0]), 'utf8'))).toMatchObject({
      platform: 'codebuddy',
      context_key: 'codebuddy_bridge-session',
      subcommands: [{ name: 'current' }],
    })
  }, 15_000)
})
