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
  fs.mkdirSync(path.join(root, '.trellis'), { recursive: true })
  fs.writeFileSync(path.join(root, '.trellis', 'workflow.md'), '# Workflow\n')
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

describe('trellis role-owned knowledge extension', () => {
  it('installs knowledge data, skills, fallback rules, and an independent hook', () => {
    const root = projectFixture()
    const result = installExtension({ project: root, platforms: ['codex'] })

    expect(result.conflicts).toEqual([])
    expect(fs.readFileSync(path.join(root, '.trellis', 'knowledge', 'index.md'), 'utf8')).toContain('# Project Knowledge')
    expect(fs.statSync(path.join(root, '.trellis', 'knowledge', 'sources')).isDirectory()).toBe(true)
    expect(fs.statSync(path.join(root, '.trellis', 'knowledge', 'library')).isDirectory()).toBe(true)
    expect(fs.existsSync(path.join(root, '.trellis', 'scripts', 'knowledge.py'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.agents', 'skills', 'trellis-knowledge', 'SKILL.md'))).toBe(true)
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('AIRULES:TRELLIS-EXTENSION:START')
    const expectedPython = process.platform === 'win32' ? 'python' : 'python3'
    const fallback = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    const knowledgeSkill = fs.readFileSync(path.join(root, '.agents', 'skills', 'trellis-knowledge', 'SKILL.md'), 'utf8')
    expect(fallback).toContain(`${expectedPython} ./.trellis/scripts/knowledge.py status --json`)
    expect(fallback).toContain('AIRULES:TRELLIS-ZH-COMPAT:START')
    expect(fallback).toContain('Simplified Chinese')
    expect(fallback).toContain('explicit ASCII `--slug`')
    expect(knowledgeSkill).toContain(`${expectedPython} ./.trellis/scripts/knowledge.py acknowledge`)
    expect(`${fallback}\n${knowledgeSkill}`).not.toContain('{{PYTHON_COMMAND}}')

    const hooks = JSON.parse(fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8'))
    expect(hooks.userSetting).toBe(true)
    expect(JSON.stringify(hooks)).toContain('python user-hook.py')
    expect(JSON.stringify(hooks)).toContain('--airules-trellis-knowledge-hook')

    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.trellis', 'airules-init-manifest.json'), 'utf8'))
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.entries).toHaveProperty('.trellis/scripts/knowledge.py')
    expect(manifest.entries).not.toHaveProperty('.trellis/knowledge/index.md')
    expect(fs.existsSync(path.join(root, '.trellis', '.template-hashes.json'))).toBe(false)
  })

  it('preserves all knowledge data on re-init and force', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    fs.writeFileSync(path.join(root, '.trellis', 'knowledge', 'index.md'), '# Custom Index\n')
    fs.writeFileSync(path.join(root, '.trellis', 'knowledge', 'sources', 'api.md'), '# API\n')
    fs.writeFileSync(path.join(root, '.trellis', 'knowledge', 'library', 'api.md'), '# Organized API\n')
    fs.writeFileSync(path.join(root, '.trellis', 'knowledge', '.state.json'), '{"custom":true}\n')

    const reinit = installExtension({ project: root, platforms: ['codex'] })
    const forced = installExtension({ project: root, platforms: ['codex'], force: true })

    expect(reinit.preserved).toContain('.trellis/knowledge/index.md')
    expect(forced.preserved).toContain('.trellis/knowledge/index.md')
    expect(fs.readFileSync(path.join(root, '.trellis', 'knowledge', 'index.md'), 'utf8')).toBe('# Custom Index\n')
    expect(fs.readFileSync(path.join(root, '.trellis', 'knowledge', 'sources', 'api.md'), 'utf8')).toBe('# API\n')
    expect(fs.readFileSync(path.join(root, '.trellis', 'knowledge', 'library', 'api.md'), 'utf8')).toBe('# Organized API\n')
    expect(fs.readFileSync(path.join(root, '.trellis', 'knowledge', '.state.json'), 'utf8')).toBe('{"custom":true}\n')
  })

  it('merges its managed AGENTS block around existing project instructions', () => {
    const root = projectFixture()
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project Rules\n\nKeep this text.\n')

    installExtension({ project: root, platforms: ['codex'] })
    const installed = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    expect(installed).toContain('# Project Rules')
    expect(installed).toContain('AIRULES:TRELLIS-EXTENSION:START')

    fs.writeFileSync(path.join(root, 'AGENTS.md'), installed.replace('Keep this text.', 'Keep the changed text.'))
    installExtension({ project: root, platforms: ['codex'] })
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain('Keep the changed text.')
  })

  it('preserves a user-modified managed file unless force is explicit', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const target = path.join(root, '.trellis', 'scripts', 'knowledge.py')
    fs.writeFileSync(target, '# user modification\n')

    const result = installExtension({ project: root, platforms: ['codex'] })
    expect(result.conflicts).toContain('.trellis/scripts/knowledge.py')
    expect(fs.readFileSync(target, 'utf8')).toBe('# user modification\n')

    const forced = installExtension({ project: root, platforms: ['codex'], force: true })
    expect(forced.updated).toContain('.trellis/scripts/knowledge.py')
    expect(fs.readFileSync(target, 'utf8')).toContain('from common.knowledge import main')
  })

  it('restores only missing managed files originally created by the extension', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const createdTarget = path.join(root, '.trellis', 'scripts', 'knowledge.py')
    fs.rmSync(createdTarget)

    const restored = installExtension({ project: root, platforms: ['codex'] })
    expect(restored.created).toContain('.trellis/scripts/knowledge.py')
    expect(fs.readFileSync(createdTarget, 'utf8')).toContain('from common.knowledge import main')

    const userRoot = projectFixture()
    const userTarget = path.join(userRoot, '.agents', 'skills', 'trellis-knowledge', 'SKILL.md')
    fs.mkdirSync(path.dirname(userTarget), { recursive: true })
    fs.writeFileSync(userTarget, '# User skill\n')
    installExtension({ project: userRoot, platforms: ['codex'], force: true })
    fs.rmSync(userTarget)

    const preserved = installExtension({ project: userRoot, platforms: ['codex'] })
    expect(preserved.preserved).toContain('.agents/skills/trellis-knowledge/SKILL.md')
    expect(fs.existsSync(userTarget)).toBe(false)
  })

  it('rolls back every extension write when its transaction fails', () => {
    const root = projectFixture()

    expect(() => installExtension({
      project: root,
      platforms: ['codex'],
      failAfter: 2,
    })).toThrow(/rolled back/u)

    expect(fs.existsSync(path.join(root, '.trellis', 'airules-init-manifest.json'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.trellis', 'knowledge'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false)
    expect(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8')))).not.toContain('--airules-trellis-knowledge-hook')
  })

  it('keeps dry-run read-only', () => {
    const root = projectFixture()
    const result = installExtension({ project: root, platforms: ['codex'], dryRun: true })

    expect(result.created).toContain('.trellis/knowledge/index.md')
    expect(fs.existsSync(path.join(root, '.trellis', 'knowledge'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.trellis', 'airules-init-manifest.json'))).toBe(false)
  })

  const python = resolvePython()
  const detectorIt = python ? it : it.skip
  detectorIt('detects, acknowledges, and redetects source content changes', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['codex'] })
    const source = path.join(root, '.trellis', 'knowledge', 'sources', 'api.md')
    fs.writeFileSync(source, '# API\nVersion one\n')
    const script = path.join(root, '.trellis', 'scripts', 'knowledge.py')
    const run = (args: string[]) => execFileSync(python!, [script, ...args], { cwd: root, encoding: 'utf8' })

    const first = JSON.parse(run(['status', '--json']))
    expect(first.added.map((entry: { path: string }) => entry.path)).toEqual(['api.md'])
    fs.writeFileSync(path.join(root, '.trellis', 'knowledge', '.state.lock'), 'interrupted process\n')
    run(['acknowledge', '--batch', first.batch_id])
    expect(JSON.parse(run(['status', '--json'])).pending).toBe(false)

    fs.writeFileSync(source, '# API\nVersion two\n')
    expect(JSON.parse(run(['status', '--json'])).modified).toHaveLength(1)

    const hook = spawnSync(python!, [
      path.join(root, '.trellis', 'scripts', 'knowledge-hook.py'),
      '--platform',
      'codex',
      '--event',
      'prompt',
      '--airules-trellis-knowledge-hook',
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
    fs.writeFileSync(fakeCli, `import fs from 'node:fs'; import path from 'node:path'; fs.mkdirSync(path.join(process.cwd(), '.trellis'), { recursive: true }); fs.writeFileSync(path.join(process.cwd(), '.trellis', 'workflow.md'), '# Workflow\\n'); fs.writeFileSync(path.join(process.cwd(), 'argv.json'), JSON.stringify(process.argv.slice(2)));\n`)
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--developer', 'Tester', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TRELLIS_ROLE_CLI: fakeCli },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(path.join(root, '.trellis', 'knowledge', 'index.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.trellis', 'airules-init-manifest.json'))).toBe(true)
    expect(fs.readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('AIRULES:TRELLIS:START')
    expect(JSON.parse(fs.readFileSync(path.join(root, 'argv.json'), 'utf8'))).toEqual(['init', '--codex', '-u', 'Tester', '--yes'])
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
      env: { ...process.env, TRELLIS_ROLE_CLI: fakeCli },
    })

    expect(result.status).toBe(7)
    expect(fs.existsSync(path.join(root, '.trellis', 'knowledge'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'AGENTS.md'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'README.md'))).toBe(false)
  })

  it('propagates non-conflict README injector failures', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-knowledge-wrapper-readme-failure-'))
    temporaryRoots.push(root)
    const fakeCli = path.join(root, 'fake-cli.mjs')
    const fakeInjector = path.join(root, 'fake-readme-injector.mjs')
    fs.writeFileSync(fakeCli, `import fs from 'node:fs'; import path from 'node:path'; fs.mkdirSync(path.join(process.cwd(), '.trellis'), { recursive: true });\n`)
    fs.writeFileSync(fakeInjector, `process.stderr.write('injected failure\\n'); process.exitCode = 5;\n`)
    const wrapper = path.join(skillRoot, 'scripts', 'run-role-cli.mjs')
    const result = spawnSync(process.execPath, [wrapper, '--project', root, '--platform', 'codex', '--yes'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        TRELLIS_README_INJECTOR: fakeInjector,
        TRELLIS_ROLE_CLI: fakeCli,
      },
    })

    expect(result.status).toBe(5)
    expect(result.stderr).toContain('Trellis README injector failed with exit code 5')
    expect(result.stderr).not.toContain('status: conflict')
  })

  it('uses separate plugin files for plugin-based hook hosts', () => {
    const root = projectFixture()
    installExtension({ project: root, platforms: ['opencode', 'pi', 'omp', 'snow'] })

    expect(fs.existsSync(path.join(root, '.opencode', 'plugins', 'trellis-knowledge.js'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.pi', 'extensions', 'trellis-knowledge.ts'))).toBe(true)
    expect(fs.existsSync(path.join(root, '.omp', 'extensions', 'trellis-knowledge.ts'))).toBe(true)
    const snow = JSON.parse(fs.readFileSync(path.join(root, '.snow', 'hooks', 'onUserMessage.json'), 'utf8'))
    expect(JSON.stringify(snow)).toContain('--airules-trellis-knowledge-hook')
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
      expect(fs.existsSync(path.join(root, skillDir, 'trellis-knowledge', 'SKILL.md')), skillDir).toBe(true)
  })
})
