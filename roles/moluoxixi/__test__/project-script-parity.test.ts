import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { readTemplateFile } from '../skills/init-project/scripts/templates.mjs'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const initializer = path.join(skillRoot, 'scripts', 'init-project.mjs')
const python = process.platform === 'win32' ? 'python' : 'python3'
const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function temporaryProject(platform = 'kilo', initialize = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-project-scripts-'))
  roots.push(root)
  if (initialize) {
    const result = spawnSync(process.execPath, [
      initializer,
      '--project',
      root,
      '--platform',
      platform,
      '--python',
      python,
      '--developer',
      'tester',
    ], { encoding: 'utf8' })
    expect(result).toMatchObject({ status: 0, stderr: '' })
  }
  return root
}

function runTask(root: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(python, [path.join(root, '.moluoxixi', 'scripts', 'task.py'), ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  })
}

function createdTask(root: string, slug: string, extra: string[] = []) {
  const result = runTask(root, [
    'create',
    slug,
    '--slug',
    slug,
    '--description',
    `${slug} description`,
    '--complexity',
    'lightweight',
    '--no-start',
    ...extra,
  ])
  expect(result.status).toBe(0)
  return result.stdout.trim()
}

describe('project script adaptations', () => {
  it('supports task JSON output, metadata, base-branch resolution, and orphan rendering', () => {
    const root = temporaryProject()
    expect(spawnSync('git', ['init', '-b', 'trunk'], { cwd: root, encoding: 'utf8' }).status).toBe(0)
    expect(spawnSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk'], { cwd: root, encoding: 'utf8' }).status).toBe(0)
    expect(spawnSync('git', ['checkout', '-b', 'feature'], { cwd: root, encoding: 'utf8' }).status).toBe(0)

    const parent = createdTask(root, 'parent', ['--meta', 'ticket=ENG-1'])
    const child = createdTask(root, 'child', ['--parent', parent, '--base-branch', 'release'])
    const parentData = JSON.parse(fs.readFileSync(path.join(root, parent, 'task.json'), 'utf8'))
    const childPath = path.join(root, child, 'task.json')
    const childData = JSON.parse(fs.readFileSync(childPath, 'utf8'))
    expect(parentData).toMatchObject({ base_branch: 'trunk', meta: { ticket: 'ENG-1' } })
    expect(childData).toMatchObject({ base_branch: 'release', parent: path.basename(parent) })

    childData.status = 'in_progress'
    fs.writeFileSync(childPath, `${JSON.stringify(childData, null, 2)}\n`)
    const listed = runTask(root, ['list', '--json'])
    expect(listed.status).toBe(0)
    const listPayload = JSON.parse(listed.stdout)
    expect(listPayload.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'parent', display_status: 'active' }),
      expect.objectContaining({ id: 'child', parent: path.basename(parent) }),
    ]))

    expect(runTask(root, ['set-meta', child, 'epic', 'workflow']).status).toBe(0)
    expect(JSON.parse(fs.readFileSync(childPath, 'utf8')).meta).toMatchObject({ epic: 'workflow' })

    fs.rmSync(path.join(root, parent), { recursive: true })
    const orphanList = runTask(root, ['list'])
    expect(orphanList.status).toBe(0)
    expect(orphanList.stdout).toContain(`${path.basename(child)}/`)

    const sessionEnv = { ...process.env, MOLUOXIXI_CONTEXT_ID: 'script-parity' }
    childData.status = 'planning'
    childData.executionApproval = { mode: 'manual', granted: false, source: null }
    fs.writeFileSync(childPath, `${JSON.stringify(childData, null, 2)}\n`)
    expect(runTask(root, ['start', child, '--user-approved'], sessionEnv).status).toBe(0)
    const current = runTask(root, ['current', '--json'], sessionEnv)
    expect(current.status).toBe(0)
    expect(JSON.parse(current.stdout)).toMatchObject({
      current_task: { id: 'child', dir: child, base_branch: 'release' },
      stale: false,
    })

    const archiveRoot = path.join(root, '.moluoxixi', 'tasks', 'archive')
    expect(runTask(root, ['archive', archiveRoot, '--no-commit']).status).toBe(1)
    expect(fs.existsSync(archiveRoot)).toBe(true)
  }, 20_000)

  it('skips only the configured per-turn breadcrumb and allows an empty keyword', () => {
    const root = temporaryProject('claude')
    const hook = path.join(root, '.claude', 'hooks', 'inject-workflow-state.py')
    const invoke = (prompt: string) => spawnSync(python, [hook], {
      cwd: root,
      input: JSON.stringify({ cwd: root, prompt }),
      encoding: 'utf8',
    })

    expect(invoke('please use no-moluoxixi for this turn')).toMatchObject({ status: 0, stdout: '' })
    expect(invoke('no-moluoxixifoo is not the keyword').stdout).toContain('workflow-state')

    fs.appendFileSync(
      path.join(root, '.moluoxixi', 'config.yaml'),
      '\nprompt_injection:\n  skip_keyword: ""\n',
    )
    expect(invoke('no-moluoxixi is disabled').stdout).toContain('workflow-state')

    const openCodePlugin = readTemplateFile('opencode/plugins/inject-workflow-state.js')
    expect(openCodePlugin).toContain('findUserTextPart')
    expect(openCodePlugin).toContain('DEFAULT_PROMPT_INJECTION_SKIP_KEYWORD = "no-moluoxixi"')
  })

  it('keeps the small-task creation opt-out contract', () => {
    const workflow = readTemplateFile('moluoxixi/workflow.md')
    const start = readTemplateFile('common/commands/start.md')
    const sessionStart = readTemplateFile('shared-hooks/session-start.py')
    const openCodeSession = readTemplateFile('opencode/lib/session-utils.js')

    const consentRule = 'Simple conversation / small task: ask only whether this turn should create a Moluoxixi task. If the user says no, skip Moluoxixi for this session.'
    expect(workflow).toContain(consentRule)
    expect(workflow).toMatch(/\[workflow-state:no_task\][\s\S]*If the user says no, skip Moluoxixi for this session\.[\s\S]*\[\/workflow-state:no_task\]/u)
    expect(start).toContain('If the user says no, skip Moluoxixi for this session.')
    for (const hostContext of [sessionStart, openCodeSession]) {
      expect(hostContext).toContain('Classify the current turn before creating any Moluoxixi task.')
      expect(hostContext).toContain('Simple conversation / small task asks only whether this turn should create a Moluoxixi task.')
    }
  })

  it('writes structured journal sections and merges the journal attribute block', () => {
    const root = temporaryProject('kilo', false)
    fs.writeFileSync(path.join(root, '.gitattributes'), '*.bin binary\n')
    const initialize = () => spawnSync(process.execPath, [
      initializer,
      '--project',
      root,
      '--platform',
      'kilo',
      '--python',
      python,
      '--developer',
      'tester',
    ], { encoding: 'utf8' })
    expect(initialize()).toMatchObject({ status: 0, stderr: '' })
    expect(initialize()).toMatchObject({ status: 0, stderr: '' })

    const attributes = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8')
    expect(attributes).toContain('*.bin binary')
    expect(attributes).toContain('.moluoxixi/workspace/*/journal-*.md merge=union')
    expect(attributes.match(/# AIRULES:MOLUOXIXI:START/gu)).toHaveLength(1)

    const addSession = spawnSync(python, [
      path.join(root, '.moluoxixi', 'scripts', 'add_session.py'),
      '--title',
      'Structured journal',
      '--summary',
      'Upgrade summary',
      '--change',
      'Added task JSON output',
      '--test',
      'Ran focused tests',
      '--next-step',
      'Run the full suite',
      '--no-commit',
    ], { cwd: root, encoding: 'utf8' })
    expect(addSession.status).toBe(0)
    const workspace = path.join(root, '.moluoxixi', 'workspace', 'tester')
    const journal = fs.readdirSync(workspace).find(file => /^journal-\d+\.md$/u.test(file))
    expect(journal).toBeDefined()
    const content = fs.readFileSync(path.join(workspace, journal!), 'utf8')
    expect(content).toContain('- Added task JSON output')
    expect(content).toContain('- [OK] Ran focused tests')
    expect(content).toContain('- Run the full suite')
    expect(content).not.toContain('Detailed change bullets were not supplied')
  }, 20_000)

  it('keeps atomic-write cleanup and bounded polyrepo probes in the distributed source', () => {
    const io = readTemplateFile('moluoxixi/scripts/common/io.py')
    expect(io).toContain('os.close(fd)')
    expect(io).not.toContain('except BaseException')

    const sessionContext = readTemplateFile('moluoxixi/scripts/common/session_context.py')
    expect(sessionContext).toContain('_POLYREPO_SCAN_MAX_REPOS = 8')
    expect(sessionContext).toContain('_GIT_PROBE_TIMEOUT_SECONDS = 2.0')
    expect(sessionContext).toContain('timeout=_GIT_PROBE_TIMEOUT_SECONDS')
  })

  it('keeps the v0.6.15 Pi model, thinking, and native-session fixes', () => {
    const pi = readTemplateFile('pi/extensions/moluoxixi/index.ts.txt')
    expect(pi).toContain('function contextModelRef')
    expect(pi).toContain('const rawModel = inputModel ?? agentModel ?? str(inheritedModel)')
    expect(pi).toContain('"xhigh", "max"')
    expect(pi).toContain('str(process.env.PI_SESSION_ID)')
    expect(pi).toMatch(/normalized === sessionId \? "" : `_\$\{hash\(sessionId\)\}`/u)
    expect(pi).toContain('const k = contextKey(input, ctx) ?? curKey ?? procKey')
    expect(pi).not.toContain('function sessionHasTask')
    expect(pi).not.toContain('function adoptKey')
    expect(pi).not.toContain('const ov = str(process.env.MOLUOXIXI_CONTEXT_ID)')
  })

  it('decodes hook JSON as UTF-8 and keeps generated-mechanism docs factual', () => {
    for (const name of ['inject-subagent-context.py', 'inject-shell-session-context.py']) {
      const hook = readTemplateFile(`shared-hooks/${name}`)
      expect(hook).toContain('_stdin_reconfigure = getattr(sys.stdin, "reconfigure", None)')
      expect(hook).toContain('_stdin_reconfigure(encoding="utf-8", errors="replace")')
    }

    const workflowHook = readTemplateFile('shared-hooks/inject-workflow-state.py')
    const metaSkill = readTemplateFile('common/bundled-skills/moluoxixi-meta/SKILL.md')
    expect(workflowHook).toContain('``CORE_HOOKS``')
    expect(workflowHook).not.toContain('writeSharedHooks()')
    expect(metaSkill).toContain('`addCoreSkills()`')
    expect(metaSkill).not.toContain('getBundledSkillTemplates()')
  })

  it('uses the local Codex auto default without claiming a fork_turns limitation', () => {
    const root = temporaryProject('codex')
    const hook = path.join(root, '.codex', 'hooks', 'inject-workflow-state.py')
    const script = [
      'import importlib.util, sys',
      'sys.dont_write_bytecode = True',
      'spec = importlib.util.spec_from_file_location("workflow_hook", sys.argv[1])',
      'module = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(module)',
      'print(module._codex_mode_banner({}))',
      'print(module.resolve_breadcrumb_key("in_progress", "codex", {}))',
      'print(module.resolve_breadcrumb_key("in_progress", "codex", {"codex": {"dispatch_mode": "inline"}}))',
      'print(module.resolve_breadcrumb_key("in_progress", "codex", {"codex": {"dispatch_mode": "invalid"}}))',
    ].join('; ')
    const result = spawnSync(python, ['-c', script, hook], { encoding: 'utf8' })
    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(result.stdout.trim().split(/\r?\n/u)).toEqual([
      expect.stringContaining('<codex-mode>auto:'),
      'in_progress',
      'in_progress-inline',
      'in_progress-inline',
    ])
    expect(fs.readFileSync(hook, 'utf8')).not.toContain('can\'t inherit the parent session')
  }, 15_000)

  it('clears the session that actually resolved the active task', () => {
    const root = temporaryProject()
    const task = createdTask(root, 'fallback-clear')
    const sessions = path.join(root, '.moluoxixi', '.runtime', 'sessions')
    fs.mkdirSync(sessions, { recursive: true })
    fs.writeFileSync(path.join(sessions, 'resolved-session.json'), `${JSON.stringify({ current_task: task })}\n`)

    const result = runTask(root, ['finish'], { ...process.env, MOLUOXIXI_CONTEXT_ID: 'missing-session' })

    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(sessions, 'resolved-session.json'))).toBe(false)
    expect(fs.existsSync(path.join(sessions, 'missing-session.json'))).toBe(false)
  })
})
