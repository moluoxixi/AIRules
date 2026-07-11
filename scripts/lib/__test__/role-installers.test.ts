import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryRoots: string[] = []
const repoRoot = process.cwd()
const trellisScript = path.join(repoRoot, 'roles', 'trellis-development', 'skills', 'install-trellis', 'scripts', 'trellis.mjs')
const openspecScript = path.join(repoRoot, 'roles', 'superpowers-openspec-development', 'skills', 'install-superpowers-openspec', 'scripts', 'openspec.mjs')
const openspecSkillRoot = path.dirname(path.dirname(openspecScript))
const superpowersSkills = [
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
]
const fakeTrellisArtifacts = {
  common: [
    '.trellis/.developer',
    '.trellis/.version',
    '.trellis/config.yaml',
    '.trellis/scripts/task.py',
    '.trellis/tasks/00-bootstrap-guidelines/task.json',
    '.trellis/workflow.md',
    'AGENTS.md',
  ],
  codex: [
    '.agents/skills/trellis-before-dev/SKILL.md',
    '.agents/skills/trellis-meta/SKILL.md',
    '.codex/agents/trellis-check.toml',
    '.codex/agents/trellis-implement.toml',
    '.codex/agents/trellis-research.toml',
    '.codex/config.toml',
    '.codex/hooks.json',
    '.codex/hooks/inject-workflow-state.py',
  ],
  claude: [
    '.claude/agents/trellis-check.md',
    '.claude/agents/trellis-implement.md',
    '.claude/agents/trellis-research.md',
    '.claude/commands/trellis/continue.md',
    '.claude/commands/trellis/finish-work.md',
    '.claude/hooks/inject-subagent-context.py',
    '.claude/hooks/inject-workflow-state.py',
    '.claude/hooks/session-start.py',
    '.claude/settings.json',
    '.claude/skills/trellis-before-dev/SKILL.md',
  ],
  cursor: [
    '.cursor/agents/trellis-check.md',
    '.cursor/agents/trellis-implement.md',
    '.cursor/agents/trellis-research.md',
    '.cursor/commands/trellis-continue.md',
    '.cursor/commands/trellis-finish-work.md',
    '.cursor/hooks.json',
    '.cursor/hooks/inject-shell-session-context.py',
    '.cursor/hooks/inject-subagent-context.py',
    '.cursor/hooks/session-start.py',
    '.cursor/skills/trellis-before-dev/SKILL.md',
  ],
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-role-installer-'))
  temporaryRoots.push(root)
  return root
}

function run(
  script: string,
  args: string[],
  toolHome = path.join(temporaryRoot(), 'tools'),
  extraEnv: NodeJS.ProcessEnv = {},
) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv, AIRULES_TOOL_HOME: toolHome },
  })
}

function createOpenSpecRuntime(root: string): string {
  const skillsRoot = path.join(root, 'skills')
  const installedSkill = path.join(skillsRoot, 'install-superpowers-openspec')
  fs.cpSync(openspecSkillRoot, installedSkill, { recursive: true })
  for (const skill of superpowersSkills) {
    const skillRoot = path.join(skillsRoot, skill)
    fs.mkdirSync(skillRoot, { recursive: true })
    fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), `---\nname: ${skill}\ndescription: fixture\n---\n`)
  }
  return path.join(installedSkill, 'scripts', 'openspec.mjs')
}

function trellisLockHash(): string {
  const lockFile = path.join(
    repoRoot,
    'roles',
    'trellis-development',
    'skills',
    'install-trellis',
    'assets',
    'tool',
    'package-lock.json',
  )
  return createHash('sha256')
    .update(fs.readFileSync(lockFile, 'utf8').replace(/\r\n/gu, '\n'))
    .digest('hex')
}

function openspecLockHash(): string {
  const lockFile = path.join(
    openspecSkillRoot,
    'assets',
    'tool',
    'package-lock.json',
  )
  return createHash('sha256')
    .update(fs.readFileSync(lockFile, 'utf8').replace(/\r\n/gu, '\n'))
    .digest('hex')
}

function writeFakeOpenSpecPackage(packageRoot: string, captureFile?: string): void {
  const binRoot = path.join(packageRoot, 'bin')
  fs.mkdirSync(binRoot, { recursive: true })
  fs.writeFileSync(path.join(packageRoot, 'package.json'), `${JSON.stringify({
    bin: { openspec: 'bin/openspec.cjs' },
    license: 'MIT',
    name: '@fission-ai/openspec',
    version: '1.6.0',
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(binRoot, 'openspec.cjs'), `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const args = process.argv.slice(2)
const captureFile = ${JSON.stringify(captureFile)}
if (captureFile) {
  const keys = ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'npm_config_cache', 'npm_config_userconfig', 'OPENSPEC_TELEMETRY', 'DO_NOT_TRACK']
  fs.appendFileSync(captureFile, JSON.stringify({
    args,
    env: Object.fromEntries(keys.map(key => [key, process.env[key]])),
    projectWriteLock: fs.existsSync(path.join(process.cwd(), '.airules-openspec-write.lock')),
    source: 'cli',
  }) + '\\n')
}
if (args[0] === '--version') {
  process.stdout.write('1.6.0\\n')
  process.exit(0)
}
const commandIndex = args.findIndex(arg => arg !== '--no-color')
if (args[commandIndex] === 'init') {
  const ledger = path.join(path.resolve(args[commandIndex + 1]), 'openspec')
  fs.mkdirSync(path.join(ledger, 'specs'), { recursive: true })
  fs.mkdirSync(path.join(ledger, 'changes', 'archive'), { recursive: true })
  fs.writeFileSync(path.join(ledger, 'config.yaml'), 'schema: spec-driven\\n')
}
`)
}

function createFakeOpenSpecTool(root: string, captureFile?: string): string {
  const toolHome = path.join(root, 'tools')
  const toolRoot = path.join(toolHome, 'openspec', '1.6.0')
  const packageRoot = path.join(toolRoot, 'node_modules', '@fission-ai', 'openspec')
  writeFakeOpenSpecPackage(packageRoot, captureFile)
  fs.writeFileSync(path.join(toolRoot, '.airules-tool.json'), `${JSON.stringify({
    lock_sha256: openspecLockHash(),
    package: '@fission-ai/openspec',
    version: '1.6.0',
  }, null, 2)}\n`)
  return toolHome
}

function createFakeNpm(root: string): string {
  const binRoot = path.join(root, 'fake-bin')
  const npmScript = path.join(binRoot, 'fake-npm.cjs')
  fs.mkdirSync(binRoot, { recursive: true })
  fs.writeFileSync(npmScript, `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const keys = ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'npm_config_cache', 'npm_config_userconfig', 'OPENSPEC_TELEMETRY', 'DO_NOT_TRACK']
fs.appendFileSync(process.env.AIRULES_ENV_CAPTURE, JSON.stringify({
  env: Object.fromEntries(keys.map(key => [key, process.env[key]])),
  source: 'npm',
}) + '\\n')
const destination = path.join(process.cwd(), 'node_modules', '@fission-ai', 'openspec')
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.cpSync(process.env.AIRULES_FAKE_OPENSPEC_PACKAGE, destination, { recursive: true })
`)
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(binRoot, 'npm.cmd'), `@echo off\r\n"${process.execPath}" "${npmScript}" %*\r\n`)
  }
  else {
    const npmExecutable = path.join(binRoot, 'npm')
    fs.writeFileSync(npmExecutable, `#!/bin/sh\nexec "${process.execPath}" "${npmScript}" "$@"\n`)
    fs.chmodSync(npmExecutable, 0o755)
  }
  return binRoot
}

function createFakeTrellisTool(
  root: string,
  options: { attemptGit?: boolean, captureFile?: string, failInit?: boolean, omitArtifact?: string } = {},
): string {
  const toolHome = path.join(root, 'tools')
  const toolRoot = path.join(toolHome, 'trellis', '0.6.6')
  const packageRoot = path.join(toolRoot, 'node_modules', '@mindfoldhq', 'trellis')
  const binRoot = path.join(packageRoot, 'bin')
  fs.mkdirSync(binRoot, { recursive: true })
  fs.writeFileSync(path.join(packageRoot, 'package.json'), `${JSON.stringify({
    bin: { trellis: 'bin/trellis.cjs' },
    license: 'AGPL-3.0-only',
    name: '@mindfoldhq/trellis',
    version: '0.6.6',
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(toolRoot, '.airules-tool.json'), `${JSON.stringify({
    lock_sha256: trellisLockHash(),
    package: '@mindfoldhq/trellis',
    version: '0.6.6',
  }, null, 2)}\n`)
  const fixture = { artifacts: fakeTrellisArtifacts, ...options }
  fs.writeFileSync(path.join(binRoot, 'trellis.cjs'), `#!/usr/bin/env node
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const fixture = ${JSON.stringify(fixture)}
const args = process.argv.slice(2)
if (args[0] === '--version') {
  process.stdout.write('0.6.6\\n')
  process.exit(0)
}
if (args[0] !== 'init') process.exit(2)
if (fixture.captureFile) {
  const keys = ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'NPM_CONFIG_CACHE', 'TEMP']
  fs.writeFileSync(fixture.captureFile, JSON.stringify(Object.fromEntries(keys.map(key => [key, process.env[key]]))))
}
const write = (relative, content = 'fixture\\n') => {
  const target = path.join(process.cwd(), relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}
if (fixture.failInit) {
  write('.trellis/.version', 'partial\\n')
  write('AGENTS.md', 'changed\\n')
  write('.gitignore', 'changed\\n')
  write('.codex/existing.txt', 'changed\\n')
  write('.codex/new.txt')
  write('.agents/skills/partial/SKILL.md')
  process.exit(19)
}
if (fixture.attemptGit) {
  try { execSync('git commit -m should-be-blocked', { stdio: 'ignore' }) } catch {}
}
const developerIndex = args.indexOf('-u')
const developer = developerIndex >= 0 ? args[developerIndex + 1] : 'fixture-user'
const selected = ['codex', 'claude', 'cursor'].filter(platform => args.includes('--' + platform))
const artifacts = [...fixture.artifacts.common, ...selected.flatMap(platform => fixture.artifacts[platform])]
  .filter(artifact => artifact !== fixture.omitArtifact)
for (const artifact of artifacts) {
  if (artifact === '.trellis/.version') write(artifact, '0.6.6\\n')
  else if (artifact === '.trellis/.developer') write(artifact, 'name=' + developer + '\\ninitialized_at=fixture\\n')
  else if (artifact.endsWith('.json')) write(artifact, '{}\\n')
  else write(artifact)
}
`)
  return toolHome
}

function writeLockOwner(lockDir: string, pid: number): void {
  const old = new Date('2000-01-01T00:00:00.000Z')
  fs.mkdirSync(lockDir, { recursive: true })
  fs.writeFileSync(path.join(lockDir, 'owner.json'), `${JSON.stringify({
    hostname: os.hostname(),
    pid,
    started_at: old.toISOString(),
    token: '12345678-1234-1234-1234-123456789abc',
  })}\n`)
  fs.utimesSync(lockDir, old, old)
}

describe('role installer wrappers', () => {
  it('validates the pinned Trellis and OpenSpec package locks without installing', () => {
    const trellis = run(trellisScript, ['verify-lock'])
    const openspec = run(openspecScript, ['verify-lock'])

    expect(trellis.status).toBe(0)
    expect(openspec.status).toBe(0)
    expect(JSON.parse(trellis.stdout)).toMatchObject({
      package: '@mindfoldhq/trellis',
      version: '0.6.6',
      license: 'AGPL-3.0-only',
    })
    expect(JSON.parse(openspec.stdout)).toMatchObject({
      package: '@fission-ai/openspec',
      version: '1.6.0',
      license: 'MIT',
    })
  })

  it('requires explicit AGPL acceptance before Trellis installation', () => {
    const result = run(trellisScript, ['install'])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/accept-agpl-3\.0-only/i)
  })

  it('blocks an OpenSpec-only installation when the Superpowers projection is incomplete', () => {
    const root = temporaryRoot()
    const result = run(openspecScript, ['install'], path.join(root, 'tools'))

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/projection is incomplete/i)
    expect(fs.existsSync(path.join(root, 'tools', 'openspec'))).toBe(false)
  })

  it('does not leave a partial OpenSpec ledger when the pinned tool is absent', () => {
    const root = temporaryRoot()
    const project = path.join(root, 'project')
    fs.mkdirSync(project)
    const runtimeScript = createOpenSpecRuntime(root)

    const result = run(runtimeScript, ['init-ledger', '--project', project], path.join(root, 'tools'))

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/not installed/i)
    expect(fs.existsSync(path.join(project, 'openspec'))).toBe(false)
    expect(fs.readdirSync(project).filter(name => name.startsWith('.airules-openspec-init-'))).toEqual([])
  })

  it('recovers stale OpenSpec install and ledger locks and isolates every child process', () => {
    const root = temporaryRoot()
    const runtimeScript = createOpenSpecRuntime(root)
    const toolHome = path.join(root, 'tools')
    const captureFile = path.join(root, 'openspec-environment.jsonl')
    const sourcePackage = path.join(root, 'fake-openspec-package')
    const fakeBin = createFakeNpm(root)
    writeFakeOpenSpecPackage(sourcePackage, captureFile)
    writeLockOwner(path.join(toolHome, 'openspec', '.install-1.6.0.lock'), 2_147_483_647)

    const installed = run(runtimeScript, ['install'], toolHome, {
      AIRULES_ENV_CAPTURE: captureFile,
      AIRULES_FAKE_OPENSPEC_PACKAGE: sourcePackage,
      APPDATA: path.join(root, 'real-appdata'),
      DO_NOT_TRACK: '0',
      HOME: path.join(root, 'real-home'),
      LOCALAPPDATA: path.join(root, 'real-local-appdata'),
      OPENSPEC_TELEMETRY: '1',
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
      USERPROFILE: path.join(root, 'real-profile'),
      XDG_CACHE_HOME: path.join(root, 'real-xdg-cache'),
      XDG_CONFIG_HOME: path.join(root, 'real-xdg-config'),
      npm_config_cache: path.join(root, 'real-npm-cache'),
    })

    expect(installed.status).toBe(0)
    expect(fs.existsSync(path.join(toolHome, 'openspec', '.install-1.6.0.lock'))).toBe(false)

    const project = path.join(root, 'project')
    fs.mkdirSync(project)
    writeLockOwner(path.join(project, '.airules-openspec-init.lock'), 2_147_483_647)
    const initialized = run(runtimeScript, ['init-ledger', '--project', project], toolHome)

    expect(initialized.status).toBe(0)
    expect(fs.existsSync(path.join(project, '.airules-openspec-init.lock'))).toBe(false)
    expect(fs.existsSync(path.join(project, 'openspec', 'config.yaml'))).toBe(true)

    const records = fs.readFileSync(captureFile, 'utf8').trim().split('\n').map(line => JSON.parse(line)) as Array<{
      env: Record<string, string>
      source: string
    }>
    expect(records.some(record => record.source === 'npm')).toBe(true)
    expect(records.some(record => record.source === 'cli')).toBe(true)
    const isolatedRoot = path.join(toolHome, '.runtime', 'openspec', '1.6.0')
    for (const { env } of records) {
      for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'npm_config_cache', 'npm_config_userconfig']) {
        expect(env[key]).toMatch(new RegExp(`^${isolatedRoot.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`))
      }
      expect(env.OPENSPEC_TELEMETRY).toBe('0')
      expect(env.DO_NOT_TRACK).toBe('1')
    }
  })

  it('never recovers stale-looking OpenSpec locks while their owner PID is alive', () => {
    const root = temporaryRoot()
    const runtimeScript = createOpenSpecRuntime(root)
    const toolHome = path.join(root, 'tools')
    const installLock = path.join(toolHome, 'openspec', '.install-1.6.0.lock')
    const project = path.join(root, 'project')
    const ledgerLock = path.join(project, '.airules-openspec-init.lock')
    fs.mkdirSync(project)
    writeLockOwner(installLock, process.pid)
    writeLockOwner(ledgerLock, process.pid)

    const installed = run(runtimeScript, ['install'], toolHome)
    const initialized = run(runtimeScript, ['init-ledger', '--project', project], toolHome)

    expect(installed.status).toBe(1)
    expect(initialized.status).toBe(1)
    expect(installed.stderr).toMatch(/already in progress/i)
    expect(initialized.stderr).toMatch(/already in progress/i)
    expect(fs.existsSync(installLock)).toBe(true)
    expect(fs.existsSync(ledgerLock)).toBe(true)
  })

  it('rejects symlinked Superpowers projections as local override shadows', () => {
    const root = temporaryRoot()
    const runtimeScript = createOpenSpecRuntime(root)
    const projected = path.join(root, 'skills', 'brainstorming')
    const localOverride = path.join(root, 'local-override')
    fs.rmSync(projected, { recursive: true })
    fs.mkdirSync(localOverride)
    fs.writeFileSync(path.join(localOverride, 'SKILL.md'), 'local override\n')
    fs.symlinkSync(localOverride, projected, process.platform === 'win32' ? 'junction' : 'dir')

    const result = run(runtimeScript, ['doctor'], path.join(root, 'tools'))

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/local\/skills overrides/i)
    expect(result.stderr).toMatch(/shadowed/i)
  })

  it('uses a positive OpenSpec run allowlist and cannot be bypassed by leading flags', () => {
    const root = temporaryRoot()
    const runtimeScript = createOpenSpecRuntime(root)
    const project = path.join(root, 'project')
    fs.mkdirSync(path.join(project, 'openspec'), { recursive: true })
    const rejected = [
      ['--no-color', 'update'],
      ['init'],
      ['completion'],
      ['install'],
      ['uninstall'],
      ['config'],
      ['store'],
      ['new', 'store'],
    ]

    for (const cliArgs of rejected) {
      const result = run(runtimeScript, ['run', '--project', project, '--', ...cliArgs], path.join(root, 'tools'))
      expect(result.status, cliArgs.join(' ')).toBe(1)
      expect(result.stderr, cliArgs.join(' ')).toMatch(/not permitted/i)
    }
  })

  it('locks OpenSpec project writes but leaves allowlisted reads unlocked', () => {
    const root = temporaryRoot()
    const captureFile = path.join(root, 'openspec-commands.jsonl')
    const runtimeScript = createOpenSpecRuntime(root)
    const toolHome = createFakeOpenSpecTool(root, captureFile)
    const project = path.join(root, 'project')
    fs.mkdirSync(path.join(project, 'openspec'), { recursive: true })

    const shown = run(runtimeScript, ['run', '--project', project, '--', '--no-color', 'show', 'example'], toolHome)
    const created = run(runtimeScript, ['run', '--project', project, '--', 'new', 'change', 'example'], toolHome)

    expect(shown.status).toBe(0)
    expect(created.status).toBe(0)
    const records = fs.readFileSync(captureFile, 'utf8').trim().split('\n').map(line => JSON.parse(line)) as Array<{
      args: string[]
      projectWriteLock: boolean
    }>
    const showRecord = records.find(record => record.args.includes('show'))
    const newRecord = records.find(record => record.args[0] === 'new')
    expect(showRecord?.projectWriteLock).toBe(false)
    expect(newRecord?.projectWriteLock).toBe(true)
    expect(fs.existsSync(path.join(project, '.airules-openspec-write.lock'))).toBe(false)
  })

  it('rolls back failed Trellis initialization and isolates upstream user directories', () => {
    const root = temporaryRoot()
    const project = path.join(root, 'project')
    const captureFile = path.join(root, 'captured-environment.json')
    const toolHome = createFakeTrellisTool(root, { captureFile, failInit: true })
    fs.mkdirSync(path.join(project, '.codex'), { recursive: true })
    fs.writeFileSync(path.join(project, 'AGENTS.md'), 'original agents\n')
    fs.writeFileSync(path.join(project, '.gitignore'), 'original ignore\n')
    fs.writeFileSync(path.join(project, '.codex', 'existing.txt'), 'original codex\n')

    const result = run(trellisScript, [
      'init',
      '--project',
      project,
      '--developer',
      'review-user',
      '--platform',
      'codex,claude,cursor',
      '--monorepo',
      'no',
    ], toolHome)

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/failed with exit code 19/i)
    expect(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toBe('original agents\n')
    expect(fs.readFileSync(path.join(project, '.gitignore'), 'utf8')).toBe('original ignore\n')
    expect(fs.readFileSync(path.join(project, '.codex', 'existing.txt'), 'utf8')).toBe('original codex\n')
    expect(fs.existsSync(path.join(project, '.codex', 'new.txt'))).toBe(false)
    expect(fs.existsSync(path.join(project, '.agents'))).toBe(false)
    expect(fs.existsSync(path.join(project, '.trellis'))).toBe(false)
    expect(fs.existsSync(path.join(project, '.airules-trellis-init.lock'))).toBe(false)

    const captured = JSON.parse(fs.readFileSync(captureFile, 'utf8')) as Record<string, string>
    expect(captured.HOME).not.toBe(os.homedir())
    expect(Object.values(captured).every(value => value.includes('airules-trellis-user-'))).toBe(true)
    expect(fs.existsSync(captured.HOME)).toBe(false)
  })

  it('verifies explicit Trellis platform artifacts after initialization', () => {
    const root = temporaryRoot()
    const project = path.join(root, 'project')
    const toolHome = createFakeTrellisTool(root)
    fs.mkdirSync(project)

    const initialized = run(trellisScript, [
      'init',
      '--project',
      project,
      '--developer',
      'review-user',
      '--platform',
      'codex,claude,cursor',
      '--monorepo',
      'no',
    ], toolHome)
    const verified = run(trellisScript, [
      'verify-project',
      '--project',
      project,
      '--platform',
      'codex,claude,cursor',
    ], toolHome)

    expect(initialized.status).toBe(0)
    expect(JSON.parse(initialized.stdout)).toMatchObject({
      developer: 'review-user',
      git_invocations: 0,
      initialized: true,
      platforms: ['codex', 'claude', 'cursor'],
      version: '0.6.6',
    })
    expect(verified.status).toBe(0)
    expect(JSON.parse(verified.stdout).artifacts).toEqual([
      ...fakeTrellisArtifacts.common,
      ...fakeTrellisArtifacts.codex,
      ...fakeTrellisArtifacts.claude,
      ...fakeTrellisArtifacts.cursor,
    ])
  })

  it('rolls back when Trellis exits successfully without a required artifact', () => {
    const root = temporaryRoot()
    const project = path.join(root, 'project')
    const toolHome = createFakeTrellisTool(root, { omitArtifact: '.codex/hooks.json' })
    fs.mkdirSync(project)
    fs.writeFileSync(path.join(project, 'AGENTS.md'), 'original agents\n')

    const result = run(trellisScript, [
      'init',
      '--project',
      project,
      '--developer',
      'review-user',
      '--platform',
      'codex',
      '--monorepo',
      'no',
    ], toolHome)

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/missing the required codex artifact: \.codex\/hooks\.json/i)
    expect(fs.readdirSync(project)).toEqual(['AGENTS.md'])
    expect(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toBe('original agents\n')
  })

  it('blocks Git execution during Trellis initialization and rolls back', () => {
    const root = temporaryRoot()
    const project = path.join(root, 'project')
    const toolHome = createFakeTrellisTool(root, { attemptGit: true })
    fs.mkdirSync(project)

    const result = run(trellisScript, [
      'init',
      '--project',
      project,
      '--developer',
      'review-user',
      '--platform',
      'codex',
      '--monorepo',
      'no',
    ], toolHome)

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/attempted to invoke Git/i)
    expect(fs.readdirSync(project)).toEqual([])
  })

  it('keeps a stale-looking Trellis lock when its owner process is alive', () => {
    const root = temporaryRoot()
    const toolHome = createFakeTrellisTool(root)
    const lockDir = path.join(toolHome, 'trellis', '.install-0.6.6.lock')
    writeLockOwner(lockDir, process.pid)

    const result = run(trellisScript, ['install', '--accept-agpl-3.0-only'], toolHome)

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/already in progress/i)
    expect(fs.existsSync(lockDir)).toBe(true)
  })

  it('recovers a sufficiently old Trellis lock only when its owner is gone', () => {
    const root = temporaryRoot()
    const toolHome = createFakeTrellisTool(root)
    const lockDir = path.join(toolHome, 'trellis', '.install-0.6.6.lock')
    writeLockOwner(lockDir, 2_147_483_647)

    const result = run(trellisScript, ['install', '--accept-agpl-3.0-only'], toolHome)

    expect(result.status).toBe(0)
    expect(fs.existsSync(lockDir)).toBe(false)
  })

  it('rejects concurrent tool and project initialization locks', () => {
    const root = temporaryRoot()
    const project = path.join(root, 'project')
    const toolHome = path.join(root, 'tools')
    const runtimeScript = createOpenSpecRuntime(root)
    fs.mkdirSync(project)
    fs.mkdirSync(path.join(toolHome, 'trellis', '.install-0.6.6.lock'), { recursive: true })
    fs.mkdirSync(path.join(project, '.airules-openspec-init.lock'))

    const trellis = run(trellisScript, ['install', '--accept-agpl-3.0-only'], toolHome)
    const openspec = run(runtimeScript, ['init-ledger', '--project', project], toolHome)

    expect(trellis.status).toBe(1)
    expect(trellis.stderr).toMatch(/owner metadata|already in progress/i)
    expect(openspec.status).toBe(1)
    expect(openspec.stderr).toMatch(/already in progress/i)
  })
})
