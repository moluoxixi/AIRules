import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { rebuildVendorAssets } from '../../../scripts/lib/vendor-staging.js'
import { listTemplateFiles, readTemplateFile, readTemplateOrAddition } from '../skills/init-project/scripts/templates.mjs'

interface InitSummary {
  conflicts: string[]
  created: string[]
  manifest: string
  packages: Array<{ name: string, path: string, type: string }>
  platforms: string[]
  preserved: string[]
  proposed: string[]
  removed: string[]
  restored: string[]
  unchanged: string[]
  updated: string[]
  warnings: string[]
}

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const initializer = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
const assetRoot = path.join(skillRoot, 'assets')
const packageTemplateRoot = path.join(roleRoot, 'packages', 'cli', 'src', 'templates')
const roleRuntime = path.join(skillRoot, 'assets', 'runtime', 'moluoxixi.mjs')
const projectSkillNames = [
  'before-dev',
  'brainstorm',
  'break-loop',
  'channel',
  'check',
  'continue',
  'finish-work',
  'meta',
  'session-insight',
  'spec-bootstrap',
  'spec-review',
  'start',
  'update-spec',
]
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporaryProject(prefix = 'airules-init-project-'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temporaryRoots.push(root)
  return root
}

function runInitializer(projectRoot: string, args: string[] = [], entry = initializer, env = process.env): { status: number, summary?: InitSummary, stderr: string } {
  const result = spawnSync(process.execPath, [
    entry,
    '--project',
    projectRoot,
    '--python',
    pythonCommand,
    ...args,
  ], { encoding: 'utf8', env })
  return {
    status: result.status ?? -1,
    summary: result.stdout ? JSON.parse(result.stdout) as InitSummary : undefined,
    stderr: result.stderr,
  }
}

function runRuntime(entry: string, args: string[], cwd: string): { status: number, stdout: string, stderr: string } {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8' })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}

function walkFiles(root: string): string[] {
  const files: string[] = []
  function visit(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory())
        visit(target)
      else if (entry.isFile())
        files.push(target)
      else throw new Error(`Unsupported test entry: ${target}`)
    }
  }
  visit(root)
  return files.sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

function snapshot(root: string): Record<string, string> {
  return Object.fromEntries(walkFiles(root).map(file => [
    path.relative(root, file).split(path.sep).join('/'),
    createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  ]))
}

function contentHash(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex')
}

describe('init-project skill', () => {
  it('keeps finalized package templates outside the discoverable init-project skill', () => {
    const nestedSkills = walkFiles(skillRoot)
      .filter(file => path.basename(file) === 'SKILL.md')
      .map(file => path.relative(skillRoot, file).split(path.sep).join('/'))
    expect(nestedSkills).toEqual(['SKILL.md'])
    for (const legacyRoot of ['core', 'hosts', 'project']) {
      const root = path.join(assetRoot, legacyRoot)
      expect(fs.existsSync(root) ? walkFiles(root) : []).toEqual([])
    }

    const finalizedPaths = [
      'common/commands/start.md',
      'common/bundled-skills/spec-review/SKILL.md',
      'project/scripts/spec-proposals.mjs',
    ]
    for (const relativePath of finalizedPaths) {
      const file = path.join(packageTemplateRoot, ...relativePath.split('/'))
      expect(readTemplateFile(relativePath)).toBe(fs.readFileSync(file, 'utf8'))
      expect(readTemplateOrAddition(relativePath)).toBe(fs.readFileSync(file, 'utf8'))
      expect(listTemplateFiles(path.posix.dirname(relativePath))).toContain(relativePath)
    }
    expect(fs.existsSync(path.join(roleRoot, 'overlays'))).toBe(false)
  })

  it('plans every supported platform without invoking or writing anything', () => {
    const projectRoot = temporaryProject()
    const result = runInitializer(projectRoot, ['--platform', 'all', '--dry-run'])
    expect(result).toMatchObject({ status: 0, stderr: '' })
    expect(result.summary?.platforms).toHaveLength(22)
    expect(result.summary?.conflicts).toEqual([])
    expect(result.summary?.manifest).toBe('.moluoxixi/airules-init-manifest.json')
    expect(result.summary?.warnings).toContain('Codex hooks require [features].hooks = true and one-time /hooks approval in the project.')
    expect(result.summary?.created).toEqual(expect.arrayContaining([
      '.moluoxixi/scripts/task.py',
      '.moluoxixi/runtime/moluoxixi.mjs',
      '.moluoxixi/runtime/update/init-project/scripts/init-project.mjs',
      '.claude/settings.json',
      '.codex/config.toml',
      '.gemini/commands/moluoxixi/continue.toml',
      '.gemini/commands/moluoxixi/finish-work.toml',
      '.github/copilot/hooks.json',
      '.dsh/DSH.md',
      '.grok/commands/moluoxixi-start.md',
      '.kimi-code/skills/start/SKILL.md',
      '.omp/extensions/moluoxixi/index.ts',
      '.pi/extensions/moluoxixi/index.ts',
      '.snow/hooks/onSessionStart.json',
      'README.md',
    ]))
    const plannedSkillNames = result.summary?.created
      .filter(relativePath => !relativePath.startsWith('.moluoxixi/runtime/update/'))
      .filter(relativePath => !relativePath.startsWith('.reasonix/skills/moluoxixi-'))
      .map(relativePath => relativePath.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/u)?.[1])
      .filter((name): name is string => name !== undefined) ?? []
    expect([...new Set(plannedSkillNames)]).toEqual(expect.arrayContaining(projectSkillNames))
    expect(plannedSkillNames.every(name => !name.startsWith('moluoxixi-'))).toBe(true)
    expect(result.summary?.created).not.toContain('.claude/hooks/statusline.py')
    expect(result.summary?.created).toContain('.moluoxixi/runtime/update/packages/cli/src/templates/moluoxixi/workflow.md')
    expect(result.summary?.created?.some(relativePath => relativePath.startsWith('.moluoxixi/runtime/update/overlays/'))).toBe(false)
    expect(result.summary?.created?.filter(relativePath => relativePath.startsWith('.moluoxixi/runtime/update/init-project/') && relativePath.endsWith('/SKILL.md'))).toEqual([
      '.moluoxixi/runtime/update/init-project/SKILL.md',
    ])
    expect(fs.readdirSync(projectRoot)).toEqual([])

    const statusline = runInitializer(projectRoot, ['--platform', 'claude', '--with-statusline'])
    expect(statusline).toMatchObject({ status: 0, stderr: '' })
    expect(statusline.summary?.created).toContain('.claude/hooks/statusline.py')
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8'))).toMatchObject({
      statusLine: {
        type: 'command',
        command: `${pythonCommand} .claude/hooks/statusline.py`,
      },
    })

    const aliasRoot = temporaryProject()
    const alias = runInitializer(aliasRoot, ['--platform', 'windsurf', '--dry-run'])
    expect(alias).toMatchObject({ status: 0, stderr: '' })
    expect(alias.summary?.platforms).toEqual(['devin'])
  }, 15_000)

  it('initializes the project core and selected platforms idempotently', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'claude,codex', '--developer', 'tester']
    const first = runInitializer(projectRoot, args)
    expect(first).toMatchObject({ status: 0, stderr: '' })
    expect(first.summary?.conflicts).toEqual([])
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'scripts', 'task.py'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'scripts', 'spec-proposals.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'runtime', 'source'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'runtime', 'update', 'packages', 'cli', 'src', 'templates', 'moluoxixi', 'workflow.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'runtime', 'update', 'overlays'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'runtime', 'update', 'init-project', 'scripts', 'migrations', 'manifests'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'))).toBe(true)
    const initialManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'), 'utf8'))
    expect(initialManifest).toMatchObject({
      generatorVersion: '0.3.0',
      moluoxixiVersion: '0.3.0',
      schemaVersion: 2,
    })
    expect(initialManifest).not.toHaveProperty('upstreamRevision')
    expect(Object.keys(initialManifest.entries as Record<string, unknown>).some(relativePath => relativePath.startsWith('.moluoxixi/spec-proposals/'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8'))).not.toHaveProperty('statusLine')
    expect(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml'))).toBe(true)
    const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8')
    expect(readme).toContain('<!-- AIRULES:MOLUOXIXI:START -->')
    expect(readme).toContain('请使用 Moluoxixi 开始处理这个需求：<描述需求>')
    expect(readme).toContain('请使用 Moluoxixi 完成本次工作。')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', '.developer'), 'utf8')).toMatch(/^name=tester\ninitialized_at=/u)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'tasks', '00-bootstrap-guidelines', 'task.json'))).toBe(true)
    const developerProbe = spawnSync(pythonCommand, [path.join(projectRoot, '.moluoxixi', 'scripts', 'get_developer.py')], { cwd: projectRoot, encoding: 'utf8' })
    expect(developerProbe).toMatchObject({ status: 0, stderr: '' })
    expect(developerProbe.stdout).toContain('tester')
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'LICENSE'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'COPYRIGHT'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'THIRD_PARTY_NOTICES.md'))).toBe(false)
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'scripts', 'common', 'session_context.py'), 'utf8')).not.toContain('["moluoxixi", "--version"]')
    const updaterSkillFiles = walkFiles(path.join(projectRoot, '.moluoxixi', 'runtime', 'update', 'init-project'))
      .filter(file => path.basename(file) === 'SKILL.md')
      .map(file => path.relative(path.join(projectRoot, '.moluoxixi', 'runtime', 'update', 'init-project'), file).split(path.sep).join('/'))
    expect(updaterSkillFiles).toEqual(['SKILL.md'])
    const projectedRoots = [
      path.join(projectRoot, '.moluoxixi', 'scripts'),
      path.join(projectRoot, '.moluoxixi', 'agents'),
      path.join(projectRoot, '.moluoxixi', 'spec'),
      path.join(projectRoot, '.moluoxixi', 'workspace'),
      path.join(projectRoot, '.agents'),
      path.join(projectRoot, '.claude'),
      path.join(projectRoot, '.codex'),
    ]
    const projectedFiles = projectedRoots.flatMap(root => walkFiles(root))
    projectedFiles.push(path.join(projectRoot, '.moluoxixi', 'workflow.md'))
    projectedFiles.push(path.join(projectRoot, '.moluoxixi', 'config.yaml'))
    projectedFiles.push(path.join(projectRoot, 'AGENTS.md'))
    const projectedSkillFiles = walkFiles(projectRoot).filter((file) => {
      const relativePath = path.relative(projectRoot, file).split(path.sep).join('/')
      return !relativePath.startsWith('.moluoxixi/runtime/update/')
        && /(?:^|\/)skills\/[^/]+\/SKILL\.md$/u.test(relativePath)
    })
    expect(projectedSkillFiles.length).toBeGreaterThan(0)
    for (const file of projectedSkillFiles) {
      const relativePath = path.relative(projectRoot, file).split(path.sep).join('/')
      const name = relativePath.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/u)?.[1]
      expect(name).not.toMatch(/^moluoxixi-/u)
      expect(fs.readFileSync(file, 'utf8')).toMatch(new RegExp(`^name: ${name}$`, 'mu'))
    }
    expect([...new Set(projectedSkillFiles.map(file => path.basename(path.dirname(file))))]).toEqual(expect.arrayContaining(projectSkillNames))
    const launcher = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    expect(runRuntime(launcher, ['--version'], projectRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.3.0\n' })
    const initialSnapshot = snapshot(projectRoot)

    const second = runInitializer(projectRoot, args)
    expect(second).toMatchObject({ status: 0, stderr: '' })
    expect(second.summary?.created).toEqual([])
    expect(second.summary?.updated).toEqual([])
    expect(snapshot(projectRoot)).toEqual(initialSnapshot)

    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    expect(runRuntime(projectRuntime, ['spec', 'audit', '--json'], projectRoot)).toMatchObject({ status: 0, stderr: '' })
    const update = runRuntime(projectRuntime, ['update', '--dry-run'], projectRoot)
    expect(update).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(update.stdout)).toMatchObject({ conflicts: [], created: [], updated: [] })
    const workflow = runRuntime(projectRuntime, ['workflow', '--force'], projectRoot)
    expect(workflow).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).toContain('.moluoxixi')
  })

  it('reports a newer synchronized role once per session without a global CLI', () => {
    const projectRoot = temporaryProject()
    const airulesHome = temporaryProject('airules-home-')
    expect(runInitializer(projectRoot, ['--platform', 'codex'])).toMatchObject({ status: 0, stderr: '' })
    fs.writeFileSync(path.join(projectRoot, '.moluoxixi', '.version'), '0.2.0\n')

    const installedRoleRoot = path.join(airulesHome, '.moluoxixi', 'roles', 'moluoxixi')
    fs.mkdirSync(installedRoleRoot, { recursive: true })
    const roleManifest = path.join(installedRoleRoot, 'role.yaml')
    const probe = [
      'import os',
      'import sys',
      'from pathlib import Path',
      'from unittest.mock import patch',
      'sys.path.insert(0, str(Path.cwd() / ".moluoxixi" / "scripts"))',
      'from common import session_context',
      'with patch.object(session_context.Path, "home", return_value=Path(os.environ["AIRULES_TEST_HOME"])):',
      '    print(session_context.get_update_hint(Path.cwd()) or "")',
    ].join('\n')
    const runProbe = (contextId: string) => spawnSync(pythonCommand, ['-c', probe], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        AIRULES_TEST_HOME: airulesHome,
        MOLUOXIXI_CONTEXT_ID: contextId,
      },
    })

    fs.writeFileSync(roleManifest, 'schema_version: 1\nrole_id: moluoxixi\nrole_version: 0.2.0\n')
    const sameVersion = runProbe('same-version')
    expect(sameVersion).toMatchObject({ status: 0, stderr: '' })
    expect(sameVersion.stdout.trim()).toBe('')

    fs.writeFileSync(roleManifest, 'schema_version: 1\nrole_id: moluoxixi\nrole_version: 0.3.0\n')
    const newerVersion = runProbe('newer-version')
    expect(newerVersion).toMatchObject({ status: 0, stderr: '' })
    expect(newerVersion.stdout.trim()).toBe('Moluoxixi update available: 0.2.0 -> 0.3.0, run the current init-project skill')
    const repeated = runProbe('newer-version')
    expect(repeated).toMatchObject({ status: 0, stderr: '' })
    expect(repeated.stdout.trim()).toBe('')
  })

  it('surfaces the update reminder through the projected SessionStart hook', () => {
    const projectRoot = temporaryProject()
    const airulesHome = temporaryProject('airules-home-')
    expect(runInitializer(projectRoot, ['--platform', 'claude'])).toMatchObject({ status: 0, stderr: '' })
    fs.writeFileSync(path.join(projectRoot, '.moluoxixi', '.version'), '0.2.0\n')

    const installedRoleRoot = path.join(airulesHome, '.moluoxixi', 'roles', 'moluoxixi')
    fs.mkdirSync(installedRoleRoot, { recursive: true })
    fs.writeFileSync(path.join(installedRoleRoot, 'role.yaml'), 'schema_version: 1\nrole_id: moluoxixi\nrole_version: 0.3.0\n')
    const hook = path.join(projectRoot, '.claude', 'hooks', 'session-start.py')
    const runHook = () => spawnSync(pythonCommand, [hook], {
      cwd: projectRoot,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: projectRoot, session_id: 'hook-update-session' }),
      env: {
        ...process.env,
        AIRULES_TEST_HOME: airulesHome,
        HOME: airulesHome,
        USERPROFILE: airulesHome,
      },
    })

    const first = runHook()
    expect(first).toMatchObject({ status: 0, stderr: '' })
    const firstPayload = JSON.parse(first.stdout) as { hookSpecificOutput: { additionalContext: string } }
    expect(firstPayload.hookSpecificOutput.additionalContext).toContain(
      'Moluoxixi update available: 0.2.0 -> 0.3.0, run the current init-project skill',
    )

    const repeated = runHook()
    expect(repeated).toMatchObject({ status: 0, stderr: '' })
    const repeatedPayload = JSON.parse(repeated.stdout) as { hookSpecificOutput: { additionalContext: string } }
    expect(repeatedPayload.hookSpecificOutput.additionalContext).not.toContain('Moluoxixi update available:')
  })

  it('surfaces the update reminder through the projected OpenCode session plugin', () => {
    const projectRoot = temporaryProject()
    const airulesHome = temporaryProject('airules-home-')
    expect(runInitializer(projectRoot, ['--platform', 'opencode'])).toMatchObject({ status: 0, stderr: '' })
    fs.writeFileSync(path.join(projectRoot, '.moluoxixi', '.version'), '0.2.0\n')

    const installedRoleRoot = path.join(airulesHome, '.moluoxixi', 'roles', 'moluoxixi')
    fs.mkdirSync(installedRoleRoot, { recursive: true })
    fs.writeFileSync(path.join(installedRoleRoot, 'role.yaml'), 'schema_version: 1\nrole_id: moluoxixi\nrole_version: 0.3.0\n')

    const pluginUrl = pathToFileURL(path.join(projectRoot, '.opencode', 'plugins', 'session-start.js')).href
    const probe = [
      `import createPlugin from ${JSON.stringify(pluginUrl)}`,
      'const client = { session: { messages: async () => ({ data: [] }) } }',
      'const plugin = await createPlugin({ directory: process.cwd(), client })',
      'const output = { parts: [{ id: "prt_000000000100abcdefghijklmn", sessionID: "opencode-update-session", messageID: "msg_1", type: "text", text: "hello" }] }',
      'await plugin["chat.message"]({ sessionID: "opencode-update-session" }, output)',
      'console.log(JSON.stringify(output.parts))',
    ].join('\n')
    const runPlugin = () => spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', probe], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: airulesHome,
        USERPROFILE: airulesHome,
      },
    })

    const first = runPlugin()
    expect(first).toMatchObject({ status: 0, stderr: '' })
    expect(first.stdout).toContain(
      'Moluoxixi update available: 0.2.0 -> 0.3.0, run the current init-project skill',
    )

    const repeated = runPlugin()
    expect(repeated).toMatchObject({ status: 0, stderr: '' })
    expect(repeated.stdout).not.toContain('Moluoxixi update available:')
  })

  it('adapts pull-based agents for every host that cannot inject sub-agent context', () => {
    const projectRoot = temporaryProject()
    const initialized = runInitializer(projectRoot, ['--platform', 'all'])
    expect(initialized).toMatchObject({ status: 0, stderr: '' })

    const agentRoots = [
      ['.codex/agents', '.toml'],
      ['.gemini/agents', '.md'],
      ['.qoder/agents', '.md'],
      ['.github/agents', '.agent.md'],
      ['.pi/agents', '.md'],
      ['.zcode/agents', '.md'],
      ['.trae/agents', '.md'],
    ] as const
    for (const [agentRoot, extension] of agentRoots) {
      for (const agentType of ['implement', 'check']) {
        const content = fs.readFileSync(path.join(projectRoot, ...agentRoot.split('/'), `moluoxixi-${agentType}${extension}`), 'utf8')
        if (agentRoot === '.codex/agents')
          expect(content).toContain('Moluoxixi Context Loading Protocol:')
        else
          expect(content).toContain('## Required: Load Moluoxixi Context First')
        expect(content).toContain('Active task: <path>')
        expect(content).toContain(`${agentType}.jsonl`)
      }
      const research = fs.readFileSync(path.join(projectRoot, ...agentRoot.split('/'), `moluoxixi-research${extension}`), 'utf8')
      expect(research).not.toContain('## Required: Load Moluoxixi Context First')
    }

    const copilotAgent = fs.readFileSync(path.join(projectRoot, '.github', 'agents', 'moluoxixi-implement.agent.md'), 'utf8')
    expect(copilotAgent).toMatch(/^tools:\n(?: {2}- (?:read|edit|execute|search)\n)+/mu)
    expect(copilotAgent).not.toMatch(/^tools:\s*Read/mu)
  })

  it('projects reviewed monorepo packages and preserves them during local updates', () => {
    const projectRoot = temporaryProject()
    const args = [
      '--platform',
      'codex',
      '--package',
      'web=packages/web:frontend',
      '--package',
      'api=services/api:backend',
      '--default-package',
      'web',
    ]
    const initialized = runInitializer(projectRoot, args)
    expect(initialized).toMatchObject({ status: 0, stderr: '' })
    expect(initialized.summary?.packages).toEqual([
      { name: 'api', path: 'services/api', type: 'backend' },
      { name: 'web', path: 'packages/web', type: 'frontend' },
    ])
    const config = fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'config.yaml'), 'utf8')
    expect(config).toContain('"api":\n    path: "services/api"')
    expect(config).toContain('default_package: "web"')
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'api', 'backend', 'index.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'api', 'frontend'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'web', 'frontend', 'index.md'))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'spec', 'web', 'backend'))).toBe(false)

    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const updated = runRuntime(projectRuntime, ['update', '--dry-run'], projectRoot)
    expect(updated).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(updated.stdout)).toMatchObject({ conflicts: [], created: [], updated: [] })
  })

  it('treats explicit monorepo mode switches as authoritative', () => {
    const projectRoot = temporaryProject()
    const missing = runInitializer(projectRoot, ['--platform', 'codex', '--monorepo'])
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('no workspace packages were detected')

    const emptyWorkspaceRoot = temporaryProject()
    fs.writeFileSync(path.join(emptyWorkspaceRoot, 'package.json'), '{"workspaces":["packages/*"]}\n')
    const emptyWorkspace = runInitializer(emptyWorkspaceRoot, ['--platform', 'codex', '--monorepo'])
    expect(emptyWorkspace.status).toBe(1)
    expect(emptyWorkspace.stderr).toContain('no workspace packages were detected')

    expect(runInitializer(projectRoot, [
      '--platform',
      'codex',
      '--package',
      'web=packages/web:frontend',
    ])).toMatchObject({ status: 0, stderr: '' })
    const single = runInitializer(projectRoot, ['--platform', 'codex', '--no-monorepo'])
    expect(single).toMatchObject({ status: 0, stderr: '' })
    expect(single.summary?.packages).toEqual([])
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'), 'utf8')) as {
      project: { defaultPackage?: string, packages: unknown[] }
    }
    expect(manifest.project.packages).toEqual([])
    expect(manifest.project.defaultPackage).toBeUndefined()
  })

  it('re-detects project type and permits an explicit override', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'codex'])).toMatchObject({ status: 0, stderr: '' })
    fs.writeFileSync(path.join(projectRoot, 'package.json'), '{"dependencies":{"react":"latest"}}\n')

    const detected = runInitializer(projectRoot, ['--platform', 'codex'])
    expect(detected).toMatchObject({ status: 0, stderr: '' })
    expect(detected.summary).toMatchObject({ projectType: 'frontend' })
    const overridden = runInitializer(projectRoot, ['--platform', 'codex', '--project-type', 'backend'])
    expect(overridden).toMatchObject({ status: 0, stderr: '' })
    expect(overridden.summary).toMatchObject({ projectType: 'backend' })
  })

  it('reuses an existing developer workspace without overwriting journals', () => {
    const projectRoot = temporaryProject()
    const workspace = path.join(projectRoot, '.moluoxixi', 'workspace', 'tester')
    fs.mkdirSync(workspace, { recursive: true })
    fs.writeFileSync(path.join(workspace, 'journal-1.md'), '# Existing journal\n')
    fs.writeFileSync(path.join(workspace, 'index.md'), '# Existing index\n')

    const initialized = runInitializer(projectRoot, ['--platform', 'codex', '--developer', 'tester'])

    expect(initialized).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(workspace, 'journal-1.md'), 'utf8')).toBe('# Existing journal\n')
    expect(fs.readFileSync(path.join(workspace, 'index.md'), 'utf8')).toBe('# Existing index\n')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', '.developer'), 'utf8')).toContain('name=tester')
  })

  it('retires obsolete owned files while preserving installed hosts and modified retired files', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'codex'])).toMatchObject({ status: 0, stderr: '' })
    const manifestPath = path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      entries: Record<string, { baselineHash: string, mode: string, ownership: { type: string }, platform: string, templateHash: string }>
      schemaVersion: number
    }
    const pristinePath = '.codex/retired-pristine.txt'
    const modifiedPath = '.codex/retired-modified.txt'
    const baseline = 'retired baseline\n'
    for (const relativePath of [pristinePath, modifiedPath]) {
      fs.writeFileSync(path.join(projectRoot, ...relativePath.split('/')), baseline)
      manifest.entries[relativePath] = {
        baselineHash: contentHash(baseline),
        mode: 'replace',
        ownership: { type: 'created' },
        platform: 'codex',
        templateHash: contentHash(baseline),
      }
    }
    fs.appendFileSync(path.join(projectRoot, ...modifiedPath.split('/')), 'user edit\n')
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const migrated = runInitializer(projectRoot, ['--platform', 'claude'])
    expect(migrated.status).toBe(2)
    expect(migrated.summary?.platforms).toEqual(expect.arrayContaining(['claude', 'codex']))
    expect(migrated.summary?.removed).toContain(pristinePath)
    expect(migrated.summary?.conflicts).toContain(modifiedPath)
    expect(fs.existsSync(path.join(projectRoot, ...pristinePath.split('/')))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, ...modifiedPath.split('/')))).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, '.codex', 'config.toml'))).toBe(true)
  })

  it('uninstalls only manifest-owned files and preserves unknown project data', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'claude'])).toMatchObject({ status: 0, stderr: '' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const unknown = path.join(projectRoot, '.moluoxixi', 'tasks', 'user-note.md')
    const pendingKnowledge = path.join(projectRoot, '.moluoxixi', 'spec-proposals', 'inbox', 'user-note.json')
    fs.writeFileSync(unknown, '# Keep me\n')
    fs.mkdirSync(path.dirname(pendingKnowledge), { recursive: true })
    fs.writeFileSync(pendingKnowledge, '{"user":true}\n')

    const preview = runRuntime(projectRuntime, ['uninstall', '--dry-run'], projectRoot)
    expect(preview).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(preview.stdout)).toMatchObject({ conflicts: [], dryRun: true })
    expect(fs.existsSync(projectRuntime)).toBe(true)

    const removed = runRuntime(projectRuntime, ['uninstall', '--yes'], projectRoot)
    expect(removed).toMatchObject({ status: 0, stderr: '' })
    expect(fs.existsSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'))).toBe(false)
    expect(fs.readFileSync(unknown, 'utf8')).toBe('# Keep me\n')
    expect(fs.readFileSync(pendingKnowledge, 'utf8')).toBe('{"user":true}\n')
    expect(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json'))).toBe(false)
  })

  it('restores pre-existing JSON and managed-block files during uninstall', () => {
    const projectRoot = temporaryProject()
    const agents = '# User rules\n'
    const readme = '# User project\n\nKeep this hard break.  \nContinued line.\n'
    const settings = '{"custom":true}\n'
    const codex = 'model = "gpt-test"\n'
    fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true })
    fs.mkdirSync(path.join(projectRoot, '.codex'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), agents)
    fs.writeFileSync(path.join(projectRoot, 'README.md'), readme)
    fs.writeFileSync(path.join(projectRoot, '.claude', 'settings.json'), settings)
    fs.writeFileSync(path.join(projectRoot, '.codex', 'config.toml'), codex)

    expect(runInitializer(projectRoot, ['--platform', 'claude,codex'])).toMatchObject({ status: 0, stderr: '' })
    fs.appendFileSync(path.join(projectRoot, 'README.md'), '\nUser notes after initialization.\n')
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const removed = runRuntime(projectRuntime, ['uninstall', '--yes'], projectRoot)
    expect(removed).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toBe(agents)
    expect(fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8')).toBe(`${readme}\nUser notes after initialization.\n`)
    expect(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8')).toBe(settings)
    expect(fs.readFileSync(path.join(projectRoot, '.codex', 'config.toml'), 'utf8')).toBe(codex)
  })

  it('reports modified owned files as uninstall conflicts without deleting during review', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'claude'])).toMatchObject({ status: 0, stderr: '' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const workflow = path.join(projectRoot, '.moluoxixi', 'workflow.md')
    fs.appendFileSync(workflow, '\n# User edit\n')

    const preview = runRuntime(projectRuntime, ['uninstall', '--dry-run'], projectRoot)
    expect(preview.status).toBe(2)
    expect(JSON.parse(preview.stdout).conflicts).toContain('.moluoxixi/workflow.md')
    expect(fs.readFileSync(workflow, 'utf8')).toContain('# User edit')
    expect(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json'))).toBe(true)
  })

  it('keeps uninstall confirmation separate from force replacement', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'claude'])).toMatchObject({ status: 0, stderr: '' })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const workflow = path.join(projectRoot, '.moluoxixi', 'workflow.md')
    fs.appendFileSync(workflow, '\n# User edit\n')

    const refused = runRuntime(projectRuntime, ['uninstall'], projectRoot)
    expect(refused.status).toBe(1)
    expect(refused.stderr).toContain('requires --yes')
    const confirmed = runRuntime(projectRuntime, ['uninstall', '-y'], projectRoot)
    expect(confirmed.status).toBe(2)
    expect(JSON.parse(confirmed.stdout).conflicts).toContain('.moluoxixi/workflow.md')
    expect(fs.readFileSync(workflow, 'utf8')).toContain('# User edit')
  })

  it('provides local channel and memory command surfaces without a registry package install', () => {
    expect(runRuntime(roleRuntime, ['--version'], roleRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.3.0\n' })
    expect(runRuntime(roleRuntime, ['-v'], roleRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.3.0\n' })
    expect(runRuntime(roleRuntime, ['update', '--help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    expect(runRuntime(roleRuntime, ['workflow', '--help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    expect(runRuntime(roleRuntime, ['mem', 'help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    expect(runRuntime(roleRuntime, ['channel', '--help'], roleRoot)).toMatchObject({ status: 0, stderr: '' })
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'codex'])).toMatchObject({ status: 0, stderr: '' })
    const localSkillFiles = ['channel', 'meta', 'session-insight']
      .map(name => path.join(projectRoot, '.agents', 'skills', name, 'SKILL.md'))
    for (const file of localSkillFiles) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content).not.toMatch(/(^|[^\w.-])moluoxixi (?:channel|mem|update|workflow|--version)/mu)
    }
  })

  it('merges managed configuration and preserves conflicting user files by default', () => {
    const projectRoot = temporaryProject()
    fs.mkdirSync(path.join(projectRoot, '.claude'), { recursive: true })
    fs.mkdirSync(path.join(projectRoot, '.moluoxixi'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# User rules\n')
    fs.writeFileSync(path.join(projectRoot, '.claude', 'settings.json'), '{"custom":true}\n')
    fs.writeFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), '# User workflow\n')

    const preserved = runInitializer(projectRoot, ['--platform', 'claude'])
    expect(preserved.status).toBe(2)
    expect(preserved.summary?.conflicts).toContain('.moluoxixi/workflow.md')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).toBe('# User workflow\n')
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toContain('# User rules')
    expect(fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')).toContain('<!-- MOLUOXIXI:START -->')
    const settings = JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8')) as Record<string, unknown>
    expect(settings.custom).toBe(true)
    expect(settings.hooks).toBeDefined()

    const proposed = runInitializer(projectRoot, ['--platform', 'claude', '--create-new'])
    expect(proposed.status).toBe(2)
    expect(proposed.summary?.proposed).toContain('.moluoxixi/workflow.md.new')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).toBe('# User workflow\n')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md.new'), 'utf8')).not.toBe('# User workflow\n')

    const forced = runInitializer(projectRoot, ['--platform', 'claude', '--force'])
    expect(forced.status).toBe(0)
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'workflow.md'), 'utf8')).not.toBe('# User workflow\n')
  }, 15000)

  it('injects one managed usage block into an existing README across re-initialization', () => {
    const projectRoot = temporaryProject()
    const original = '# Existing project\n\nProject-specific documentation.\n'
    const readmePath = path.join(projectRoot, 'README.md')
    fs.writeFileSync(readmePath, original)

    const first = runInitializer(projectRoot, ['--platform', 'codex'])
    expect(first).toMatchObject({ status: 0, stderr: '' })
    const injected = fs.readFileSync(readmePath, 'utf8')
    expect(injected).toContain(original.trim())
    expect(injected).toContain('请使用 Moluoxixi 继续当前任务。')
    expect(injected.match(/<!-- AIRULES:MOLUOXIXI:START -->/gu)).toHaveLength(1)
    expect(injected.match(/<!-- AIRULES:MOLUOXIXI:END -->/gu)).toHaveLength(1)
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json'), 'utf8')) as {
      entries: Record<string, { mode: string, ownership: { type: string } }>
    }
    expect(manifest.entries['README.md']).toMatchObject({
      mode: 'block-html',
      ownership: { type: 'modified' },
    })

    fs.appendFileSync(readmePath, '\nAdditional project notes.\n')
    const second = runInitializer(projectRoot, ['--platform', 'codex'])
    expect(second).toMatchObject({ status: 0, stderr: '' })
    expect(second.summary?.preserved).toContain('README.md')
    const reinjected = fs.readFileSync(readmePath, 'utf8')
    expect(reinjected).toContain('Additional project notes.')
    expect(reinjected.match(/<!-- AIRULES:MOLUOXIXI:START -->/gu)).toHaveLength(1)
    expect(reinjected.match(/<!-- AIRULES:MOLUOXIXI:END -->/gu)).toHaveLength(1)
  })

  it('removes the managed block from an initializer-created README without deleting later user documentation', () => {
    const projectRoot = temporaryProject()
    expect(runInitializer(projectRoot, ['--platform', 'codex'])).toMatchObject({ status: 0, stderr: '' })
    const readmePath = path.join(projectRoot, 'README.md')
    const userDocumentation = 'User documentation with a hard break.  \nContinued line.\n'
    fs.appendFileSync(readmePath, `\n${userDocumentation}`)

    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    const removed = runRuntime(projectRuntime, ['uninstall', '--yes'], projectRoot)

    expect(removed).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(readmePath, 'utf8')).toBe(userDocumentation)
  })

  it('preserves a non-UTF-8 README as a conflict even when force is requested', () => {
    const projectRoot = temporaryProject()
    const readmePath = path.join(projectRoot, 'README.md')
    const utf16Readme = Buffer.from('\uFEFF# UTF-16 project\r\n', 'utf16le')
    fs.writeFileSync(readmePath, utf16Readme)

    const initialized = runInitializer(projectRoot, ['--platform', 'codex', '--force'])

    expect(initialized.status).toBe(2)
    expect(initialized.summary?.conflicts).toContain('README.md')
    expect(fs.readFileSync(readmePath)).toEqual(utf16Readme)
  })

  it('preserves unrelated project roots, hashes, JSON keys, and managed blocks', () => {
    const projectRoot = temporaryProject()
    const unrelatedRoot = path.join(projectRoot, '.other-workflow')
    fs.mkdirSync(unrelatedRoot, { recursive: true })
    fs.writeFileSync(path.join(unrelatedRoot, 'sentinel.txt'), 'keep unrelated state\n')
    fs.mkdirSync(path.join(projectRoot, '.moluoxixi'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, '.moluoxixi', '.template-hashes.json'), '{"files":{"old":"hash"}}\n')
    fs.mkdirSync(path.join(projectRoot, '.pi'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, '.pi', 'settings.json'), `${JSON.stringify({ unrelatedSetting: true }, null, 2)}\n`)
    fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '<!-- OTHER-WORKFLOW:START -->\nunrelated block\n<!-- OTHER-WORKFLOW:END -->\n')

    const initialized = runInitializer(projectRoot, ['--platform', 'pi'])

    expect(initialized).toMatchObject({ status: 0, stderr: '' })
    expect(initialized.summary).not.toHaveProperty('legacyRootMigrated')
    expect(fs.readFileSync(path.join(unrelatedRoot, 'sentinel.txt'), 'utf8')).toBe('keep unrelated state\n')
    expect(fs.readFileSync(path.join(projectRoot, '.moluoxixi', '.template-hashes.json'), 'utf8')).toContain('"old"')
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, '.pi', 'settings.json'), 'utf8'))).toHaveProperty('unrelatedSetting', true)
    const agents = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8')
    expect(agents).toContain('<!-- OTHER-WORKFLOW:START -->')
    expect(agents).toContain('<!-- MOLUOXIXI:START -->')
  })

  it('upgrades pristine owned JSON exactly and keeps user JSON overrides outside the baseline', () => {
    const projectRoot = temporaryProject()
    const args = ['--platform', 'pi']
    expect(runInitializer(projectRoot, args)).toMatchObject({ status: 0, stderr: '' })

    const settingsPath = path.join(projectRoot, '.pi', 'settings.json')
    const manifestPath = path.join(projectRoot, '.moluoxixi', 'airules-init-manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      entries: Record<string, { baselineContent?: string, baselineHash: string, templateContent?: string }>
    }
    const oldSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>
    oldSettings.enableSkillCommands = false
    const oldContent = `${JSON.stringify(oldSettings, null, 2)}\n`
    fs.writeFileSync(settingsPath, oldContent)
    manifest.entries['.pi/settings.json'].baselineHash = contentHash(oldContent)
    manifest.entries['.pi/settings.json'].baselineContent = Buffer.from(oldContent).toString('base64')
    manifest.entries['.pi/settings.json'].templateContent = Buffer.from(oldContent).toString('base64')
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const upgraded = runInitializer(projectRoot, args)
    expect(upgraded).toMatchObject({ status: 0, stderr: '' })
    expect(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))).toMatchObject({ enableSkillCommands: true })

    const userSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>
    userSettings.enableSkillCommands = false
    fs.writeFileSync(settingsPath, `${JSON.stringify(userSettings, null, 2)}\n`)
    const preserved = runInitializer(projectRoot, args)
    expect(preserved).toMatchObject({ status: 0, stderr: '' })
    expect(preserved.summary?.preserved).toContain('.pi/settings.json')
    expect(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))).toMatchObject({ enableSkillCommands: false })
    const finalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { entries: Record<string, { baselineHash: string }> }
    expect(finalManifest.entries['.pi/settings.json'].baselineHash).not.toBe(contentHash(fs.readFileSync(settingsPath)))
  })

  it('stages the complete role and initializes through its role-local CLI', async () => {
    const root = temporaryProject('airules-init-project-staging-')
    const homeDir = path.join(root, 'home')
    const repository = path.join(homeDir, 'vendor', 'repos', 'moluoxixi')
    fs.mkdirSync(path.join(repository, 'roles'), { recursive: true })
    fs.cpSync(roleRoot, path.join(repository, 'roles', 'moluoxixi'), {
      recursive: true,
      filter: source => path.relative(roleRoot, source).split(path.sep)[0] !== '.sync',
    })
    const manifestPath = path.join(root, 'manifest.mjs')
    fs.writeFileSync(manifestPath, `export const vendors = ${JSON.stringify([{
      name: 'moluoxixi',
      official: true,
      source: 'https://github.com/moluoxixi/AIRules.git',
      projections: [
        { kind: 'role-assets', sourceDir: 'roles/moluoxixi' },
      ],
    }])}\n`)

    const inventory = await rebuildVendorAssets({ homeDir, role: 'moluoxixi', manifestPath })
    expect(inventory.skills).toEqual(['init-project'])
    const staged = path.join(homeDir, 'vendor', 'skills', 'init-project')
    const installedRole = path.join(homeDir, 'roles', 'moluoxixi')
    expect(walkFiles(staged)
      .map(file => path.relative(staged, file).split(path.sep).join('/'))
      .filter(relativePath => path.posix.basename(relativePath) === 'SKILL.md'))
      .toEqual(['SKILL.md'])
    expect(fs.existsSync(path.join(staged, 'scripts', 'init-project.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'references', 'platforms.md'))).toBe(true)
    expect(fs.existsSync(path.join(staged, 'references', 'asset-layout.md'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'cli', 'src', 'templates', 'moluoxixi', 'workflow.md'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'overlays'))).toBe(false)
    expect(fs.existsSync(path.join(installedRole, '.sync'))).toBe(false)
    expect(fs.existsSync(path.join(staged, 'assets', 'runtime', 'moluoxixi.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'core', 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(installedRole, 'packages', 'cli', 'bin', 'init-project.js'))).toBe(true)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'agents'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'vendor', 'AGENTS.md'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'moluoxixi', 'runtime'))).toBe(false)
    expect(fs.existsSync(path.join(homeDir, 'roles', 'moluoxixi', 'agents'))).toBe(false)

    const projectRoot = path.join(root, 'project')
    fs.mkdirSync(projectRoot)
    const installed = runInitializer(
      projectRoot,
      ['--platform', 'claude,codex'],
      path.join(staged, 'scripts', 'run-role-cli.mjs'),
      {
        ...process.env,
        npm_config_offline: 'true',
        npm_config_registry: 'http://127.0.0.1:9',
      },
    )
    expect(installed).toMatchObject({ status: 0, stderr: '' })
    expect(fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8')).toContain('请使用 Moluoxixi 开始处理这个需求：<描述需求>')
    expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills', 'start', 'SKILL.md'))).toBe(true)
    const channelLauncher = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    expect(runRuntime(channelLauncher, ['--version'], projectRoot)).toMatchObject({ status: 0, stderr: '', stdout: '0.3.0\n' })
    fs.rmSync(path.join(homeDir, 'roles'), { recursive: true, force: true })
    fs.rmSync(repository, { recursive: true, force: true })
    const projectRuntime = path.join(projectRoot, '.moluoxixi', 'runtime', 'moluoxixi.mjs')
    expect(runRuntime(projectRuntime, ['update', '--dry-run'], projectRoot)).toMatchObject({ status: 0, stderr: '' })
  }, 30_000)
})
