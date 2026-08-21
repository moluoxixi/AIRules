import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

// The initializer is distributed as role-local JavaScript rather than a public TS module.
// @ts-expect-error no declaration file is shipped for the role-local entrypoint
import { installExtension } from '../skills/init-project/scripts/install-extension.mjs'

const roleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = path.join(roleRoot, 'skills', 'init-project')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function projectFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-knowledge-extension-'))
  temporaryRoots.push(root)
  fs.mkdirSync(path.join(root, '.moluoxixi'), { recursive: true })
  fs.writeFileSync(path.join(root, '.moluoxixi', 'workflow.md'), '# Workflow\n')
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(root, '.codex', 'hooks.json'), `${JSON.stringify({
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'python user-hook.py' }] }],
    },
    userSetting: true,
  }, null, 2)}\n`)
  return root
}

function resolvePython(): string | undefined {
  for (const candidate of ['python3', 'python']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    if (result.status === 0)
      return candidate
  }
  return undefined
}

describe('role-owned knowledge extension', () => {
  it('installs knowledge data, skills, fallback rules, and an independent hook', () => {
    const root = projectFixture()
    const result = installExtension({ project: root, platforms: ['codex'] })

    expect(result.conflicts).toEqual([])
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'), 'utf8')).toContain('# Project Knowledge')
    expect(fs.statSync(path.join(root, '.moluoxixi', 'knowledge', 'sources')).isDirectory()).toBe(true)
    expect(fs.statSync(path.join(root, '.moluoxixi', 'knowledge', 'library')).isDirectory()).toBe(true)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'scripts', 'knowledge.py'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.agents', 'skills', 'moluoxixi-knowledge', 'SKILL.md'))).toBe(true)
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('MOLUOXIXI KNOWLEDGE:START')
    const expectedPython = process.platform === 'win32' ? 'python' : 'python3'
    const fallback = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    const knowledgeSkill = fs.readFileSync(path.join(root, '.agents', 'skills', 'moluoxixi-knowledge', 'SKILL.md'), 'utf8')
    expect(fallback).toContain(`${expectedPython} ./.moluoxixi/scripts/knowledge.py status --json`)
    expect(knowledgeSkill).toContain(`${expectedPython} ./.moluoxixi/scripts/knowledge.py acknowledge`)
    expect(`${fallback}\n${knowledgeSkill}`).not.toContain('{{PYTHON_COMMAND}}')

    const hooks = JSON.parse(fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8'))
    expect(hooks.userSetting).toBe(true)
    expect(JSON.stringify(hooks)).toContain('python user-hook.py')
    expect(JSON.stringify(hooks)).toContain('--airules-knowledge-hook')

    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'), 'utf8'))
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.entries).toHaveProperty('.moluoxixi/scripts/knowledge.py')
    expect(manifest.entries).not.toHaveProperty('.moluoxixi/knowledge/index.md')
    expect(fs.existsSync(path.join(root, '.moluoxixi', '.template-hashes.json'))).toBe(false)
  })

  it('preserves all knowledge data on re-init and force', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'), '# Custom Index\n')
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', 'sources', 'api.md'), '# API\n')
    fs.writeFileSync(path.join(root, '.moluoxixi', 'knowledge', 'library', 'api.md'), '# Organized API\n')

    const reinit = installExtension({ project: root, platforms: ['codex'] })
    const forced = installExtension({ project: root, platforms: ['codex'], force: true })

    expect(reinit.preserved).toContain('.moluoxixi/knowledge/index.md')
    expect(forced.preserved).toContain('.moluoxixi/knowledge/index.md')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'), 'utf8')).toBe('# Custom Index\n')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'sources', 'api.md'), 'utf8')).toBe('# API\n')
    expect(fs.readFileSync(path.join(root, '.moluoxixi', 'knowledge', 'library', 'api.md'), 'utf8')).toBe('# Organized API\n')
  })

  it('merges its managed AGENTS block around existing project instructions', () => {
    const root = projectFixture()
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project Rules\n\nKeep this text.\n')

    installExtension({ project: root, platforms: ['codex'] })
    const installed = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    expect(installed).toContain('# Project Rules')
    expect(installed).toContain('MOLUOXIXI KNOWLEDGE:START')

    fs.writeFileSync(path.join(root, 'AGENTS.md'), installed.replace('Keep this text.', 'Keep the changed text.'))
    installExtension({ project: root, platforms: ['codex'] })
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('Keep the changed text.')
  })

  it('preserves a user-modified managed file unless force is explicit', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const target = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    fs.writeFileSync(target, '# user modification\n')

    const result = installExtension({ project: root, platforms: ['codex'] })
    expect(result.conflicts).toContain('.moluoxixi/scripts/knowledge.py')
    expect(fs.readFileSync(target, 'utf8')).toBe('# user modification\n')

    const forced = installExtension({ project: root, platforms: ['codex'], force: true })
    expect(forced.updated).toContain('.moluoxixi/scripts/knowledge.py')
    expect(fs.readFileSync(target, 'utf8')).toContain('from common.knowledge import main')
  })

  it('rolls back every extension write when its transaction fails', () => {
    const root = projectFixture()

    expect(() => installExtension({
      project: root,
      platforms: ['codex'],
      failAfter: 2,
    })).toThrow(/rolled back/u)

    expect(fs.existsSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false)
    expect(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8')))).not.toContain('--airules-knowledge-hook')
  })

  it('keeps dry-run read-only', () => {
    const root = projectFixture()
    const result = installExtension({ project: root, platforms: ['codex'], dryRun: true })

    expect(result.created).toContain('.moluoxixi/knowledge/index.md')
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'))).toBe(false)
  })

  const python = resolvePython()
  const detectorIt = python ? it : it.skip
  detectorIt('detects, acknowledges, and redetects source content changes', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const source = path.join(root, '.moluoxixi', 'knowledge', 'sources', 'api.md')
    fs.writeFileSync(source, '# API\nVersion one\n')
    const script = path.join(root, '.moluoxixi', 'scripts', 'knowledge.py')
    const run = (args: string[]) => execFileSync(python!, [script, ...args], { cwd: root, encoding: 'utf8' })

    const first = JSON.parse(run(['status', '--json']))
    expect(first.added.map((entry: { path: string }) => entry.path)).toEqual(['api.md'])
    run(['acknowledge', '--batch', first.batch_id])
    expect(JSON.parse(run(['status', '--json'])).pending).toBe(false)

    fs.writeFileSync(source, '# API\nVersion two\n')
    expect(JSON.parse(run(['status', '--json'])).modified).toHaveLength(1)

    const hook = spawnSync(python!, [
      path.join(root, '.moluoxixi', 'scripts', 'knowledge-hook.py'),
      '--platform',
      'codex',
      '--event',
      'prompt',
      '--airules-knowledge-hook',
    ], {
      cwd: root,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: root }),
    })
    expect(hook.status, hook.stderr).toBe(0)
    const context = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext
    expect(context).toContain('trust="untrusted-project-data"')
    expect(context).toContain('modified: api.md')

    fs.rmSync(source)
    expect(JSON.parse(run(['status', '--json'])).deleted).toHaveLength(1)
  }, 15_000)

  it('runs the extension after the role CLI succeeds', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-knowledge-wrapper-'))
    temporaryRoots.push(root)
    const fakeCli = path.join(root, 'fake-cli.mjs')
    fs.writeFileSync(fakeCli, `import fs from 'node:fs'; import path from 'node:path'; fs.mkdirSync(path.join(process.cwd(), '.moluoxixi'), { recursive: true }); fs.writeFileSync(path.join(process.cwd(), '.moluoxixi', 'workflow.md'), '# Workflow\\n');\n`)
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MOLUOXIXI_ROLE_CLI: fakeCli },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge', 'index.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'airules-init-manifest.json'))).toBe(true)
  })

  it('does not install the extension when the role CLI fails', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-knowledge-wrapper-failure-'))
    temporaryRoots.push(root)
    const fakeCli = path.join(root, 'fake-cli.mjs')
    fs.writeFileSync(fakeCli, 'process.exitCode = 7\n')
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MOLUOXIXI_ROLE_CLI: fakeCli },
    })

    expect(result.status).toBe(7)
    expect(fs.existsSync(path.join(root, '.moluoxixi', 'knowledge'))).toBe(false)
  })

  it('uses separate plugin files for plugin-based hook hosts', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['opencode', 'pi', 'omp', 'snow'] })

    expect(fs.existsSync(path.join(root, '.opencode', 'plugins', 'moluoxixi-knowledge.js'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.pi', 'extensions', 'moluoxixi-knowledge.ts'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.omp', 'extensions', 'moluoxixi-knowledge.ts'))).toBe(true)
    const snow = JSON.parse(fs.readFileSync(path.join(root, '.snow', 'hooks', 'onUserMessage.json'), 'utf8'))
    expect(JSON.stringify(snow)).toContain('--airules-knowledge-hook')
  })

  it('projects the knowledge skill to every distinct host skill root', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['all'] })

    const roots = [
      '.agents/skills',
      '.agent/skills',
      '.claude/skills',
      '.codebuddy/skills',
      '.cursor/skills',
      '.devin/skills',
      '.factory/skills',
      '.github/skills',
      '.grok/skills',
      '.kilocode/skills',
      '.kiro/skills',
      '.omp/skills',
      '.opencode/skills',
      '.qoder/skills',
      '.reasonix/skills',
      '.snow/skills',
      '.trae/skills',
      '.zcode/skills',
    ]
    for (const skillDir of roots)
      expect(fs.existsSync(path.join(root, skillDir, 'moluoxixi-knowledge', 'SKILL.md')), skillDir).toBe(true)
  })
})
